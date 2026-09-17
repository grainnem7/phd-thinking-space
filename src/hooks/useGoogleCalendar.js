import { useState, useEffect, useCallback } from 'react';
import { GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from './useAuth';
import { parseLocalDate, toDateKey } from '../utils/date';

// Read-only Google Calendar sync.
//
// Access tokens come from re-authenticating the signed-in Google user with the
// calendar.readonly scope. Google access tokens last one hour and Firebase does
// not refresh them, so the token is kept in sessionStorage with its expiry and
// the user is asked to reconnect once it lapses. A localStorage flag remembers
// that they opted in, so we can show "Reconnect" instead of "Connect".

const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const TOKEN_KEY = 'gcal-token';
const CONNECTED_KEY = 'gcal-connected';
const API = 'https://www.googleapis.com/calendar/v3';

function readToken() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(TOKEN_KEY));
    if (saved?.accessToken && saved.expiresAt > Date.now()) return saved;
  } catch { /* ignore */ }
  return null;
}

function wasConnected() {
  try { return localStorage.getItem(CONNECTED_KEY) === '1'; } catch { return false; }
}

function hhmm(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// Expand a Google event into one entry per calendar day it covers within the range.
function toEntries(event, calendar, rangeStart, rangeEnd) {
  const base = {
    source: 'google',
    googleId: event.id,
    title: event.summary || '(No title)',
    location: event.location || '',
    description: event.description || '',
    htmlLink: event.htmlLink,
    calendarName: calendar.summary,
    colorHex: calendar.backgroundColor || '#10b981',
  };

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
        entries.push({ ...base, id: `g-${calendar.id}-${event.id}-${key}`, date: key, allDay: true });
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
      id: `g-${calendar.id}-${event.id}`,
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

export function useGoogleCalendar(rangeStart, rangeEnd) {
  const { user, isDemo } = useAuth();
  const [token, setToken] = useState(readToken);
  const [optedIn, setOptedIn] = useState(wasConnected);
  const [events, setEvents] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const status = isDemo || !user
    ? 'unavailable'
    : token
      ? 'connected'
      : optedIn ? 'expired' : 'disconnected';

  const connect = useCallback(async () => {
    if (!auth.currentUser) return;
    setError(null);
    const provider = new GoogleAuthProvider();
    provider.addScope(SCOPE);
    if (auth.currentUser.email) provider.setCustomParameters({ login_hint: auth.currentUser.email });
    try {
      const result = await reauthenticateWithPopup(auth.currentUser, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) throw new Error('Google did not return an access token.');
      // Tokens last 60 minutes; treat them as expired a little early.
      const saved = { accessToken: credential.accessToken, expiresAt: Date.now() + 55 * 60 * 1000 };
      sessionStorage.setItem(TOKEN_KEY, JSON.stringify(saved));
      localStorage.setItem(CONNECTED_KEY, '1');
      setToken(saved);
      setOptedIn(true);
    } catch (e) {
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') return;
      if (e?.code === 'auth/user-mismatch') {
        setError('Please choose the same Google account you signed in with.');
        return;
      }
      console.error('Google Calendar connect failed:', e);
      setError(e?.message || 'Could not connect to Google Calendar.');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (token?.accessToken) {
      fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token.accessToken)}`, { method: 'POST' }).catch(() => {});
    }
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CONNECTED_KEY);
    setToken(null);
    setOptedIn(false);
    setEvents([]);
    setError(null);
  }, [token]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Expire the token in place when its time is up
  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => setToken(null), Math.max(0, token.expiresAt - Date.now()));
    return () => clearTimeout(t);
  }, [token]);

  useEffect(() => {
    if (status !== 'connected' || !rangeStart || !rangeEnd) {
      setEvents([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setIsFetching(true);
      setError(null);
      try {
        const timeMin = parseLocalDate(rangeStart).toISOString();
        const endDate = parseLocalDate(rangeEnd);
        endDate.setDate(endDate.getDate() + 1);
        const timeMax = endDate.toISOString();

        const calendarList = await googleFetch('/users/me/calendarList?minAccessRole=reader', token.accessToken);
        const calendars = (calendarList.items || []).filter((c) => c.selected || c.primary);

        const perCalendar = await Promise.all(calendars.map(async (calendar) => {
          const params = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
          try {
            const data = await googleFetch(`/calendars/${encodeURIComponent(calendar.id)}/events?${params}`, token.accessToken);
            return (data.items || [])
              .filter((e) => e.status !== 'cancelled')
              .flatMap((e) => toEntries(e, calendar, rangeStart, rangeEnd));
          } catch (e) {
            if (e.status === 401) throw e;
            console.warn(`Skipping calendar ${calendar.summary}:`, e);
            return [];
          }
        }));

        if (!cancelled) setEvents(perCalendar.flat());
      } catch (e) {
        if (cancelled) return;
        if (e.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          setToken(null);
        } else if (e.status === 403 && (e.reason === 'accessNotConfigured' || e.reason === 'SERVICE_DISABLED')) {
          setError('The Google Calendar API is not enabled for this Firebase project yet.');
        } else if (e.status === 403) {
          setError('Calendar access was not granted. Reconnect and tick the calendar permission.');
        } else {
          setError('Could not load Google Calendar events.');
        }
        console.error('Google Calendar fetch failed:', e);
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [status, token, rangeStart, rangeEnd, refreshKey]);

  return { status, events, isFetching, error, connect, disconnect, refresh };
}
