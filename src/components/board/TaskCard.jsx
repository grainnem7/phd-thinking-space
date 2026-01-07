import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, MoreHorizontal, Trash2, Pencil } from 'lucide-react';
import Dropdown, { DropdownItem } from '../common/Dropdown';

const priorityColors = {
  low: 'bg-neutral-300',
  medium: 'bg-neutral-400',
  high: 'bg-amber-600',
};

export default function TaskCard({ task, onEdit, onDelete }) {
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

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group bg-neutral-50 border border-neutral-100 rounded-lg p-2.5 sm:p-3 cursor-grab active:cursor-grabbing hover:border-neutral-200 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priorityColors[task.priority]}`} />
          <h4 className="text-sm sm:text-base text-neutral-900 font-medium truncate">{task.title}</h4>
        </div>
        <Dropdown
          align="right"
          trigger={
            <button
              onClick={(e) => e.stopPropagation()}
              className="sm:opacity-0 sm:group-hover:opacity-100 text-neutral-400 sm:text-neutral-300 hover:text-neutral-500 transition-all flex-shrink-0"
            >
              <MoreHorizontal size={14} />
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

      {task.description && (
        <p className="text-xs sm:text-sm text-neutral-500 mt-1.5 sm:mt-2 line-clamp-2">{task.description}</p>
      )}

      {task.tags?.length > 0 && (
        <div className="flex items-center gap-1.5 sm:gap-2 mt-2 sm:mt-3 flex-wrap">
          {task.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="text-xs sm:text-sm text-neutral-500 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-neutral-100 rounded"
            >
              {tag}
            </span>
          ))}
          {task.tags.length > 2 && (
            <span className="text-xs text-neutral-400">+{task.tags.length - 2}</span>
          )}
        </div>
      )}

      {task.dueDate && (
        <div className="flex items-center gap-1.5 mt-2 sm:mt-3 text-xs sm:text-sm text-neutral-500">
          <Calendar size={12} className="sm:w-3.5 sm:h-3.5" />
          <span>{formatDate(task.dueDate)}</span>
        </div>
      )}
    </div>
  );
}
