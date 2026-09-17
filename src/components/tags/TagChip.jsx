import { X } from 'lucide-react';
import { openTagView } from '../../lib/tags';

// A `#tag` chip. Clicking it opens the Tags view filtered to the tag (unless
// `onClick` is given, or `navigable` is false); `onRemove` adds a remove button.
export default function TagChip({ tag, onClick, onRemove, navigable = true, active = false, count, size = 'sm', className = '' }) {
  const text = size === 'xs' ? 'text-xs' : 'text-xs sm:text-sm';
  const tone = active
    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-neutral-100';

  return (
    <span className={`inline-flex items-center max-w-full rounded-full transition-colors ${tone} ${text} ${className}`}>
      {!onClick && !navigable ? (
        <span className={`truncate ${onRemove ? 'pl-2 pr-0.5' : 'px-2'} py-0.5`}>
          <span className="opacity-60">#</span>{tag}
        </span>
      ) : (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (onClick) onClick(tag);
          else openTagView(tag);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        aria-pressed={onClick ? active : undefined}
        title={onClick ? undefined : `Show everything tagged #${tag}`}
        className={`truncate ${onRemove ? 'pl-2 pr-0.5' : 'px-2'} py-0.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-600`}
      >
        <span className="opacity-60">#</span>{tag}
        {count !== undefined && <span className="ml-1.5 tabular-nums opacity-60">{count}</span>}
      </button>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(tag); }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`Remove tag ${tag}`}
          title="Remove tag"
          className="p-1 mr-0.5 rounded-full opacity-60 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-600"
        >
          <X size={11} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
