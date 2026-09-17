import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, MoreHorizontal, Trash2, Pencil } from 'lucide-react';
import Dropdown, { DropdownItem } from '../common/Dropdown';
import { daysUntil, parseLocalDate } from '../../utils/date';
import TagChip from '../tags/TagChip';
import { cleanTags } from '../../lib/tags';

const priorityColors = {
  low: 'bg-neutral-300 dark:bg-neutral-600',
  medium: 'bg-neutral-400 dark:bg-neutral-500',
  high: 'bg-amber-600 dark:bg-amber-500',
};

const priorityLabels = { low: 'Low priority', medium: 'Medium priority', high: 'High priority' };

function dueInfo(dateStr, done) {
  const date = parseLocalDate(dateStr);
  if (!date) return null;
  const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (done) return { label, tone: 'text-neutral-400 dark:text-neutral-500' };

  const days = daysUntil(dateStr);
  if (days < 0) {
    return { label, note: 'Overdue', tone: 'text-rose-600 dark:text-rose-400 font-medium' };
  }
  if (days <= 2) {
    return {
      label,
      note: days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : 'In 2 days',
      tone: 'text-amber-700 dark:text-amber-400 font-medium',
    };
  }
  return { label, tone: 'text-neutral-500 dark:text-neutral-400' };
}

// Card content without drag behaviour (also used for the drag overlay)
export function TaskCardBody({ task, done = false, actions = null, interactive = true }) {
  const due = dueInfo(task.dueDate, done);
  const tags = cleanTags(task.tags);
  const priority = priorityColors[task.priority] ? task.priority : 'medium';

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            role="img"
            aria-label={priorityLabels[priority]}
            title={priorityLabels[priority]}
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priorityColors[priority]}`}
          />
          <h4 className={`text-sm sm:text-base font-medium truncate ${done ? 'text-neutral-500 dark:text-neutral-400' : 'text-neutral-900 dark:text-neutral-100'}`}>
            {task.title}
          </h4>
        </div>
        {actions}
      </div>

      {task.description && (
        <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 sm:mt-2 line-clamp-2">{task.description}</p>
      )}

      {tags.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2 sm:mt-3 flex-wrap">
          {tags.slice(0, 3).map((tag) => (
            <TagChip key={tag} tag={tag} size="xs" navigable={interactive} />
          ))}
          {tags.length > 3 && (
            <span className="text-xs text-neutral-400 dark:text-neutral-500" title={tags.slice(3).map((t) => `#${t}`).join(' ')}>
              +{tags.length - 3}
            </span>
          )}
        </div>
      )}

      {due && (
        <div className={`flex items-center gap-1.5 mt-2 sm:mt-3 text-xs sm:text-sm ${due.tone}`}>
          <Calendar size={12} className="sm:w-3.5 sm:h-3.5 flex-shrink-0" aria-hidden="true" />
          <span>
            <span className="sr-only">Due </span>
            {due.label}
            {due.note && <span> · {due.note}</span>}
          </span>
        </div>
      )}
    </>
  );
}

const CARD_CLASS = 'group bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-100 dark:border-neutral-800 rounded-lg p-2.5 sm:p-3';

export function TaskCardOverlay({ task, done }) {
  return (
    <div className={`${CARD_CLASS} cursor-grabbing shadow-lg dark:shadow-black/40 border-neutral-200 dark:border-neutral-700`}>
      <TaskCardBody task={task} done={done} interactive={false} />
    </div>
  );
}

export default function TaskCard({ task, done = false, onEdit, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const actions = (
    // Keep clicks and key presses on the menu from opening the card or starting a keyboard drag
    <div
      className="flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus-within:opacity-100 transition-opacity"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Dropdown
        align="right"
        trigger={
          <button
            type="button"
            aria-label={`Actions for ${task.title}`}
            title="Task actions"
            className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors p-1.5 -m-1 rounded touch-manipulation"
          >
            <MoreHorizontal size={16} />
          </button>
        }
      >
        {({ close }) => (
          <>
            <DropdownItem onClick={() => { onEdit(task); close(); }}>
              <Pencil size={14} /> Edit
            </DropdownItem>
            <DropdownItem danger onClick={() => { onDelete(task.id); close(); }}>
              <Trash2 size={14} /> Delete
            </DropdownItem>
          </>
        )}
      </Dropdown>
    </div>
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onEdit(task)}
      className={`${CARD_CLASS} cursor-grab active:cursor-grabbing hover:border-neutral-200 dark:hover:border-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-600 transition-colors`}
    >
      <TaskCardBody task={task} done={done} actions={actions} />
    </div>
  );
}
