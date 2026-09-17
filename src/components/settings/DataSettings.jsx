import { useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { Download, FileArchive, Info } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useFirestore } from '../../hooks/useFirestore';

const lastBackupKey = (uid) => `last-backup:${uid || 'anonymous'}`;

function readLastBackup(uid) {
  try {
    const value = localStorage.getItem(lastBackupKey(uid));
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  } catch {
    return null;
  }
}

function writeLastBackup(uid, date) {
  try {
    localStorage.setItem(lastBackupKey(uid), date.toISOString());
  } catch {
    // Storage unavailable: the time just isn't remembered
  }
}

function ActionCard({ icon, title, description, buttonLabel, busyLabel, busy, disabled, onClick }) {
  const Icon = icon;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 rounded-xl">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <Icon size={18} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-neutral-400 dark:text-neutral-500" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{title}</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{description}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={busy || disabled}
        className="self-end sm:self-auto flex-shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-600"
      >
        {busy ? busyLabel : buttonLabel}
      </button>
    </div>
  );
}

// Export-only backup of all data (no import/restore).
export default function DataSettings() {
  const { user, isDemo } = useAuth();
  const { sections } = useFirestore();
  const uid = user?.uid;
  const [lastBackup, setLastBackup] = useState(() => readLastBackup(uid));
  const [busy, setBusy] = useState(null); // 'backup' | 'markdown'
  const [message, setMessage] = useState(null);

  const handleBackup = async () => {
    if (!user) return;
    setBusy('backup');
    setMessage(null);
    try {
      const { downloadBackup } = await import('../../lib/backup');
      const backup = await downloadBackup({ user, isDemo });
      const when = new Date();
      writeLastBackup(uid, when);
      setLastBackup(when);
      setMessage(backup.errors
        ? { error: true, text: `Backup downloaded, but some data couldn't be read: ${Object.keys(backup.errors).join(', ')}.` }
        : { text: 'Backup downloaded.' });
    } catch (err) {
      console.error('Backup failed:', err);
      setMessage({ error: true, text: "Couldn't create the backup. Check your connection and try again." });
    } finally {
      setBusy(null);
    }
  };

  const handleMarkdown = async () => {
    setBusy('markdown');
    setMessage(null);
    try {
      const { downloadNotesMarkdown } = await import('../../lib/backup');
      const count = await downloadNotesMarkdown(sections);
      setMessage({ text: `Exported ${count} ${count === 1 ? 'note' : 'notes'} as Markdown.` });
    } catch (err) {
      console.error('Markdown export failed:', err);
      setMessage({ error: true, text: "Couldn't export your notes. Please try again." });
    } finally {
      setBusy(null);
    }
  };

  const noteCount = sections.filter((s) => s.type === 'note' || !s.type).length;

  return (
    <div className="space-y-6">
      <section aria-labelledby="backup-heading">
        <h3 id="backup-heading" className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-widest font-medium mb-3">Backup</h3>
        <div className="space-y-3">
          <ActionCard
            icon={Download}
            title="Download backup"
            description={isDemo
              ? 'A JSON file with everything in this demo session.'
              : 'A JSON file with all your notes, boards, papers, calendar, dashboard, reviews, templates and settings — including items in Trash.'}
            buttonLabel="Download backup"
            busyLabel="Preparing…"
            busy={busy === 'backup'}
            disabled={!user || Boolean(busy)}
            onClick={handleBackup}
          />
          <ActionCard
            icon={FileArchive}
            title="Export notes as Markdown"
            description={`A .zip with one Markdown file per note (${noteCount}), in folders matching your sidebar.`}
            buttonLabel="Export .zip"
            busyLabel="Exporting…"
            busy={busy === 'markdown'}
            disabled={Boolean(busy) || noteCount === 0}
            onClick={handleMarkdown}
          />
        </div>
      </section>

      <div role="status" aria-live="polite">
        {message && (
          <p className={`text-sm ${message.error ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
            {message.text}
          </p>
        )}
      </div>

      <div className="space-y-2 text-sm text-neutral-500 dark:text-neutral-400">
        <p>
          Last backup:{' '}
          <span className="text-neutral-900 dark:text-neutral-100">
            {lastBackup
              ? <time dateTime={lastBackup.toISOString()} title={format(lastBackup, 'd MMM yyyy, HH:mm')}>{formatDistanceToNow(lastBackup, { addSuffix: true })}</time>
              : 'Never on this device'}
          </span>
        </p>
        <p className="flex items-start gap-2">
          <Info size={14} aria-hidden="true" className="mt-0.5 flex-shrink-0" />
          <span>Attached PDFs aren’t included — keep your own copies of those files. Backups are for safekeeping; they can’t be imported back yet.</span>
        </p>
      </div>
    </div>
  );
}
