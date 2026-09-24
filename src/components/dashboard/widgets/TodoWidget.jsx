import { useId, useState } from 'react';
import { Plus, X } from 'lucide-react';
import WidgetHeader from './WidgetHeader';
import {
  inputClass,
  primaryTextButton,
  secondaryTextButton,
  linkButton,
  dangerIconButton,
  revealOnHover,
  rowHoverClass,
} from './styles';

export default function TodoWidget({ todos = [], boards = [], onAddTodo, onToggleTodo, onDeleteTodo }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTodo, setNewTodo] = useState('');
  const [showBoardPicker, setShowBoardPicker] = useState(false);
  const idPrefix = useId();

  const handleAdd = () => {
    if (newTodo.trim()) {
      onAddTodo?.({ title: newTodo.trim() });
      setNewTodo('');
      setIsAdding(false);
    }
  };

  const handleImportFromBoard = (task, boardName) => {
    onAddTodo?.({
      title: task.title,
      sourceBoard: boardName,
      sourceBoardTaskId: task.id,
    });
    setShowBoardPicker(false);
  };

  // Get all incomplete tasks from boards
  const boardTasks = boards.flatMap(board => {
    const columns = board.columns || [];
    const tasks = board.tasks || [];
    return tasks
      .filter(task => {
        const col = columns.find(c => c.id === task.columnId);
        const colName = col?.name?.toLowerCase() || '';
        return !colName.includes('done') && !colName.includes('complete');
      })
      .map(task => ({ ...task, boardName: board.name, boardId: board.id }));
  });

  const completedCount = todos.filter(t => t.completed).length;
  const totalCount = todos.length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <>
      <WidgetHeader title="Todo" addLabel="Add task" onAdd={() => setIsAdding(true)} />
      <div className="flex-1 overflow-y-auto">
        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="px-4 sm:px-6 py-3 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center justify-between text-sm text-neutral-500 dark:text-neutral-400 mb-2">
              <span>{completedCount} of {totalCount} done</span>
              <span aria-hidden="true">{percent}%</span>
            </div>
            <div
              role="progressbar"
              aria-label="Tasks completed"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-1.5"
            >
              <div
                className="bg-neutral-700 dark:bg-neutral-300 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Add new todo */}
        {isAdding && (
          <div className="p-4 sm:p-6 border-b border-neutral-100 dark:border-neutral-800 space-y-3">
            <input
              type="text"
              placeholder="What needs to be done?"
              aria-label="New task"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className={inputClass}
              autoFocus
            />
            <div className="flex gap-2">
              <button type="button" onClick={handleAdd} disabled={!newTodo.trim()} className={primaryTextButton}>Add</button>
              <button type="button" onClick={() => { setIsAdding(false); setNewTodo(''); }} className={secondaryTextButton}>Cancel</button>
            </div>
          </div>
        )}

        {/* Board picker */}
        {showBoardPicker && (
          <div className="p-4 sm:p-6 border-b border-neutral-100 dark:border-neutral-800">
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">Import from boards:</p>
            {boardTasks.length === 0 ? (
              <p className="text-sm text-neutral-400">No tasks in your boards</p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1">
                {boardTasks.slice(0, 10).map((task) => (
                  <button
                    type="button"
                    key={`${task.boardId}-${task.id}`}
                    onClick={() => handleImportFromBoard(task, task.boardName)}
                    className={`w-full text-left px-3 py-2 text-sm ${rowHoverClass} rounded-lg transition-colors focus:outline-none focus-visible:bg-neutral-50 dark:focus-visible:bg-neutral-800/40`}
                  >
                    <p className="text-neutral-700 dark:text-neutral-200 truncate">{task.title}</p>
                    <p className="text-xs text-neutral-400">{task.boardName}</p>
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={() => setShowBoardPicker(false)} className={`mt-3 text-sm ${linkButton}`}>
              Cancel
            </button>
          </div>
        )}

        {/* Todo list */}
        {todos.length === 0 && !isAdding && !showBoardPicker ? (
          <div className="p-4 sm:p-6 space-y-2">
            <button type="button" onClick={() => setIsAdding(true)} className={`text-base flex items-center gap-2 ${linkButton}`}>
              <Plus size={16} aria-hidden="true" /> Add a task
            </button>
            {boardTasks.length > 0 && (
              <button type="button" onClick={() => setShowBoardPicker(true)} className={`tap-area text-sm ${linkButton}`}>
                or import from boards
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {todos.map((todo) => {
              const labelId = `${idPrefix}-todo-${todo.id}`;
              return (
                <li key={todo.id} className="px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 group">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={!!todo.completed}
                    aria-labelledby={labelId}
                    onClick={() => onToggleTodo?.(todo.id)}
                    className={`tap-area w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 dark:focus-visible:ring-offset-neutral-900 ${
                      todo.completed
                        ? 'bg-neutral-700 border-neutral-700 dark:bg-neutral-300 dark:border-neutral-300'
                        : 'border-neutral-300 hover:border-neutral-400 dark:border-neutral-600 dark:hover:border-neutral-500'
                    }`}
                  >
                    {todo.completed && (
                      <svg className="w-full h-full text-white dark:text-neutral-900 p-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                  <span
                    id={labelId}
                    className={`flex-1 text-base sm:text-lg ${todo.completed ? 'text-neutral-400 dark:text-neutral-500 line-through' : 'text-neutral-700 dark:text-neutral-200'}`}
                  >
                    {todo.title}
                  </span>
                  <div className={revealOnHover}>
                    <button
                      type="button"
                      onClick={() => onDeleteTodo?.(todo.id)}
                      aria-label={`Delete "${todo.title}"`}
                      title="Delete"
                      className={dangerIconButton}
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Import from boards button */}
        {todos.length > 0 && !isAdding && !showBoardPicker && boardTasks.length > 0 && (
          <div className="px-4 sm:px-6 py-3 border-t border-neutral-100 dark:border-neutral-800">
            <button type="button" onClick={() => setShowBoardPicker(true)} className={`tap-area text-sm ${linkButton}`}>
              + Import from boards
            </button>
          </div>
        )}
      </div>
    </>
  );
}
