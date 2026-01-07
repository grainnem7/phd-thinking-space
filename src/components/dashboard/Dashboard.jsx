import { useState, useEffect, useMemo } from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { useDashboard } from '../../hooks/useDashboard';
import { useFirestore } from '../../hooks/useFirestore';
import { format, formatDistanceToNow, differenceInDays, parseISO } from 'date-fns';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard({ notes = [], sections = [], onSelect }) {
  const [currentTime, setCurrentTime] = useState(new Date());

  const {
    deadlines,
    scheduleBlocks,
    quickCaptures,
    todos,
    isLoading,
    addDeadline,
    deleteDeadline,
    addScheduleBlock,
    deleteScheduleBlock,
    addQuickCapture,
    addTodo,
    toggleTodo,
    deleteTodo,
  } = useDashboard();

  const { sections: allSections } = useFirestore();

  const boards = useMemo(() => {
    return allSections.filter(s => s.type === 'board');
  }, [allSections]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const handleNoteNavigate = (note) => {
    onSelect?.(note);
  };

  const handleBoardNavigate = (board) => {
    onSelect?.(board);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#fafafa]">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-base text-neutral-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="flex-1 overflow-auto bg-[#fafafa]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <header className="mb-6 sm:mb-10">
          <p className="text-sm sm:text-base text-neutral-400 uppercase tracking-widest mb-1 sm:mb-2">
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl font-medium text-neutral-900 tracking-tight">
            {getGreeting()}
          </h1>
        </header>

        {/* Grid - responsive: 1 col mobile, 2 cols tablet, 12-col desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 sm:gap-5">
          {/* Deadlines */}
          <div className="md:col-span-1 lg:col-span-4 bg-white border border-neutral-200 rounded-xl overflow-hidden flex flex-col min-h-[280px]">
            <DeadlinesWidget
              deadlines={deadlines}
              onAddDeadline={addDeadline}
              onDeleteDeadline={deleteDeadline}
            />
          </div>

          {/* Schedule */}
          <div className="md:col-span-1 lg:col-span-5 bg-white border border-neutral-200 rounded-xl overflow-hidden flex flex-col min-h-[280px]">
            <ScheduleWidget
              currentTime={currentTime}
              blocks={scheduleBlocks}
              onAddBlock={addScheduleBlock}
              onDeleteBlock={deleteScheduleBlock}
            />
          </div>

          {/* Todo List */}
          <div className="md:col-span-2 lg:col-span-3 bg-white border border-neutral-200 rounded-xl overflow-hidden flex flex-col min-h-[280px]">
            <TodoWidget
              todos={todos}
              boards={boards}
              onAddTodo={addTodo}
              onToggleTodo={toggleTodo}
              onDeleteTodo={deleteTodo}
            />
          </div>

          {/* Quick Capture */}
          <div className="md:col-span-1 lg:col-span-6 bg-white border border-neutral-200 rounded-xl overflow-hidden flex flex-col min-h-[200px]">
            <QuickCaptureWidget captures={quickCaptures} onAddCapture={addQuickCapture} />
          </div>

          {/* Recent Notes */}
          <div className="md:col-span-1 lg:col-span-6 bg-white border border-neutral-200 rounded-xl overflow-hidden flex flex-col min-h-[200px]">
            <RecentNotesWidget notes={notes} sections={sections} onNavigate={handleNoteNavigate} />
          </div>
        </div>
      </div>
    </main>
  );
}

function WidgetHeader({ title, onAdd }) {
  return (
    <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-neutral-100 flex items-center justify-between flex-shrink-0">
      <h2 className="text-sm text-neutral-500 uppercase tracking-widest font-medium">{title}</h2>
      {onAdd && (
        <button onClick={onAdd} className="text-neutral-300 hover:text-neutral-500 transition-colors p-1">
          <Plus size={20} />
        </button>
      )}
    </div>
  );
}

function DeadlinesWidget({ deadlines = [], onAddDeadline, onDeleteDeadline }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newDeadline, setNewDeadline] = useState({ title: '', date: '' });

  const getDaysRemaining = (dateStr) => differenceInDays(parseISO(dateStr), new Date());

  const handleAdd = () => {
    if (newDeadline.title && newDeadline.date) {
      onAddDeadline?.({ title: newDeadline.title, date: newDeadline.date, createdAt: new Date().toISOString() });
      setNewDeadline({ title: '', date: '' });
      setIsAdding(false);
    }
  };

  const sorted = [...deadlines].sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <>
      <WidgetHeader title="Deadlines" onAdd={() => setIsAdding(true)} />
      <div className="flex-1 overflow-y-auto">
        {isAdding && (
          <div className="p-4 sm:p-6 border-b border-neutral-100 space-y-3">
            <input
              type="text"
              placeholder="Deadline title"
              value={newDeadline.title}
              onChange={(e) => setNewDeadline({ ...newDeadline, title: e.target.value })}
              className="w-full px-3 py-2.5 text-base bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300 placeholder:text-neutral-400"
              autoFocus
            />
            <input
              type="date"
              value={newDeadline.date}
              onChange={(e) => setNewDeadline({ ...newDeadline, date: e.target.value })}
              className="w-full px-3 py-2.5 text-base bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300"
            />
            <div className="flex gap-2">
              <button onClick={handleAdd} disabled={!newDeadline.title || !newDeadline.date}
                className="flex-1 py-2 text-base text-neutral-600 hover:text-neutral-900 transition-colors disabled:text-neutral-300">Add</button>
              <button onClick={() => { setIsAdding(false); setNewDeadline({ title: '', date: '' }); }}
                className="flex-1 py-2 text-base text-neutral-400 hover:text-neutral-600 transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {sorted.length === 0 && !isAdding ? (
          <div className="p-4 sm:p-6">
            <button onClick={() => setIsAdding(true)} className="text-base text-neutral-400 hover:text-neutral-600 transition-colors flex items-center gap-2">
              <Plus size={16} /> Add deadline
            </button>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {sorted.map((d) => {
              const days = getDaysRemaining(d.date);
              const isUrgent = days <= 7 && days >= 0;
              const isOverdue = days < 0;
              return (
                <div key={d.id} className={`px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between group ${isOverdue ? 'opacity-40' : ''}`}>
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-base sm:text-lg text-neutral-900 truncate">{d.title}</p>
                    <p className="text-sm sm:text-base text-neutral-400 mt-1">
                      {isOverdue ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : format(parseISO(d.date), 'MMM d')}
                    </p>
                  </div>
                  <div className="flex items-baseline gap-1 flex-shrink-0">
                    <span className={`font-serif text-3xl sm:text-4xl font-medium tabular-nums ${isUrgent ? 'text-amber-600' : 'text-neutral-300'}`}>
                      {isOverdue ? Math.abs(days) : days}
                    </span>
                    <span className={`text-sm sm:text-base ${isUrgent ? 'text-amber-600' : 'text-neutral-400'}`}>
                      days
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function ScheduleWidget({ currentTime, blocks = [], onAddBlock, onDeleteBlock }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newBlock, setNewBlock] = useState({ title: '', startTime: '09:00', endTime: '10:00' });

  const parseTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const sortedBlocks = [...blocks].sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));
  const currentBlock = sortedBlocks.find(b => currentMinutes >= parseTime(b.startTime) && currentMinutes < parseTime(b.endTime));

  const handleAdd = () => {
    if (newBlock.title && newBlock.startTime && newBlock.endTime) {
      onAddBlock?.({ ...newBlock });
      setNewBlock({ title: '', startTime: '09:00', endTime: '10:00' });
      setIsAdding(false);
    }
  };

  return (
    <>
      <WidgetHeader title="Today's Schedule" onAdd={() => setIsAdding(true)} />
      <div className="flex-1 overflow-y-auto">
        {/* Current time display */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="font-serif text-4xl sm:text-5xl font-medium text-neutral-900 tabular-nums tracking-tight">
              {format(currentTime, 'HH:mm')}
            </span>
          </div>
          {currentBlock && <p className="text-sm sm:text-base text-neutral-500 mt-2">{currentBlock.title}</p>}
        </div>

        {isAdding && (
          <div className="p-4 sm:p-6 border-b border-neutral-100 space-y-3">
            <input type="text" placeholder="Task name" value={newBlock.title} onChange={(e) => setNewBlock({ ...newBlock, title: e.target.value })}
              className="w-full px-3 py-2.5 text-base bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300 placeholder:text-neutral-400" autoFocus />
            <div className="flex gap-2">
              <input type="time" value={newBlock.startTime} onChange={(e) => setNewBlock({ ...newBlock, startTime: e.target.value })}
                className="flex-1 px-3 py-2.5 text-base bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300" />
              <input type="time" value={newBlock.endTime} onChange={(e) => setNewBlock({ ...newBlock, endTime: e.target.value })}
                className="flex-1 px-3 py-2.5 text-base bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleAdd} disabled={!newBlock.title} className="flex-1 py-2 text-base text-neutral-600 hover:text-neutral-900 transition-colors disabled:text-neutral-300">Add</button>
              <button onClick={() => setIsAdding(false)} className="flex-1 py-2 text-base text-neutral-400 hover:text-neutral-600 transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {sortedBlocks.length === 0 && !isAdding ? (
          <div className="p-4 sm:p-6">
            <button onClick={() => setIsAdding(true)} className="text-base text-neutral-400 hover:text-neutral-600 transition-colors flex items-center gap-2">
              <Plus size={16} /> Add time block
            </button>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {sortedBlocks.map((block) => {
              const isPast = parseTime(block.endTime) < currentMinutes;
              const isCurrent = block.id === currentBlock?.id;
              return (
                <div key={block.id} className={`px-4 sm:px-6 py-3 sm:py-4 flex items-start gap-3 sm:gap-5 ${isPast ? 'opacity-40' : ''} ${isCurrent ? 'bg-neutral-50' : ''}`}>
                  <span className={`text-base sm:text-lg tabular-nums flex-shrink-0 ${isCurrent ? 'text-neutral-900 font-medium' : 'text-neutral-400'}`}>
                    {block.startTime}
                  </span>
                  <p className={`flex-1 text-base sm:text-lg ${isCurrent ? 'text-neutral-900 font-medium' : 'text-neutral-600'}`}>{block.title}</p>
                  {isCurrent && <span className="text-xs sm:text-sm text-rose-500 font-medium uppercase flex-shrink-0">Now</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function TodoWidget({ todos = [], boards = [], onAddTodo, onToggleTodo, onDeleteTodo }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTodo, setNewTodo] = useState('');
  const [showBoardPicker, setShowBoardPicker] = useState(false);

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

  return (
    <>
      <WidgetHeader title="Todo" onAdd={() => setIsAdding(true)} />
      <div className="flex-1 overflow-y-auto">
        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="px-4 sm:px-6 py-3 border-b border-neutral-100">
            <div className="flex items-center justify-between text-sm text-neutral-500 mb-2">
              <span>{completedCount} of {totalCount} done</span>
              <span>{totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%</span>
            </div>
            <div className="w-full bg-neutral-100 rounded-full h-1.5">
              <div
                className="bg-neutral-700 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Add new todo */}
        {isAdding && (
          <div className="p-4 sm:p-6 border-b border-neutral-100 space-y-3">
            <input
              type="text"
              placeholder="What needs to be done?"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="w-full px-3 py-2.5 text-base bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300 placeholder:text-neutral-400"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={handleAdd} disabled={!newTodo.trim()}
                className="flex-1 py-2 text-base text-neutral-600 hover:text-neutral-900 transition-colors disabled:text-neutral-300">Add</button>
              <button onClick={() => { setIsAdding(false); setNewTodo(''); }}
                className="flex-1 py-2 text-base text-neutral-400 hover:text-neutral-600 transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {/* Board picker */}
        {showBoardPicker && (
          <div className="p-4 sm:p-6 border-b border-neutral-100">
            <p className="text-sm text-neutral-500 mb-3">Import from boards:</p>
            {boardTasks.length === 0 ? (
              <p className="text-sm text-neutral-400">No tasks in your boards</p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1">
                {boardTasks.slice(0, 10).map((task) => (
                  <button
                    key={`${task.boardId}-${task.id}`}
                    onClick={() => handleImportFromBoard(task, task.boardName)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 rounded-lg transition-colors"
                  >
                    <p className="text-neutral-700 truncate">{task.title}</p>
                    <p className="text-xs text-neutral-400">{task.boardName}</p>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setShowBoardPicker(false)}
              className="mt-3 text-sm text-neutral-400 hover:text-neutral-600 transition-colors">Cancel</button>
          </div>
        )}

        {/* Todo list */}
        {todos.length === 0 && !isAdding && !showBoardPicker ? (
          <div className="p-4 sm:p-6 space-y-2">
            <button onClick={() => setIsAdding(true)} className="text-base text-neutral-400 hover:text-neutral-600 transition-colors flex items-center gap-2">
              <Plus size={16} /> Add a task
            </button>
            {boardTasks.length > 0 && (
              <button onClick={() => setShowBoardPicker(true)} className="text-sm text-neutral-400 hover:text-neutral-600 transition-colors">
                or import from boards
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {todos.map((todo) => (
              <div key={todo.id} className="px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 group">
                <button
                  onClick={() => onToggleTodo?.(todo.id)}
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors ${
                    todo.completed
                      ? 'bg-neutral-700 border-neutral-700'
                      : 'border-neutral-300 hover:border-neutral-400'
                  }`}
                >
                  {todo.completed && (
                    <svg className="w-full h-full text-white p-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                <span className={`flex-1 text-base sm:text-lg ${todo.completed ? 'text-neutral-400 line-through' : 'text-neutral-700'}`}>
                  {todo.title}
                </span>
                <button
                  onClick={() => onDeleteTodo?.(todo.id)}
                  className="opacity-0 group-hover:opacity-100 text-neutral-300 hover:text-red-500 transition-all p-1"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Import from boards button */}
        {todos.length > 0 && !isAdding && !showBoardPicker && boardTasks.length > 0 && (
          <div className="px-4 sm:px-6 py-3 border-t border-neutral-100">
            <button onClick={() => setShowBoardPicker(true)} className="text-sm text-neutral-400 hover:text-neutral-600 transition-colors">
              + Import from boards
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function QuickCaptureWidget({ captures = [], onAddCapture }) {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (text.trim()) {
      onAddCapture?.({ text: text.trim(), createdAt: new Date().toISOString() });
      setText('');
    }
  };

  const parseDate = (v) => {
    if (!v) return null;
    try { return v.toDate ? v.toDate() : new Date(v); } catch { return null; }
  };

  const timeAgo = (v) => {
    const d = parseDate(v);
    if (!d || isNaN(d.getTime())) return '';
    try { return formatDistanceToNow(d, { addSuffix: true }); } catch { return ''; }
  };

  return (
    <>
      <WidgetHeader title="Quick Capture" />
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 border-b border-neutral-100">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Capture an idea..."
            className="w-full text-base sm:text-lg bg-transparent focus:outline-none placeholder:text-neutral-400"
          />
          <p className="text-xs sm:text-sm text-neutral-400 mt-2">Press Enter to save</p>
        </div>

        {captures.length === 0 ? (
          <div className="p-4 sm:p-6">
            <p className="text-base text-neutral-400">No captures yet</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {captures.slice(0, 5).map((c) => (
              <div key={c.id} className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-neutral-50 transition-colors">
                <p className="text-base sm:text-lg text-neutral-600">{c.text}</p>
                <p className="text-sm sm:text-base text-neutral-400 mt-1">{timeAgo(c.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function RecentNotesWidget({ notes = [], sections = [], onNavigate }) {
  const getSectionName = (id) => sections.find(s => s.id === id)?.name || 'Notes';

  const parseDate = (v) => {
    if (!v) return null;
    try { return v.toDate ? v.toDate() : new Date(v); } catch { return null; }
  };

  const recent = [...notes]
    .sort((a, b) => {
      const dA = parseDate(a.updatedAt) || parseDate(a.createdAt) || new Date(0);
      const dB = parseDate(b.updatedAt) || parseDate(b.createdAt) || new Date(0);
      return dB - dA;
    })
    .slice(0, 5);

  const timeAgo = (note) => {
    const d = parseDate(note.updatedAt) || parseDate(note.createdAt);
    if (!d || isNaN(d.getTime())) return '';
    try { return formatDistanceToNow(d, { addSuffix: true }); } catch { return ''; }
  };

  return (
    <>
      <WidgetHeader title="Recent Notes" />
      <div className="flex-1 overflow-y-auto">
        {recent.length === 0 ? (
          <div className="p-4 sm:p-6">
            <p className="text-base text-neutral-400">No notes yet</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {recent.map((note) => (
              <button key={note.id} onClick={() => onNavigate?.(note)}
                className="w-full px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between text-left hover:bg-neutral-50 transition-colors group">
                <div className="flex-1 min-w-0 mr-2">
                  <p className="text-base sm:text-lg text-neutral-900 truncate">{note.name}</p>
                  <p className="text-sm sm:text-base text-neutral-400 mt-1 truncate">{getSectionName(note.parentId)} · {timeAgo(note)}</p>
                </div>
                <ChevronRight size={18} className="text-neutral-300 group-hover:text-neutral-500 transition-colors flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
