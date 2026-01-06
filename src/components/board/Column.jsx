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
    <div className="flex-shrink-0 w-72 flex flex-col bg-slate-100 rounded-xl">
      {/* Column Header */}
      <div className="flex items-center justify-between p-3">
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
            className="flex-1 px-2 py-1 text-sm font-semibold bg-white border border-blue-500 rounded outline-none"
          />
        ) : (
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            {column.name}
            <span className="text-xs font-normal text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded-full">
              {columnTasks.length}
            </span>
          </h3>
        )}

        <Dropdown
          align="right"
          trigger={
            <button className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          }
        >
          {({ close }) => (
            <>
              <DropdownItem onClick={() => { setIsRenaming(true); close(); }}>
                <Pencil className="w-4 h-4" /> Rename
              </DropdownItem>
              <DropdownItem danger onClick={() => { onDeleteColumn(column.id); close(); }}>
                <Trash2 className="w-4 h-4" /> Delete
              </DropdownItem>
            </>
          )}
        </Dropdown>
      </div>

      {/* Tasks */}
      <div
        ref={setNodeRef}
        className={`flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px] transition-colors ${
          isOver ? 'bg-blue-50' : ''
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
        className="flex items-center gap-2 m-2 p-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add task
      </button>
    </div>
  );
}
