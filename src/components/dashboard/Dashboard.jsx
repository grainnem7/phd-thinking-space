import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, ChevronRight, Trash2, Pencil, X, Check, Play, Pause, RotateCcw, Settings, Volume2, VolumeX } from 'lucide-react';
import { useDashboard } from '../../hooks/useDashboard';
import { useFirestore } from '../../hooks/useFirestore';
import { format, formatDistanceToNow } from 'date-fns';
import { daysUntil, parseLocalDate } from '../../utils/date';
import { useConfirm } from '../common/ConfirmDialog';

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
    updateDeadline,
    deleteDeadline,
    addScheduleBlock,
    updateScheduleBlock,
    deleteScheduleBlock,
    addQuickCapture,
    updateQuickCapture,
    deleteQuickCapture,
    addTodo,
    toggleTodo,
    deleteTodo,
  } = useDashboard();

  const { sections: allSections } = useFirestore();
  const confirm = useConfirm();

  const boards = useMemo(() => {
    return allSections.filter(s => s.type === 'board');
  }, [allSections]);

  const confirmDeleteDeadline = useCallback(async (id) => {
    const item = deadlines.find(d => d.id === id);
    const ok = await confirm({
      title: item ? `Delete "${item.title}"?` : 'Delete deadline?',
      body: 'This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) deleteDeadline(id);
  }, [deadlines, deleteDeadline, confirm]);

  const confirmDeleteScheduleBlock = useCallback(async (id) => {
    const item = scheduleBlocks.find(b => b.id === id);
    const ok = await confirm({
      title: item ? `Delete "${item.title}"?` : 'Delete time block?',
      body: 'This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) deleteScheduleBlock(id);
  }, [scheduleBlocks, deleteScheduleBlock, confirm]);

  const confirmDeleteQuickCapture = useCallback(async (id) => {
    const item = quickCaptures.find(c => c.id === id);
    const preview = item?.text ? (item.text.length > 50 ? `${item.text.slice(0, 50)}…` : item.text) : 'this capture';
    const ok = await confirm({
      title: 'Delete capture?',
      body: `"${preview}"\n\nThis cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) deleteQuickCapture(id);
  }, [quickCaptures, deleteQuickCapture, confirm]);

  const confirmDeleteTodo = useCallback(async (id) => {
    const item = todos.find(t => t.id === id);
    const ok = await confirm({
      title: item ? `Delete "${item.title}"?` : 'Delete todo?',
      body: 'This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) deleteTodo(id);
  }, [todos, deleteTodo, confirm]);

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 lg:py-8">
        {/* Header */}
        <header className="mb-5 sm:mb-6 lg:mb-10">
          <p className="text-sm text-neutral-400 uppercase tracking-widest mb-1">
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-medium text-neutral-900 dark:text-neutral-100 tracking-tight">
            {getGreeting()}
          </h1>
        </header>

        {/* Grid - responsive layout optimized for all screen sizes */}
        <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-4 lg:gap-5">
          {/* Deadlines - full width on tablet portrait, narrower on landscape */}
          <div className="md:col-span-3 lg:col-span-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden flex flex-col min-h-[240px] lg:min-h-[280px]">
            <DeadlinesWidget
              deadlines={deadlines}
              onAddDeadline={addDeadline}
              onUpdateDeadline={updateDeadline}
              onDeleteDeadline={confirmDeleteDeadline}
            />
          </div>

          {/* Schedule */}
          <div className="md:col-span-3 lg:col-span-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden flex flex-col min-h-[240px] lg:min-h-[280px]">
            <ScheduleWidget
              currentTime={currentTime}
              blocks={scheduleBlocks}
              onAddBlock={addScheduleBlock}
              onUpdateBlock={updateScheduleBlock}
              onDeleteBlock={confirmDeleteScheduleBlock}
            />
          </div>

          {/* Todo List - spans full width on tablet */}
          <div className="md:col-span-6 lg:col-span-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden flex flex-col min-h-[240px] lg:min-h-[280px]">
            <TodoWidget
              todos={todos}
              boards={boards}
              onAddTodo={addTodo}
              onToggleTodo={toggleTodo}
              onDeleteTodo={confirmDeleteTodo}
            />
          </div>

          {/* Quick Capture */}
          <div className="md:col-span-3 lg:col-span-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden flex flex-col h-[420px]">
            <QuickCaptureWidget
              captures={quickCaptures}
              onAddCapture={addQuickCapture}
              onUpdateCapture={updateQuickCapture}
              onDeleteCapture={confirmDeleteQuickCapture}
            />
          </div>

          {/* Focus Timer (Pomodoro) */}
          <div className="md:col-span-3 lg:col-span-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden flex flex-col h-[420px]">
            <PomodoroWidget />
          </div>

          {/* Recent Notes */}
          <div className="md:col-span-6 lg:col-span-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden flex flex-col h-[420px]">
            <RecentNotesWidget notes={notes} sections={sections} onNavigate={handleNoteNavigate} />
          </div>
        </div>
      </div>
    </main>
  );
}

function WidgetHeader({ title, onAdd, actions }) {
  return (
    <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between flex-shrink-0">
      <h2 className="text-sm text-neutral-500 dark:text-neutral-400 uppercase tracking-widest font-medium">{title}</h2>
      <div className="flex items-center gap-2">
        {actions}
        {onAdd && (
          <button onClick={onAdd} className="text-neutral-300 hover:text-neutral-500 transition-colors p-1">
            <Plus size={20} />
          </button>
        )}
      </div>
    </div>
  );
}

function DeadlinesWidget({ deadlines = [], onAddDeadline, onUpdateDeadline, onDeleteDeadline }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newDeadline, setNewDeadline] = useState({ title: '', date: '' });
  const [editDeadline, setEditDeadline] = useState({ title: '', date: '' });

  const getDaysRemaining = daysUntil;

  const handleAdd = () => {
    if (newDeadline.title && newDeadline.date) {
      onAddDeadline?.({ title: newDeadline.title, date: newDeadline.date, createdAt: new Date().toISOString() });
      setNewDeadline({ title: '', date: '' });
      setIsAdding(false);
    }
  };

  const handleStartEdit = (d) => {
    setEditingId(d.id);
    setEditDeadline({ title: d.title, date: d.date });
  };

  const handleSaveEdit = () => {
    if (editDeadline.title && editDeadline.date && editingId) {
      onUpdateDeadline?.(editingId, { title: editDeadline.title, date: editDeadline.date });
      setEditingId(null);
      setEditDeadline({ title: '', date: '' });
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditDeadline({ title: '', date: '' });
  };

  const sorted = [...deadlines].sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));

  return (
    <>
      <WidgetHeader title="Deadlines" onAdd={() => setIsAdding(true)} />
      <div className="flex-1 overflow-y-auto">
        {isAdding && (
          <div className="p-4 sm:p-6 border-b border-neutral-100 dark:border-neutral-800 space-y-3">
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
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {sorted.map((d) => {
              const days = getDaysRemaining(d.date);
              const isUrgent = days <= 7 && days >= 0;
              const isOverdue = days < 0;
              const isEditing = editingId === d.id;

              if (isEditing) {
                return (
                  <div key={d.id} className="p-4 sm:p-6 space-y-3 bg-neutral-50">
                    <input
                      type="text"
                      placeholder="Deadline title"
                      value={editDeadline.title}
                      onChange={(e) => setEditDeadline({ ...editDeadline, title: e.target.value })}
                      className="w-full px-3 py-2.5 text-base bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300 placeholder:text-neutral-400"
                      autoFocus
                    />
                    <input
                      type="date"
                      value={editDeadline.date}
                      onChange={(e) => setEditDeadline({ ...editDeadline, date: e.target.value })}
                      className="w-full px-3 py-2.5 text-base bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300"
                    />
                    <div className="flex gap-2">
                      <button onClick={handleSaveEdit} disabled={!editDeadline.title || !editDeadline.date}
                        className="flex-1 py-2 text-base text-neutral-600 hover:text-neutral-900 transition-colors disabled:text-neutral-300 flex items-center justify-center gap-1">
                        <Check size={16} /> Save
                      </button>
                      <button onClick={handleCancelEdit}
                        className="flex-1 py-2 text-base text-neutral-400 hover:text-neutral-600 transition-colors flex items-center justify-center gap-1">
                        <X size={16} /> Cancel
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={d.id} className={`px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between group ${isOverdue ? 'opacity-40' : ''}`}>
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-base sm:text-lg text-neutral-900 dark:text-neutral-100 truncate">{d.title}</p>
                    <p className="text-sm sm:text-base text-neutral-400 mt-1">
                      {isOverdue ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : format(parseLocalDate(d.date), 'MMM d')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Action buttons - visible on hover */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleStartEdit(d)}
                        className="p-1.5 text-neutral-300 hover:text-neutral-600 transition-colors"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => onDeleteDeadline?.(d.id)}
                        className="p-1.5 text-neutral-300 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {/* Days display */}
                    <div className="flex items-baseline gap-1 flex-shrink-0">
                      <span className={`font-serif text-3xl sm:text-4xl font-medium tabular-nums ${isUrgent ? 'text-amber-600' : 'text-neutral-300'}`}>
                        {isOverdue ? Math.abs(days) : days}
                      </span>
                      <span className={`text-sm sm:text-base ${isUrgent ? 'text-amber-600' : 'text-neutral-400'}`}>
                        days
                      </span>
                    </div>
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

function ScheduleWidget({ currentTime, blocks = [], onAddBlock, onUpdateBlock, onDeleteBlock }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newBlock, setNewBlock] = useState({ title: '', startTime: '09:00', endTime: '10:00' });
  const [editingId, setEditingId] = useState(null);
  const [editBlock, setEditBlock] = useState({ title: '', startTime: '09:00', endTime: '10:00' });

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
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="font-serif text-4xl sm:text-5xl font-medium text-neutral-900 dark:text-neutral-100 tabular-nums tracking-tight">
              {format(currentTime, 'HH:mm')}
            </span>
          </div>
          {currentBlock && <p className="text-sm sm:text-base text-neutral-500 mt-2">{currentBlock.title}</p>}
        </div>

        {isAdding && (
          <div className="p-4 sm:p-6 border-b border-neutral-100 dark:border-neutral-800 space-y-3">
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
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {sortedBlocks.map((block) => {
              const isPast = parseTime(block.endTime) < currentMinutes;
              const isCurrent = block.id === currentBlock?.id;

              if (editingId === block.id) {
                return (
                  <div key={block.id} className="px-4 sm:px-6 py-3 sm:py-4 border-b border-neutral-100 dark:border-neutral-800">
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editBlock.title}
                        onChange={(e) => setEditBlock({ ...editBlock, title: e.target.value })}
                        placeholder="Task name"
                        className="w-full px-3 py-2.5 text-base bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <input
                          type="time"
                          value={editBlock.startTime}
                          onChange={(e) => setEditBlock({ ...editBlock, startTime: e.target.value })}
                          className="flex-1 px-3 py-2.5 text-base bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300"
                        />
                        <input
                          type="time"
                          value={editBlock.endTime}
                          onChange={(e) => setEditBlock({ ...editBlock, endTime: e.target.value })}
                          className="flex-1 px-3 py-2.5 text-base bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (!editBlock.title.trim()) return;
                            onUpdateBlock?.(block.id, {
                              title: editBlock.title.trim(),
                              startTime: editBlock.startTime,
                              endTime: editBlock.endTime,
                            });
                            setEditingId(null);
                          }}
                          className="flex-1 py-2 text-base text-neutral-600 hover:text-neutral-900 transition-colors"
                        >
                          <Check size={16} className="inline mr-2" />
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex-1 py-2 text-base text-neutral-400 hover:text-neutral-600 transition-colors"
                        >
                          <X size={16} className="inline mr-2" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={block.id} className={`px-4 sm:px-6 py-3 sm:py-4 flex items-start gap-3 sm:gap-5 ${isPast ? 'opacity-40' : ''} ${isCurrent ? 'bg-neutral-50' : ''}`}>
                  <span className={`text-base sm:text-lg tabular-nums flex-shrink-0 ${isCurrent ? 'text-neutral-900 font-medium' : 'text-neutral-400'}`}>
                    {block.startTime}
                  </span>
                  <p className={`flex-1 text-base sm:text-lg ${isCurrent ? 'text-neutral-900 font-medium' : 'text-neutral-600'}`}>{block.title}</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingId(block.id);
                        setEditBlock({ title: block.title, startTime: block.startTime, endTime: block.endTime });
                      }}
                      className="p-1.5 text-neutral-300 hover:text-neutral-600 transition-colors"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => onDeleteBlock?.(block.id)}
                      className="p-1.5 text-neutral-300 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                    {isCurrent && <span className="text-xs sm:text-sm text-rose-500 font-medium uppercase flex-shrink-0">Now</span>}
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
          <div className="px-4 sm:px-6 py-3 border-b border-neutral-100 dark:border-neutral-800">
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
          <div className="p-4 sm:p-6 border-b border-neutral-100 dark:border-neutral-800 space-y-3">
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
          <div className="p-4 sm:p-6 border-b border-neutral-100 dark:border-neutral-800">
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
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
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

function QuickCaptureWidget({ captures = [], onAddCapture, onUpdateCapture, onDeleteCapture }) {
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  const handleSubmit = () => {
    if (text.trim()) {
      onAddCapture?.({ text: text.trim(), createdAt: new Date().toISOString() });
      setText('');
    }
  };

  const handleStartEdit = (c) => {
    setEditingId(c.id);
    setEditText(c.text);
  };

  const handleSaveEdit = () => {
    if (editText.trim() && editingId) {
      onUpdateCapture?.(editingId, { text: editText.trim() });
      setEditingId(null);
      setEditText('');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText('');
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
      <WidgetHeader
        title="Quick Capture"
        actions={
          captures.length > 0 ? (
            <span className="text-sm text-neutral-400 tabular-nums">
              {captures.length}
            </span>
          ) : null
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 border-b border-neutral-100 dark:border-neutral-800">
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
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {captures.map((c) => {
              if (editingId === c.id) {
                return (
                  <div key={c.id} className="px-4 sm:px-6 py-3 sm:py-4 bg-neutral-50 space-y-3">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      className="w-full px-3 py-2.5 text-base bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEdit}
                        disabled={!editText.trim()}
                        className="flex-1 py-2 text-base text-neutral-600 hover:text-neutral-900 transition-colors disabled:text-neutral-300 flex items-center justify-center gap-1"
                      >
                        <Check size={16} /> Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="flex-1 py-2 text-base text-neutral-400 hover:text-neutral-600 transition-colors flex items-center justify-center gap-1"
                      >
                        <X size={16} /> Cancel
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={c.id} className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-neutral-50 transition-colors flex items-start justify-between gap-3 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-base sm:text-lg text-neutral-600">{c.text}</p>
                    <p className="text-sm sm:text-base text-neutral-400 mt-1">{timeAgo(c.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => handleStartEdit(c)}
                      className="p-1.5 text-neutral-300 hover:text-neutral-600 transition-colors"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => onDeleteCapture?.(c.id)}
                      className="p-1.5 text-neutral-300 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
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

  const getPreview = (content) => {
    if (!content) return '';
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        const block = parsed.find(b => b.content?.length > 0 && b.content[0].text);
        if (block) return block.content.map(c => c.text).join('').slice(0, 80);
      }
    } catch {
      return content.slice(0, 80);
    }
    return '';
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
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {recent.map((note) => {
              const preview = getPreview(note.content);
              return (
                <button key={note.id} onClick={() => onNavigate?.(note)}
                  className="w-full px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between text-left hover:bg-neutral-50 transition-colors group">
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="text-base sm:text-lg text-neutral-900 dark:text-neutral-100 truncate">{note.name}</p>
                    {preview && <p className="text-sm text-neutral-400 mt-0.5 truncate">{preview}</p>}
                    <p className="text-xs sm:text-sm text-neutral-400 mt-1 truncate">{getSectionName(note.parentId)} · {timeAgo(note)}</p>
                  </div>
                  <ChevronRight size={18} className="text-neutral-300 group-hover:text-neutral-500 transition-colors flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

const POMODORO_DEFAULTS = { workDuration: 25, breakDuration: 5, longBreakDuration: 15, sessionsBeforeLongBreak: 4 };

function loadPomodoroSettings() {
  try {
    const raw = localStorage.getItem('pomodoroSettings');
    if (!raw) return POMODORO_DEFAULTS;
    return { ...POMODORO_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return POMODORO_DEFAULTS;
  }
}

function PomodoroWidget() {
  const [settings, setSettings] = useState(loadPomodoroSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [timeLeft, setTimeLeft] = useState(() => loadPomodoroSettings().workDuration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [sessions, setSessions] = useState(() => {
    const v = parseInt(localStorage.getItem('pomodoroSessions') || '0', 10);
    return Number.isFinite(v) ? v : 0;
  });
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('pomodoroSound') !== 'false');

  useEffect(() => { localStorage.setItem('pomodoroSettings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem('pomodoroSound', String(soundEnabled)); }, [soundEnabled]);
  useEffect(() => { localStorage.setItem('pomodoroSessions', String(sessions)); }, [sessions]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const playNotification = useCallback((isWorkComplete) => {
    if (!soundEnabled) return;
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(isWorkComplete ? 'Focus complete!' : 'Break over!', {
        body: isWorkComplete ? 'Time for a break.' : 'Ready to focus?',
      });
    }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const beep = (f, t, d) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination); o.frequency.value = f;
        g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.01, t + d);
        o.start(t); o.stop(t + d);
      };
      const now = ctx.currentTime;
      beep(523, now, 0.2); beep(659, now + 0.25, 0.2); beep(784, now + 0.5, 0.4);
      setTimeout(() => ctx.close(), 1500);
    } catch { /* audio unavailable, fall back to silent */ }
  }, [soundEnabled]);

  useEffect(() => {
    let interval;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    } else if (timeLeft === 0 && isRunning) {
      playNotification(!isBreak);
      if (!isBreak) setSessions((p) => p + 1);
      const nextIsBreak = !isBreak;
      const nextDuration = nextIsBreak
        ? ((sessions + 1) % settings.sessionsBeforeLongBreak === 0 ? settings.longBreakDuration : settings.breakDuration)
        : settings.workDuration;
      setIsBreak(nextIsBreak);
      setTimeLeft(nextDuration * 60);
      setIsRunning(false);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft, isBreak, sessions, settings, playNotification]);

  const reset = () => {
    setIsRunning(false);
    setIsBreak(false);
    setTimeLeft(settings.workDuration * 60);
  };

  return (
    <>
      <WidgetHeader
        title="Focus Timer"
        actions={
          <>
            <button
              onClick={() => setSoundEnabled((v) => !v)}
              className={`text-neutral-300 hover:text-neutral-500 transition-colors p-1 ${!soundEnabled ? 'text-neutral-500' : ''}`}
              title={soundEnabled ? 'Mute' : 'Unmute'}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button
              onClick={() => setShowSettings((v) => !v)}
              className="text-neutral-300 hover:text-neutral-500 transition-colors p-1"
              title="Settings"
            >
              <Settings size={16} />
            </button>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {showSettings ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">Work (min)</label>
                <input
                  type="number"
                  value={settings.workDuration}
                  onChange={(e) => setSettings({ ...settings, workDuration: +e.target.value || 25 })}
                  className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300"
                  min="1"
                  max="120"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">Break (min)</label>
                <input
                  type="number"
                  value={settings.breakDuration}
                  onChange={(e) => setSettings({ ...settings, breakDuration: +e.target.value || 5 })}
                  className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300"
                  min="1"
                  max="60"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">Long break (min)</label>
                <input
                  type="number"
                  value={settings.longBreakDuration}
                  onChange={(e) => setSettings({ ...settings, longBreakDuration: +e.target.value || 15 })}
                  className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300"
                  min="1"
                  max="60"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">Long every</label>
                <input
                  type="number"
                  value={settings.sessionsBeforeLongBreak}
                  onChange={(e) => setSettings({ ...settings, sessionsBeforeLongBreak: +e.target.value || 4 })}
                  className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300"
                  min="2"
                  max="10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => playNotification(true)}
                className="flex-1 py-2 text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                Test sound
              </button>
              <button
                onClick={() => {
                  setShowSettings(false);
                  if (!isRunning) {
                    setTimeLeft(settings.workDuration * 60);
                    setIsBreak(false);
                  }
                }}
                className="flex-1 py-2 text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                Done
              </button>
            </div>
            <button
              onClick={() => setSessions(0)}
              className="w-full text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              Reset session count ({sessions})
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-4">
              {isRunning && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
              <span className="font-serif text-4xl sm:text-5xl font-medium text-neutral-900 dark:text-neutral-100 tabular-nums tracking-tight">
                {formatTime(timeLeft)}
              </span>
            </div>
            <p className="text-sm sm:text-base text-neutral-400 mb-5">
              {isBreak ? 'Break time' : isRunning ? 'Focusing' : 'Ready to focus'}
            </p>
            <div className="flex items-center gap-4">
              {!isRunning ? (
                <button
                  onClick={() => setIsRunning(true)}
                  className="flex items-center gap-2 text-base text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  <Play size={16} /> Start
                </button>
              ) : (
                <button
                  onClick={() => setIsRunning(false)}
                  className="flex items-center gap-2 text-base text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  <Pause size={16} /> Pause
                </button>
              )}
              <button
                onClick={reset}
                className="flex items-center gap-2 text-base text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                <RotateCcw size={16} /> Reset
              </button>
              <span className="ml-auto text-sm text-neutral-400">{sessions} sessions</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
