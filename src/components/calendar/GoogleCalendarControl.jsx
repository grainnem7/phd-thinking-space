import { RefreshCw, Unlink } from 'lucide-react';

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

const BUTTON = 'inline-flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors';

export default function GoogleCalendarControl({ google }) {
  const { status, isFetching, connect, disconnect, refresh } = google;

  if (status === 'unavailable') return null;

  if (status === 'connected') {
    return (
      <div className="inline-flex items-center gap-1 pl-3 pr-1 py-1 text-sm text-neutral-600 dark:text-neutral-300 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg">
        <GoogleMark />
        <span className="hidden sm:inline ml-1">Google Calendar</span>
        <button type="button" onClick={refresh} aria-label="Refresh Google Calendar events" title="Refresh" className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded">
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
        </button>
        <button type="button" onClick={disconnect} aria-label="Disconnect Google Calendar" title="Disconnect" className="p-1.5 text-neutral-400 hover:text-rose-600 rounded">
          <Unlink size={14} />
        </button>
      </div>
    );
  }

  return (
    <button type="button" onClick={connect} className={BUTTON} title={status === 'expired' ? 'Google access lasts an hour — reconnect to refresh it' : undefined}>
      <GoogleMark />
      <span>{status === 'expired' ? 'Reconnect' : 'Connect'}<span className="hidden sm:inline"> Google Calendar</span></span>
    </button>
  );
}
