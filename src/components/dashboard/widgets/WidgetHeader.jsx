import { Plus } from 'lucide-react';

export default function WidgetHeader({ title, onAdd, addLabel, actions }) {
  const label = addLabel || `Add to ${title}`;
  return (
    <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between flex-shrink-0">
      <h2 className="text-sm text-neutral-500 dark:text-neutral-400 uppercase tracking-widest font-medium">{title}</h2>
      <div className="flex items-center gap-2">
        {actions}
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            aria-label={label}
            title={label}
            className="text-neutral-300 hover:text-neutral-500 dark:text-neutral-600 dark:hover:text-neutral-300 transition-colors p-1.5 -m-1 rounded touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-600"
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
