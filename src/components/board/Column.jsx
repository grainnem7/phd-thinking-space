import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import TaskCard from './TaskCard';
import Dropdown, { DropdownItem } from '../common/Dropdown';
import { isDoneColumn } from '../../hooks/useBoards';

// `tasks` are this column's tasks, already in display order
export default function Column({
  column,
  tasks,
  isDropTarget = false,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onRenameColumn,
  onDeleteColumn,
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [columnName, setColumnName] = useState(column.name);
  const done = isDoneColumn(column);

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  const startRename = () => {
    setColumnName(column.name);
    setIsRenaming(true);
  };

  const handleRename = () => {
    if (!isRenaming) return;
    const name = columnName.trim();
    if (name && name !== column.name) {
      onRenameColumn(column.id, name);
    }
    setIsRenaming(false);
  };

  const highlighted = isOver || isDropTarget;

  return (
    <section
      ref={setNodeRef}
      aria-label={column.name}
      className={`flex-shrink-0 w-64 sm:w-72 max-h-full flex flex-col bg-white dark:bg-neutral-900 border rounded-xl transition-colors ${
        highlighted ? 'border-neutral-300 dark:border-neutral-700' : 'border-neutral-200 dark:border-neutral-800'
      }`}
    >
      {/* Column Header */}
      <div className="widget-header flex items-center justify-between gap-2 p-3 sm:p-4 border-b border-neutral-100 dark:border-neutral-800">
        {isRenaming ? (
          <>
            <label htmlFor={`column-name-${column.id}`} className="sr-only">Column name</label>
            <input
              id={`column-name-${column.id}`}
              type="text"
              value={columnName}
              onChange={(e) => setColumnName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setIsRenaming(false);
              }}
              autoFocus
              className="flex-1 min-w-0 px-2 py-1 text-base sm:text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-neutral-300 dark:focus:border-neutral-600 text-neutral-900 dark:text-neutral-100"
            />
          </>
        ) : (
          <h3 className="min-w-0 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 uppercase tracking-widest font-medium flex items-center gap-2">
            <span className="truncate">{column.name}</span>
            <span className="text-xs sm:text-sm text-neutral-400 dark:text-neutral-500 tabular-nums" aria-label={`${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`}>
              {tasks.length}
            </span>
          </h3>
        )}

        <Dropdown
          align="right"
          trigger={
            <button
              type="button"
              aria-label={`Actions for ${column.name}`}
              title="Column actions"
              className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors p-1.5 -m-1 rounded touch-manipulation"
            >
              <MoreHorizontal size={16} />
            </button>
          }
        >
          {({ close }) => (
            <>
              <DropdownItem onClick={() => { onAddTask(column.id); close(); }}>
                <Plus size={14} /> Add task
              </DropdownItem>
              <DropdownItem onClick={() => { startRename(); close(); }}>
                <Pencil size={14} /> Rename
              </DropdownItem>
              <DropdownItem danger onClick={() => { onDeleteColumn(column.id); close(); }}>
                <Trash2 size={14} /> Delete
              </DropdownItem>
            </>
          )}
        </Dropdown>
      </div>

      {/* Tasks */}
      <div
        className={`flex-1 min-h-[120px] sm:min-h-[160px] overflow-y-auto p-2 sm:p-3 space-y-2 transition-colors ${
          highlighted ? 'bg-neutral-50 dark:bg-neutral-800/40' : ''
        }`}
      >
        <SortableContext
          items={tasks.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              done={done}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="min-h-[100px] sm:min-h-[136px] flex items-center justify-center px-4 text-center text-sm text-neutral-400 dark:text-neutral-500 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg">
            {highlighted ? 'Drop here' : 'No tasks yet'}
          </div>
        )}
      </div>

      {/* Add Task Button */}
      <div className="p-2 sm:p-3 pt-0 sm:pt-0">
        <button
          type="button"
          onClick={() => onAddTask(column.id)}
          className="w-full flex items-center gap-2 px-2 py-2 text-sm text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors touch-manipulation"
        >
          <Plus size={16} aria-hidden="true" />
          Add task
        </button>
      </div>
    </section>
  );
}
