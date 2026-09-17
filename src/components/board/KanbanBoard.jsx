import { useState, useRef, useEffect } from 'react';
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
import { Plus, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useBoards, applyTaskMove, columnTasks, isDoneColumn } from '../../hooks/useBoards';
import Column from './Column';
import { TaskCardOverlay } from './TaskCard';
import TaskModal from './TaskModal';
import Dropdown, { DropdownItem } from '../common/Dropdown';
import { useConfirm } from '../common/ConfirmDialog';

const EMPTY = [];

const logError = (action) => (err) => console.error(`Failed to ${action}:`, err);

// Position signature of a task list: changes whenever the stored ordering does
const orderSignature = (tasks) => tasks.map((t) => `${t.id}:${t.columnId}:${t.order}`).join('|');

export default function KanbanBoard({ board, initialTaskId, onRename, onDelete }) {
  const confirm = useConfirm();
  const [modalState, setModalState] = useState({ isOpen: false, task: null, columnId: null });
  const [newColumnName, setNewColumnName] = useState('');
  const [showAddColumn, setShowAddColumn] = useState(false);
  // Card being dragged, plus where it's previewed after crossing into another column
  const [drag, setDrag] = useState(null);
  // Moves sent to the server but not yet reflected in `board` (shown optimistically)
  const [pendingMoves, setPendingMoves] = useState([]);

  const {
    addColumn,
    updateColumn,
    deleteColumn,
    addTask,
    updateTask,
    deleteTask,
    moveTask,
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

  const columns = board?.columns || EMPTY;
  const storedTasks = board?.tasks || EMPTY;
  const columnIds = new Set(columns.map((c) => c.id));

  const signature = orderSignature(storedTasks);
  const signatureRef = useRef(signature);
  useEffect(() => { signatureRef.current = signature; }, [signature]);

  // A move stays visible until it fails, or it has been saved and the stored
  // board has since changed or already matches it.
  const livePendingMoves = pendingMoves.filter((m) => {
    if (m.settledSignature === undefined) return true;
    if (m.settledSignature !== signature) return false;
    return applyTaskMove(storedTasks, m.taskId, m.toColumnId, m.toIndex) !== storedTasks;
  });
  if (livePendingMoves.length !== pendingMoves.length) {
    setPendingMoves(livePendingMoves);
  }

  const savedTasks = livePendingMoves.reduce(
    (acc, m) => (columnIds.has(m.toColumnId) ? applyTaskMove(acc, m.taskId, m.toColumnId, m.toIndex) : acc),
    storedTasks
  );
  const tasks = drag?.columnId
    ? applyTaskMove(savedTasks, drag.taskId, drag.columnId, drag.index)
    : savedTasks;
  const activeTask = drag ? tasks.find((t) => t.id === drag.taskId) : null;

  // Opened from the calendar: show that task straight away (once per navigation)
  const [openedTaskId, setOpenedTaskId] = useState(null);
  if (initialTaskId && openedTaskId !== initialTaskId) {
    const task = storedTasks.find(t => t.id === initialTaskId);
    if (task) {
      setOpenedTaskId(initialTaskId);
      setModalState({ isOpen: true, task, columnId: task.columnId });
    }
  }

  if (!board) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#fafafa] dark:bg-neutral-950">
        <div className="text-center">
          <p className="text-base text-neutral-500 dark:text-neutral-400">No board selected</p>
          <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-1">Select a board from the sidebar to view tasks</p>
        </div>
      </div>
    );
  }

  // Prefer the card under the pointer; over a column's empty space or the gap
  // between cards, target the nearest card in that column (or the column itself).
  const collisionDetection = (args) => {
    const pointerHits = pointerWithin(args);
    const hits = pointerHits.length > 0 ? pointerHits : rectIntersection(args);
    const taskHit = hits.find((hit) => !columnIds.has(hit.id));
    if (taskHit) return [taskHit];
    const columnHit = hits.find((hit) => columnIds.has(hit.id));
    if (!columnHit) return [];
    const ids = new Set(columnTasks(tasks, columnHit.id).map((t) => t.id));
    const closest = closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) => ids.has(c.id)),
    });
    return closest.length > 0 ? [closest[0]] : [columnHit];
  };

  const handleDragStart = ({ active }) => {
    if (tasks.some((t) => t.id === active.id)) {
      setDrag({ taskId: active.id });
    }
  };

  // Crossing into another column: preview the card there so that column's
  // cards make room for it.
  const handleDragOver = ({ active, over }) => {
    if (!over || !activeTask) return;
    const overIsColumn = columnIds.has(over.id);
    const overColumnId = overIsColumn ? over.id : tasks.find((t) => t.id === over.id)?.columnId;
    if (!overColumnId || overColumnId === activeTask.columnId) return;

    const destination = columnTasks(tasks, overColumnId);
    let index = destination.length;
    if (!overIsColumn) {
      const translated = active.rect.current.translated;
      const below = translated && translated.top > over.rect.top + over.rect.height / 2;
      index = destination.findIndex((t) => t.id === over.id) + (below ? 1 : 0);
    }
    setDrag({ taskId: active.id, columnId: overColumnId, index });
  };

  const handleDragEnd = ({ active, over }) => {
    setDrag(null);
    if (!over || !activeTask) return;

    let toColumnId = activeTask.columnId;
    let toIndex = columnTasks(tasks, toColumnId).findIndex((t) => t.id === active.id);

    if (columnIds.has(over.id)) {
      if (over.id !== toColumnId) {
        toColumnId = over.id;
        toIndex = columnTasks(tasks, toColumnId).length;
      }
    } else if (over.id !== active.id) {
      const overTask = tasks.find((t) => t.id === over.id);
      if (overTask) {
        toColumnId = overTask.columnId;
        // arrayMove semantics: the card takes the hovered card's slot
        toIndex = columnTasks(tasks, toColumnId).findIndex((t) => t.id === over.id);
      }
    }

    const original = savedTasks.find((t) => t.id === active.id);
    if (!original) return;
    const originalIndex = columnTasks(savedTasks, original.columnId).findIndex((t) => t.id === active.id);
    if (original.columnId === toColumnId && originalIndex === toIndex) return;

    const key = Symbol('move');
    setPendingMoves((prev) => [...prev, { key, taskId: active.id, toColumnId, toIndex }]);
    moveTask(active.id, toColumnId, toIndex).then(
      () => setPendingMoves((prev) => prev.map((m) => (
        m.key === key ? { ...m, settledSignature: signatureRef.current } : m
      ))),
      (err) => {
        logError('move task')(err);
        setPendingMoves((prev) => prev.filter((m) => m.key !== key));
      }
    );
  };

  const handleAddColumn = () => {
    if (newColumnName.trim()) {
      addColumn(newColumnName.trim()).catch(logError('add column'));
      setNewColumnName('');
      setShowAddColumn(false);
    }
  };

  const handleRenameColumn = (columnId, newName) => {
    updateColumn(columnId, { name: newName }).catch(logError('rename column'));
  };

  const handleDeleteColumn = async (columnId) => {
    const column = columns.find(c => c.id === columnId);
    const taskCount = storedTasks.filter(t => t.columnId === columnId).length;
    const ok = await confirm({
      title: column ? `Delete column "${column.name}"?` : 'Delete column?',
      body: taskCount > 0
        ? `This will also delete ${taskCount} ${taskCount === 1 ? 'task' : 'tasks'} in this column. This cannot be undone.`
        : 'This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) deleteColumn(columnId).catch(logError('delete column'));
  };

  const handleAddTask = (columnId) => {
    setModalState({ isOpen: true, task: null, columnId });
  };

  const handleEditTask = (task) => {
    setModalState({ isOpen: true, task, columnId: task.columnId });
  };

  const handleDeleteTask = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    const ok = await confirm({
      title: task ? `Delete "${task.title}"?` : 'Delete task?',
      body: 'This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) deleteTask(taskId).catch(logError('delete task'));
  };

  const handleSaveTask = ({ id, columnId, ...fields }) => {
    if (id) {
      updateTask(id, fields).catch(logError('update task'));
    } else {
      addTask({ ...fields, columnId }).catch(logError('add task'));
    }
  };

  const sortedColumns = [...columns].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-[#fafafa] dark:bg-neutral-950">
      {/* Board Header */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <h2 className="font-serif text-xl sm:text-2xl font-medium text-neutral-900 dark:text-neutral-100 tracking-tight truncate">{board.name}</h2>
        {(onRename || onDelete) && (
          <Dropdown
            align="right"
            trigger={
              <button
                aria-label="Board actions"
                title="Board actions"
                className="text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200 transition-colors p-1.5 touch-manipulation"
              >
                <MoreVertical size={18} />
              </button>
            }
          >
            {({ close }) => (
              <>
                {onRename && (
                  <DropdownItem onClick={() => { onRename(board); close(); }}>
                    <Pencil size={14} /> Rename
                  </DropdownItem>
                )}
                {onDelete && (
                  <DropdownItem
                    danger
                    onClick={async () => {
                      close();
                      const taskCount = storedTasks.length;
                      const ok = await confirm({
                        title: `Delete "${board.name}"?`,
                        body: taskCount > 0
                          ? `This board has ${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}. Deleting it will remove them too. This cannot be undone.`
                          : 'This cannot be undone.',
                        confirmLabel: 'Delete',
                        danger: true,
                      });
                      if (ok) onDelete(board.id);
                    }}
                  >
                    <Trash2 size={14} /> Delete board
                  </DropdownItem>
                )}
              </>
            )}
          </Dropdown>
        )}
      </div>

      {/* Columns */}
      <div className="flex-1 min-h-0 overflow-x-auto overscroll-x-contain p-4 sm:p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDrag(null)}
        >
          <div className="flex items-start gap-3 sm:gap-4 h-full w-max">
            {sortedColumns.map((column) => (
              <Column
                key={column.id}
                column={column}
                tasks={columnTasks(tasks, column.id)}
                isDropTarget={Boolean(drag?.columnId) && activeTask?.columnId === column.id}
                onAddTask={handleAddTask}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
                onRenameColumn={handleRenameColumn}
                onDeleteColumn={handleDeleteColumn}
              />
            ))}

            {/* Add Column */}
            {showAddColumn ? (
              <div className="flex-shrink-0 w-64 sm:w-72 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3">
                <label htmlFor="new-column-name" className="sr-only">Column name</label>
                <input
                  id="new-column-name"
                  type="text"
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  placeholder="Column name..."
                  autoFocus
                  className="w-full px-3 py-2 text-base sm:text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-neutral-300 dark:focus:border-neutral-600 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddColumn();
                    if (e.key === 'Escape') setShowAddColumn(false);
                  }}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={handleAddColumn}
                    disabled={!newColumnName.trim()}
                    className="flex-1 py-2 text-sm text-white bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddColumn(false); setNewColumnName(''); }}
                    className="flex-1 py-2 text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddColumn(true)}
                className="flex-shrink-0 w-64 sm:w-72 h-12 flex items-center justify-center gap-2 text-sm sm:text-base text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 border border-dashed border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700 rounded-xl transition-colors"
              >
                <Plus size={16} />
                Add column
              </button>
            )}
          </div>

          <DragOverlay>
            {activeTask ? (
              <div className="rotate-3">
                <TaskCardOverlay
                  task={activeTask}
                  done={isDoneColumn(columns.find((c) => c.id === activeTask.columnId))}
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
