import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useCalendar } from '../../hooks/useCalendar';
import { useDashboard } from '../../hooks/useDashboard';
import {
  subscribeGoogleAccounts,
  getGoogleAccountsSnapshot,
  getActiveGoogleAccounts,
  markGoogleTokenExpired,
  setGoogleSyncStatus,
} from '../../hooks/useGoogleCalendar';
import { syncGoogleAccounts } from '../../lib/googleSync';

const DEBOUNCE_MS = 4000;
const POLL_MS = 2 * 60 * 1000;

function describe(error) {
  if (!error) return null;
  if (error.status === 403 && (error.reason === 'accessNotConfigured' || error.reason === 'SERVICE_DISABLED')) {
    return 'The Google Calendar API is not enabled for this Firebase project yet.';
  }
  if (error.status === 403 && /insufficient/i.test(error.reason || '')) {
    return 'Reconnect this account to allow adding events to Google Calendar.';
  }
  if (error.status === 403) return 'Google refused access to this account’s calendars.';
  if (error.status === 429) return 'Google is rate-limiting requests; sync will retry shortly.';
  if (error.code === 'mass-delete') return error.message;
  return 'Sync failed; it will retry automatically.';
}

// Keeps the "Thinking Space" calendar in each connected Google account in step
// with the app, whenever data changes, every couple of minutes while visible,
// and right after an account (re)connects. Renders nothing.
export default function GoogleCalendarSync() {
  const { user, isDemo } = useAuth();
  const { items, isLoading: itemsLoading, updateItem, deleteItem } = useCalendar();
  const { deadlines, deadlinesLoaded, updateDeadline, deleteDeadline } = useDashboard();
  const google = useSyncExternalStore(subscribeGoogleAccounts, getGoogleAccountsSnapshot, getGoogleAccountsSnapshot);

  const latest = useRef({});
  useEffect(() => {
    latest.current = { items, deadlines, updateItem, deleteItem, updateDeadline, deleteDeadline };
  });

  const running = useRef(false);
  const rerun = useRef(false);

  const ready = Boolean(user) && !isDemo && !itemsLoading && deadlinesLoaded;
  // Only the parts of account state that should trigger a sync
  const accountsKey = google.accounts
    .map((a) => `${a.email}:${a.syncEnabled !== false}:${(a.hiddenCalendars || []).join(',')}:${google.tokens[a.email]?.expiresAt || 0}`)
    .join('|');

  useEffect(() => {
    if (!ready) return;

    const run = async () => {
      if (running.current) { rerun.current = true; return; }
      const accounts = getActiveGoogleAccounts();
      if (!accounts.some((a) => a.syncEnabled)) return;

      running.current = true;
      accounts.filter((a) => a.syncEnabled).forEach((a) => setGoogleSyncStatus(a.email, { running: true }));
      try {
        const app = latest.current;
        const { results, appChanged } = await syncGoogleAccounts(accounts, {
          events: app.items,
          deadlines: app.deadlines,
          updateEvent: app.updateItem,
          deleteEvent: app.deleteItem,
          updateDeadline: app.updateDeadline,
          deleteDeadline: app.deleteDeadline,
        });
        for (const account of accounts) {
          const result = results[account.email];
          if (result?.error?.status === 401) markGoogleTokenExpired(account.email);
          setGoogleSyncStatus(account.email, {
            running: false,
            ...(result && !result.error ? { lastSyncedAt: Date.now(), error: null } : {}),
            ...(result?.error ? { error: describe(result.error) } : {}),
          });
          if (result?.error && result.error.status !== 401) console.error(`Google sync failed for ${account.email}:`, result.error);
        }
        if (appChanged) rerun.current = true;
      } catch (e) {
        console.error('Google sync failed:', e);
      } finally {
        running.current = false;
        accounts.forEach((a) => setGoogleSyncStatus(a.email, { running: false }));
        if (rerun.current) {
          rerun.current = false;
          setTimeout(run, DEBOUNCE_MS);
        }
      }
    };

    const debounce = setTimeout(run, DEBOUNCE_MS);
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') run();
    }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') run(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(debounce);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ready, items, deadlines, accountsKey]);

  return null;
}
