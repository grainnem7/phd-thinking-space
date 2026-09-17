import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, setPersistence, inMemoryPersistence } from 'firebase/auth';
import app from '../lib/firebase';
import { useAuth } from './useAuth';
import { parseLocalDate, toDateKey } from '../utils/date';

// Read-only Google Calendar sync for one or more Google accounts.
//
// Each account is connected through a separate, in-memory Firebase Auth
// instance, so choosing another Google account in the popup never affects the
// user's sign-in to the app. The popup returns a Google access token with the
// calendar.readonly scope. Those tokens last one hour and can't be refreshed
// from the browser, so they're kept in sessionStorage with their expiry and the
// account shows "Reconnect" once it lapses.
//
// The list of connected accounts (and which of their calendars are hidden) is
// remembered per device in localStorage.

const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const API = 'https://www.googleapis.com/calendar/v3';
const ACCOUNTS_KEY = 'gcal-accounts';
const TOKENS_KEY = 'gcal-tokens';
const TOKEN_LIFETIME_MS = 55 * 60 * 1000;

// ---------------------------------------------------------------------------
// Shared account store
// ---------------------------------------------------------------------------

function readJson(storage, key, fallback) {
  try {
    const value = JSON.parse(storage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function loadState() {
  if (typeof window === 'undefined') return { accounts: [], tokens: {} };
  const accounts = readJson(localStorage, ACCOUNTS_KEY, []);
  const tokens = readJson(sessionStorage, TOKENS_KEY, {});
  // Clear the single-account keys used before multi-account support
  try {
    localStorage.removeItem('gcal-connected');
    sessionStorage.removeItem('gcal-token');
  } catch { /* ignore */ }
  return { accounts: Array.isArray(accounts) ? accounts : [], tokens: tokens && typeof tokens === 'object' ? tokens : {} };
}

let state = loadState();
const listeners = new Set();

function setState(patch) {
  state = { ...state, ...patch };
  writeJson(localStorage, ACCOUNTS_KEY, state.accounts);
  writeJson(sessionStorage, TOKENS_KEY, state.tokens);
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;

function validToken(email) {
  const token = state.tokens[email];
  return token?.accessToken && token.expiresAt > Date.now() ? token.accessToken : null;
}

function calendarAuth() {
  const name = 'google-calendar';
  const existing = getApps().find((a) => a.name === name);
  return getAuth(existing || initializeApp(app.options, name));
}

async function connectAccount(loginHint) {
  const auth = calendarAuth();
  await setPersistence(auth, inMemoryPersistence);
  const provider = new GoogleAuthProvider();
  provider.addScope(SCOPE);
  // New accounts: let the user pick; reconnecting: go straight to that account
  provider.setCustomParameters(loginHint ? { login_hint: loginHint } : { prompt: 'select_account' });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const email = result.user.email;
  const name = result.user.displayName || email;
  const photoURL = result.user.photoURL || null;
  await signOut(auth).catch(() => {});
  if (!credential?.accessToken || !email) throw new Error('Google did not return calendar access.');

  const existing = state.accounts.find((a) => a.email === email);
  const accounts = existing
    ? state.accounts.map((a) => (a.email === email ? { ...a, name, photoURL } : a))
    : [...state.accounts, { email, name, photoURL, hiddenCalendars: [] }];
  setState({
    accounts,
    tokens: { ...state.tokens, [email]: { accessToken: credential.accessToken, expiresAt: Date.now() + TOKEN_LIFETIME_MS } },
  });
  return email;
}

function removeAccount(email) {
  const token = state.tokens[email]?.accessToken;
  if (token) {
    fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => {});
  }
  const tokens = { ...state.tokens };
  delete tokens[email];
  setState({ accounts: state.accounts.filter((a) => a.email !== email), tokens });
}

function expireToken(email) {
  const tokens = { ...state.tokens };
  delete tokens[email];
  setState({ tokens });
}

function setCalendarHidden(email, calendarId, hidden) {
  setState({
    accounts: state.accounts.map((a) => {
      if (a.email !== email) return a;
      const set = new Set(a.hiddenCalendars || []);
      if (hidden) set.add(calendarId);
      else set.delete(calendarId);
      return { ...a, hiddenCalendars: [...set] };
    }),
  });
}

// ---------------------------------------------------------------------------
// Google API helpers
// ---------------------------------------------------------------------------

function hhmm(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// Expand a Google event into one entry per calendar day it covers within the range.
function toEntries(event, calendar, account, rangeStart, rangeEnd) {
  const base = {
    source: 'google',
    googleId: event.id,
    title: event.summary || '(No title)',
    location: event.location || '',
    description: event.description || '',
    htmlLink: event.htmlLink,
    calendarName: calendar.summary,
    accountEmail: account,
    colorHex: calendar.backgroundColor || '#10b981',
  };
  const idBase = `g-${account}-${calendar.id}-${event.id}`;

  if (event.start?.date) {
    // All-day: end.date is exclusive
    const entries = [];
    const cursor = parseLocalDate(event.start.date);
    let end = parseLocalDate(event.end?.date || event.start.date);
    if (end <= cursor) {
      end = new Date(cursor);
      end.setDate(end.getDate() + 1);
    }
    while (cursor < end) {
      const key = toDateKey(cursor);
      if (key >= rangeStart && key <= rangeEnd) {
        entries.push({ ...base, id: `${idBase}-${key}`, date: key, allDay: true });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return entries;
  }

  if (event.start?.dateTime) {
    const start = new Date(event.start.dateTime);
    const end = event.end?.dateTime ? new Date(event.end.dateTime) : start;
    const key = toDateKey(start);
    return [{
      ...base,
      id: idBase,
      date: key,
      allDay: false,
      startTime: hhmm(start),
      // Events running past midnight show as ending at 23:59 on their start day
      endTime: toDateKey(end) === key ? hhmm(end) : '23:59',
    }];
  }
  return [];
}

async function googleFetch(path, token) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    let reason = '';
    try { reason = (await res.json())?.error?.errors?.[0]?.reason || ''; } catch { /* ignore */ }
    const err = new Error(`Google Calendar request failed (${res.status})`);
    err.status = res.status;
    err.reason = reason;
    throw err;
  }
  return res.json();
}

function describeError(e) {
  if (e.status === 403 && (e.reason === 'accessNotConfigured' || e.reason === 'SERVICE_DISABLED')) {
    return 'The Google Calendar API is not enabled for this Firebase project yet.';
  }
  if (e.status === 403) return 'Calendar access was not granted. Reconnect and tick the calendar permission.';
  return 'Could not load Google Calendar events.';
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGoogleCalendar(rangeStart, rangeEnd) {
  const { user, isDemo } = useAuth();
  const store = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [events, setEvents] = useState([]);
  const [calendarsByAccount, setCalendarsByAccount] = useState({});
  const [errorsByAccount, setErrorsByAccount] = useState({});
  const [isFetching, setIsFetching] = useState(false);
  const [connectError, setConnectError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const available = Boolean(user) && !isDemo;
  const accounts = store.accounts.map((a) => ({
    ...a,
    connected: Boolean(store.tokens[a.email]?.accessToken && store.tokens[a.email].expiresAt > now),
    calendars: calendarsByAccount[a.email] || [],
    error: errorsByAccount[a.email] || null,
  }));
  const connectedKey = accounts.filter((a) => a.connected).map((a) => `${a.email}:${(a.hiddenCalendars || []).join(',')}`).join('|');

  const status = !available
    ? 'unavailable'
    : accounts.length === 0
      ? 'disconnected'
      : accounts.some((a) => a.connected) ? 'connected' : 'expired';

  // Re-render when the soonest token expires so accounts flip to "Reconnect"
  useEffect(() => {
    const expiries = Object.values(store.tokens).map((t) => t.expiresAt).filter((t) => t > Date.now());
    if (expiries.length === 0) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(...expiries) - Date.now() + 500);
    return () => clearTimeout(timer);
  }, [store.tokens, now]);

  const connect = useCallback(async (loginHint) => {
    setConnectError(null);
    try {
      await connectAccount(typeof loginHint === 'string' ? loginHint : undefined);
      setNow(Date.now());
    } catch (e) {
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') return;
      if (e?.code === 'auth/popup-blocked') {
        setConnectError('Your browser blocked the Google sign-in popup. Allow popups for this site and try again.');
        return;
      }
      console.error('Google Calendar connect failed:', e);
      setConnectError(e?.message?.replace('Firebase: ', '') || 'Could not connect to Google Calendar.');
    }
  }, []);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    const active = available ? state.accounts.filter((a) => validToken(a.email)) : [];
    if (active.length === 0 || !rangeStart || !rangeEnd) return;

    let cancelled = false;
    const load = async () => {
      setIsFetching(true);
      const timeMin = parseLocalDate(rangeStart).toISOString();
      const endDate = parseLocalDate(rangeEnd);
      endDate.setDate(endDate.getDate() + 1);
      const timeMax = endDate.toISOString();

      const results = await Promise.all(active.map(async (account) => {
        const token = validToken(account.email);
        try {
          const list = await googleFetch('/users/me/calendarList?minAccessRole=reader', token);
          const calendars = (list.items || []).map((c) => ({
            id: c.id,
            name: c.summaryOverride || c.summary,
            color: c.backgroundColor || '#10b981',
            primary: Boolean(c.primary),
          }));
          const hidden = new Set(account.hiddenCalendars || []);
          const visible = (list.items || []).filter((c) => !hidden.has(c.id));

          const perCalendar = await Promise.all(visible.map(async (calendar) => {
            const params = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
            try {
              const data = await googleFetch(`/calendars/${encodeURIComponent(calendar.id)}/events?${params}`, token);
              return (data.items || [])
                .filter((e) => e.status !== 'cancelled')
                .flatMap((e) => toEntries(e, calendar, account.email, rangeStart, rangeEnd));
            } catch (e) {
              if (e.status === 401) throw e;
              console.warn(`Skipping calendar ${calendar.summary}:`, e);
              return [];
            }
          }));
          return { email: account.email, calendars, events: perCalendar.flat(), error: null };
        } catch (e) {
          if (e.status === 401) expireToken(account.email);
          else console.error(`Google Calendar fetch failed for ${account.email}:`, e);
          return { email: account.email, calendars: [], events: [], error: e.status === 401 ? null : describeError(e) };
        }
      }));

      if (cancelled) return;
      setEvents(results.flatMap((r) => r.events));
      setCalendarsByAccount((prev) => ({ ...prev, ...Object.fromEntries(results.filter((r) => r.calendars.length).map((r) => [r.email, r.calendars])) }));
      setErrorsByAccount(Object.fromEntries(results.map((r) => [r.email, r.error])));
      setIsFetching(false);
    };

    load();
    return () => { cancelled = true; };
  }, [available, connectedKey, rangeStart, rangeEnd, refreshKey]);

  const errors = [...new Set(accounts.map((a) => a.error).filter(Boolean))];

  return {
    status,
    accounts,
    events: available && connectedKey ? events : [],
    isFetching,
    error: connectError || errors[0] || null,
    connect,
    reconnect: (email) => connect(email),
    removeAccount,
    setCalendarHidden,
    refresh,
  };
}
