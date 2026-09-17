import { AlertCircle, X } from 'lucide-react';

// Dismissible inline error used across the reading list instead of alert().
export default function InlineError({ message, onDismiss, className = '' }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={`flex items-start gap-2 px-3 py-2 text-sm rounded-lg border bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300 ${className}`}
    >
      <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
      <span className="flex-1 min-w-0 break-words">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          title="Dismiss"
          className="shrink-0 -m-1 p-1 rounded text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-200 transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
