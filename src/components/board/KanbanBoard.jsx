import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter, pointerWithin, rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { Plus, Layout } from 'lucide-react';
import { useBoards } from '../../hooks/useBoards';
import Column from './Column';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import Button from '../common/Button';

export default function KanbanBoard({ board }) {
  const [activeTask, setActiveTask] = useState(null);
  const [activeColumn, setActiveColumn] = useState(null);
  const [modalState, setModalState] = useState({ isOpen: false, task: null, columnId: null });
  const [newColumnName, setNewColumnName] = useState('');
  const [showAddColumn, setShowAddColumn] = useState(false);

  const {
    addColumn,
    updateColumn,
    deleteColumn,
    addTask,
    updateTask,
    deleteTask,
    reorderTasks,
  } = useBoards(board?.id);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const columns = board?.columns || [];
  const tasks = board?.tasks || [];

  // Custom collision detection
  const collisionDetectionStrategy = useCallback((args) => {
    const columnIds = new Set(columns.map(c => c.id));
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      const columnCollision = pointerCollisions.find(c => columnIds.has(c.id));
      if (columnCollision) return [columnCollision];
      return [pointerCollisions[0]];
    }
    const intersectionCollisions = rectIntersection(args);
    if (intersectionCollisions.length > 0) {
      const columnCollision = intersectionCollisions.find(c => columnIds.has(c.id));
      if (columnCollision) return [columnCollision];
      return [intersectionCollisions[0]];
    }
    return closestCenter(args);
  }, [columns]);

  if (!board) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#fafafa]">
        <div className="text-center">
          <p className="text-base text-neutral-500">No board selected</p>
          <p className="text-sm text-neutral-400 mt-1">Select a board from the sidebar to view tasks</p>
        </div>
      </div>
    );
  }


  const findColumn = (id) => {
    const column = columns.find(c => c.id === id);
    if (column) return column.id;
    const task = tasks.find(t => t.id === id);
    if (task) return task.columnId;
    return null;
  };

  const handleDragStart = (event) => {
    const { active } = event;
    const task = tasks.find(t => t.id === active.id);
    if (task) {
      setActiveTask(task);
      setActiveColumn(task.columnId);
    }
  };

  const handleDragOver = (event) => {
    const { over } = event;
    if (!over) return;
    const overColumnId = findColumn(over.id);
    if (overColumnId && overColumnId !== activeColumn) {
      setActiveColumn(overColumnId);
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveTask(null);
    setActiveColumn(null);

    if (!over) return;

    const activeTask = tasks.find(t => t.id === active.id);
    if (!activeTask) return;

    // Check if dropped over a column or a task
    const overColumn = columns.find(c => c.id === over.id);
    const overTask = tasks.find(t => t.id === over.id);

    let newColumnId = activeTask.columnId;
    let newOrder = activeTask.order;

    if (overColumn) {
      // Dropped directly on a column
      newColumnId = overColumn.id;
      const columnTasks = tasks.filter(t => t.columnId === newColumnId);
      newOrder = columnTasks.length;
    } else if (overTask) {
      // Dropped on a task
      newColumnId = overTask.columnId;
      newOrder = overTask.order;
    }

    if (activeTask.columnId !== newColumnId || activeTask.order !== newOrder) {
      const updatedTasks = tasks.map(task => {
        if (task.id === activeTask.id) {
          return { ...task, columnId: newColumnId, order: newOrder };
        }
        // Adjust order of other tasks in the target column
        if (task.columnId === newColumnId && task.order >= newOrder && task.id !== activeTask.id) {
          return { ...task, order: task.order + 1 };
        }
        return task;
      });

      reorderTasks(updatedTasks);
    }
  };

  const handleAddColumn = () => {
    if (newColumnName.trim()) {
      addColumn(columns, newColumnName.trim());
      setNewColumnName('');
      setShowAddColumn(false);
    }
  };

  const handleRenameColumn = (columnId, newName) => {
    updateColumn(columns, columnId, { name: newName });
  };

  const handleDeleteColumn = (columnId) => {
    deleteColumn(columns, tasks, columnId);
  };

  const handleAddTask = (columnId) => {
    setModalState({ isOpen: true, task: null, columnId });
  };

  const handleEditTask = (task) => {
    setModalState({ isOpen: true, task, columnId: task.columnId });
  };

  const handleDeleteTask = (taskId) => {
    deleteTask(tasks, taskId);
  };

  const handleSaveTask = (taskData) => {
    if (taskData.id) {
      updateTask(tasks, taskData.id, taskData);
    } else {
      addTask(tasks, taskData);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#fafafa]">
      {/* Board Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-neutral-100 bg-white">
        <h2 className="font-serif text-xl sm:text-2xl font-medium text-neutral-900 tracking-tight">{board.name}</h2>
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-x-auto p-4 sm:p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetectionStrategy}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 sm:gap-4 h-full">
            {columns
              .sort((a, b) => a.order - b.order)
              .map((column) => (
                <Column
                  key={column.id}
                  column={column}
                  tasks={tasks}
                  onAddTask={handleAddTask}
                  onEditTask={handleEditTask}
                  onDeleteTask={handleDeleteTask}
                  onRenameColumn={handleRenameColumn}
                  onDeleteColumn={handleDeleteColumn}
                />
              ))}

            {/* Add Column */}
            {showAddColumn ? (
              <div className="flex-shrink-0 w-64 sm:w-72 bg-white border border-neutral-200 rounded-xl p-3">
                <input
                  type="text"
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  placeholder="Column name..."
                  autoFocus
                  className="w-full px-3 py-2 text-sm sm:text-base bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300 placeholder:text-neutral-400"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddColumn();
                    if (e.key === 'Escape') setShowAddColumn(false);
                  }}
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={handleAddColumn} className="flex-1 py-2 text-sm sm:text-base text-neutral-600 hover:text-neutral-900 transition-colors">
                    Add
                  </button>
                  <button onClick={() => setShowAddColumn(false)} className="flex-1 py-2 text-sm sm:text-base text-neutral-400 hover:text-neutral-600 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddColumn(true)}
                className="flex-shrink-0 w-64 sm:w-72 h-12 flex items-center justify-center gap-2 text-sm sm:text-base text-neutral-400 hover:text-neutral-600 border border-dashed border-neutral-200 hover:border-neutral-300 rounded-xl transition-colors"
              >
                <Plus size={16} />
                Add column
              </button>
            )}
          </div>

          <DragOverlay>
            {activeTask ? (
              <div className="rotate-3">
                <TaskCard
                  task={activeTask}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <TaskModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, task: null, columnId: null })}
        task={modalState.task}
        columnId={modalState.columnId}
        onSave={handleSaveTask}
      />
    </div>
  );
}
