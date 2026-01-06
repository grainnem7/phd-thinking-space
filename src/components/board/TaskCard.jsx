import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, MoreHorizontal, Trash2, Pencil } from 'lucide-react';
import Dropdown, { DropdownItem } from '../common/Dropdown';

const priorityColors = {
  low: 'bg-green-500',
  medium: 'bg-yellow-500',
  high: 'bg-red-500',
};

const tagColors = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-pink-100 text-pink-700',
  'bg-orange-100 text-orange-700',
  'bg-teal-100 text-teal-700',
];

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
      className="group bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${priorityColors[task.priority]}`} />
          <h4 className="text-sm font-medium text-slate-900">{task.title}</h4>
        </div>
        <Dropdown
          align="right"
          trigger={
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-100 rounded transition-all"
            >
              <MoreHorizontal className="w-4 h-4 text-slate-400" />
            </button>
          }
        >
          {({ close }) => (
            <>
              <DropdownItem onClick={() => { onEdit(task); close(); }}>
                <Pencil className="w-4 h-4" /> Edit
              </DropdownItem>
              <DropdownItem danger onClick={() => { onDelete(task.id); close(); }}>
                <Trash2 className="w-4 h-4" /> Delete
              </DropdownItem>
            </>
          )}
        </Dropdown>
      </div>

      {task.description && (
        <p className="text-sm text-slate-600 mt-2 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {task.tags?.map((tag, index) => (
          <span
            key={tag}
            className={`text-xs px-2 py-0.5 rounded-full ${tagColors[index % tagColors.length]}`}
          >
            {tag}
          </span>
        ))}
      </div>

      {task.dueDate && (
        <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
          <Calendar className="w-3 h-3" />
          <span>{formatDate(task.dueDate)}</span>
        </div>
      )}
    </div>
  );
}
