import { useEffect, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronUp, ChevronDown, EyeOff } from 'lucide-react';
import { WIDGET_SIZES } from '../../hooks/useDashboardLayout';

const cardClass = 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden flex flex-col';

const toolButton =
  'p-1.5 rounded text-neutral-400 hover:text-neutral-700 hover:bg-white dark:text-neutral-500 dark:hover:text-neutral-200 dark:hover:bg-neutral-900 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-600';

// Tailwind needs literal class names
const LG_SPAN = {
  1: 'lg:col-span-1', 2: 'lg:col-span-2', 3: 'lg:col-span-3', 4: 'lg:col-span-4',
  5: 'lg:col-span-5', 6: 'lg:col-span-6', 7: 'lg:col-span-7', 8: 'lg:col-span-8',
  9: 'lg:col-span-9', 10: 'lg:col-span-10', 11: 'lg:col-span-11', 12: 'lg:col-span-12',
};
const MD_SPAN = { 3: 'md:col-span-3', 6: 'md:col-span-6' };

export default function SortableWidget({
  id,
  title,
  size,
  span,
  heightClass = '',
  editing,
  isFirst,
  isLast,
  onMove,
  onHide,
  onResize,
  takeFocusRequest,
  children,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !editing });

  const handleRef = useRef(null);
  const upRef = useRef(null);
  const downRef = useRef(null);

  // Keep keyboard focus on the control that was used after the widget moves
  useEffect(() => {
    const action = takeFocusRequest?.(id);
    if (!action) return;
    const preferred = action === 'up' ? upRef.current : downRef.current;
    const target = preferred && !preferred.disabled ? preferred : handleRef.current;
    target?.focus();
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const spanClass = `${MD_SPAN[span?.md] || 'md:col-span-6'} ${LG_SPAN[span?.lg] || 'lg:col-span-4'}`;

  return (
    <section
      ref={setNodeRef}
      style={style}
      aria-label={title}
      className={`${spanClass} ${heightClass} ${cardClass} ${
        editing ? 'ring-1 ring-neutral-200 dark:ring-neutral-800' : ''
      } ${isDragging ? 'relative z-20 shadow-xl dark:shadow-black/50 opacity-90' : ''}`}
    >
      {editing && (
        <div className="flex items-center gap-1 px-2 py-1.5 bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0">
          <button
            type="button"
            ref={(node) => { setActivatorNodeRef(node); handleRef.current = node; }}
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${title}. Press space to pick up, arrow keys to move, space to drop.`}
            title="Drag to reorder"
            style={{ touchAction: 'none' }}
            className={`${toolButton} cursor-grab active:cursor-grabbing`}
          >
            <GripVertical size={18} aria-hidden="true" />
          </button>
          <span className="flex-1 min-w-0 truncate text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-widest font-medium">
            {title}
          </span>

          <div role="group" aria-label={`${title} size`} className="hidden md:flex items-center rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden mr-1">
            {WIDGET_SIZES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onResize(id, s.id)}
                aria-pressed={size === s.id}
                title={`${s.label}${s.hint ? ` (${s.hint})` : ''}`}
                aria-label={s.label}
                className={`w-7 py-1 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-600 ${
                  size === s.id
                    ? 'bg-accent text-accent-fg'
                    : 'bg-white text-neutral-500 hover:text-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
                }`}
              >
                <span aria-hidden="true">{s.short}</span>
              </button>
            ))}
          </div>

          <button ref={upRef} type="button" onClick={() => onMove(id, -1)} disabled={isFirst} aria-label={`Move ${title} up`} title="Move up" className={toolButton}>
            <ChevronUp size={18} aria-hidden="true" />
          </button>
          <button ref={downRef} type="button" onClick={() => onMove(id, 1)} disabled={isLast} aria-label={`Move ${title} down`} title="Move down" className={toolButton}>
            <ChevronDown size={18} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => onHide(id)} aria-label={`Hide ${title}`} title="Hide" className={toolButton}>
            <EyeOff size={18} aria-hidden="true" />
          </button>
        </div>
      )}
      <div
        inert={editing}
        className={`flex-1 flex flex-col min-h-0 ${editing ? 'opacity-60 pointer-events-none select-none' : ''}`}
      >
        {children}
      </div>
    </section>
  );
}
