import { useState } from 'react';
import { RefreshCw, Plus, LogOut, RotateCw, AlertCircle } from 'lucide-react';
import Modal from '../common/Modal';
import { useConfirm } from '../common/ConfirmDialog';

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

const PILL = 'inline-flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg transition-colors hover:border-neutral-300 dark:hover:border-neutral-600';
const SMALL_BUTTON = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-600 hover:text-neutral-900 dark:hover:text-neutral-100';

function AccountCard({ account, onReconnect, onRemove, onToggleCalendar }) {
  const initial = (account.name || account.email || '?').trim().charAt(0).toUpperCase();
  return (
    <li className="p-3 sm:p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
      <div className="flex items-center gap-3">
        {account.photoURL ? (
          <img src={account.photoURL} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full flex-shrink-0" />
        ) : (
          <span className="w-8 h-8 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 text-sm font-medium text-neutral-600 dark:text-neutral-300 flex-shrink-0" aria-hidden="true">
            {initial}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{account.email}</p>
          <p className={`text-xs ${account.connected ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
            {account.connected ? 'Connected' : 'Access expired — reconnect to see events'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!account.connected && (
            <button type="button" onClick={() => onReconnect(account.email)} className={SMALL_BUTTON}>
              <RotateCw size={13} aria-hidden="true" /> Reconnect
            </button>
          )}
          <button type="button" onClick={() => onRemove(account)} className={SMALL_BUTTON} aria-label={`Remove ${account.email}`}>
            <LogOut size={13} aria-hidden="true" /> <span className="hidden sm:inline">Remove</span>
          </button>
        </div>
      </div>

      {account.error && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle size={14} className="flex-shrink-0 mt-px" aria-hidden="true" /> {account.error}
        </p>
      )}

      {account.connected && account.calendars.length > 0 && (
        <fieldset className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
          <legend className="sr-only">Calendars from {account.email}</legend>
          <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
            {account.calendars.map((calendar) => {
              const shown = !(account.hiddenCalendars || []).includes(calendar.id);
              return (
                <li key={calendar.id}>
                  <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-200 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      checked={shown}
                      onChange={(e) => onToggleCalendar(account.email, calendar.id, !e.target.checked)}
                      className="w-4 h-4 rounded flex-shrink-0"
                      style={{ accentColor: calendar.color }}
                    />
                    <span className="truncate">{calendar.name}</span>
                    {calendar.primary && <span className="text-xs text-neutral-400 dark:text-neutral-500 flex-shrink-0">Main</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}
    </li>
  );
}

export default function GoogleCalendarControl({ google }) {
  const [open, setOpen] = useState(false);
  const confirm = useConfirm();
  const { status, accounts, isFetching, connect, reconnect, removeAccount, setCalendarHidden, refresh, error } = google;

  if (status === 'unavailable') return null;

  const connectedCount = accounts.filter((a) => a.connected).length;
  const expiredCount = accounts.length - connectedCount;

  const handleRemove = async (account) => {
    const ok = await confirm({
      title: `Remove ${account.email}?`,
      body: 'Its events will no longer show in your calendar. Nothing is changed in Google Calendar.',
      confirmLabel: 'Remove',
      danger: false,
    });
    if (ok) removeAccount(account.email);
  };

  return (
    <>
      {accounts.length === 0 ? (
        <button type="button" onClick={() => setOpen(true)} className={`${PILL} px-3 py-2`}>
          <GoogleMark />
          <span>Connect<span className="hidden sm:inline"> Google Calendar</span></span>
        </button>
      ) : (
        <div className={`${PILL} pl-1 pr-1 py-1`}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-800"
            title="Manage Google accounts and calendars"
          >
            <GoogleMark />
            <span className="hidden sm:inline">Google</span>
            <span className="text-xs tabular-nums text-neutral-400 dark:text-neutral-500">
              {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
            </span>
            {expiredCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500" title={`${expiredCount} need reconnecting`} aria-label={`${expiredCount} need reconnecting`} />
            )}
          </button>
          {connectedCount > 0 && (
            <button type="button" onClick={refresh} aria-label="Refresh Google Calendar events" title="Refresh" className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded">
              <RefreshCw size={14} className={isFetching ? 'animate-spin motion-reduce:animate-none' : ''} />
            </button>
          )}
        </div>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Google Calendar" size="lg">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Show events from one or more Google accounts. It's read-only: nothing is changed in Google Calendar.
          Google only allows an hour of access at a time, so you'll sometimes need to reconnect.
        </p>

        {error && (
          <p role="alert" className="mt-4 px-3 py-2.5 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900 rounded-lg">
            {error}
          </p>
        )}

        {accounts.length > 0 && (
          <ul className="mt-4 space-y-3">
            {accounts.map((account) => (
              <AccountCard
                key={account.email}
                account={account}
                onReconnect={reconnect}
                onRemove={handleRemove}
                onToggleCalendar={setCalendarHidden}
              />
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => connect()}
          className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 text-sm rounded-lg bg-accent text-accent-fg hover:bg-accent-hover"
        >
          <Plus size={16} aria-hidden="true" />
          {accounts.length ? 'Add another Google account' : 'Connect a Google account'}
        </button>
      </Modal>
    </>
  );
}
