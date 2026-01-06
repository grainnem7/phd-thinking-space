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
      className="group bg-neutral-50 border border-neutral-100 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-neutral-200 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${priorityColors[task.priority]}`} />
          <h4 className="text-sm text-neutral-900">{task.title}</h4>
        </div>
        <Dropdown
          align="right"
          trigger={
            <button
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 text-neutral-300 hover:text-neutral-500 transition-all"
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
        <p className="text-xs text-neutral-400 mt-2 line-clamp-2">{task.description}</p>
      )}

      {task.tags?.length > 0 && (
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs text-neutral-400 px-2 py-0.5 bg-neutral-100 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {task.dueDate && (
        <div className="flex items-center gap-1 mt-2 text-xs text-neutral-400">
          <Calendar size={12} />
          <span>{formatDate(task.dueDate)}</span>
        </div>
      )}
    </div>
  );
}
