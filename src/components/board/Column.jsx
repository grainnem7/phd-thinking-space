import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import TaskCard from './TaskCard';
import Dropdown, { DropdownItem } from '../common/Dropdown';

export default function Column({
  column,
  tasks,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onRenameColumn,
  onDeleteColumn,
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [columnName, setColumnName] = useState(column.name);

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  const handleRename = () => {
    if (columnName.trim() && columnName !== column.name) {
      onRenameColumn(column.id, columnName.trim());
    }
    setIsRenaming(false);
  };

  const columnTasks = tasks
    .filter(task => task.columnId === column.id)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="flex-shrink-0 w-72 flex flex-col bg-white border border-neutral-200 rounded-xl">
      {/* Column Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-100">
        {isRenaming ? (
          <input
            type="text"
            value={columnName}
            onChange={(e) => setColumnName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') {
                setColumnName(column.name);
                setIsRenaming(false);
              }
            }}
            autoFocus
            className="flex-1 px-2 py-1 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300"
          />
        ) : (
          <h3 className="text-xs text-neutral-400 uppercase tracking-widest font-medium flex items-center gap-2">
            {column.name}
            <span className="text-xs text-neutral-300">
              {columnTasks.length}
            </span>
          </h3>
        )}

        <Dropdown
          align="right"
          trigger={
            <button className="text-neutral-300 hover:text-neutral-500 transition-colors">
              <MoreHorizontal size={15} />
            </button>
          }
        >
          {({ close }) => (
            <>
              <DropdownItem onClick={() => { setIsRenaming(true); close(); }}>
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
        ref={setNodeRef}
        className={`flex-1 p-3 space-y-2 overflow-y-auto min-h-[200px] transition-colors ${
          isOver ? 'bg-neutral-50' : ''
        }`}
      >
        <SortableContext
          items={columnTasks.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {columnTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
            />
          ))}
        </SortableContext>
      </div>

      {/* Add Task Button */}
      <button
        onClick={() => onAddTask(column.id)}
        className="flex items-center gap-2 m-3 mt-0 p-2 text-sm text-neutral-400 hover:text-neutral-600 transition-colors"
      >
        <Plus size={15} />
        Add task
      </button>
    </div>
  );
}
