import { useState, useEffect, useMemo } from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDashboard } from '../../hooks/useDashboard';
import { useFirestore } from '../../hooks/useFirestore';
import { format, formatDistanceToNow, differenceInDays, parseISO } from 'date-fns';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard({ notes = [], sections = [] }) {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  const {
    deadlines,
    scheduleBlocks,
    quickCaptures,
    isLoading,
    addDeadline,
    deleteDeadline,
    addScheduleBlock,
    deleteScheduleBlock,
    addQuickCapture,
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
    navigate(`/notes/${note.parentId}?note=${note.id}`);
  };

  const handleBoardNavigate = (board) => {
    navigate(`/board/${board.id}`);
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

          {/* Tasks */}
          <div className="md:col-span-2 lg:col-span-3 bg-white border border-neutral-200 rounded-xl overflow-hidden flex flex-col min-h-[280px]">
            <TasksWidget boards={boards} onNavigate={handleBoardNavigate} />
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

function TasksWidget({ boards = [], onNavigate }) {
  const counts = boards.reduce((acc, board) => {
    (board.columns || []).forEach((col) => {
      const n = col.cards?.length || 0;
      const name = col.name?.toLowerCase() || '';
      if (name.includes('done') || name.includes('complete')) acc.done += n;
      else if (name.includes('progress') || name.includes('doing')) acc.inProgress += n;
      else acc.todo += n;
      acc.total += n;
    });
    return acc;
  }, { todo: 0, inProgress: 0, done: 0, total: 0 });

  const pct = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;

  return (
    <>
      <WidgetHeader title="Tasks" />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Percentage */}
        <div className="text-center mb-4 sm:mb-6">
          <span className="font-serif text-5xl sm:text-6xl font-medium text-neutral-900 tabular-nums">{pct}</span>
          <span className="text-xl sm:text-2xl text-neutral-300">%</span>
          <p className="text-sm sm:text-base text-neutral-400 mt-2 uppercase tracking-wider">Complete</p>
        </div>

        {/* Stats */}
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-center justify-between text-base sm:text-lg">
            <span className="text-neutral-500">To do</span>
            <span className="text-neutral-900 font-medium tabular-nums">{counts.todo}</span>
          </div>
          <div className="flex items-center justify-between text-base sm:text-lg">
            <span className="text-neutral-500">In progress</span>
            <span className="text-neutral-900 font-medium tabular-nums">{counts.inProgress}</span>
          </div>
          <div className="flex items-center justify-between text-base sm:text-lg">
            <span className="text-neutral-500">Done</span>
            <span className="text-neutral-900 font-medium tabular-nums">{counts.done}</span>
          </div>
        </div>

        {/* Boards list */}
        {boards.length > 0 && (
          <div className="mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-neutral-100 space-y-2">
            {boards.slice(0, 3).map((board) => (
              <button key={board.id} onClick={() => onNavigate?.(board)}
                className="w-full flex items-center justify-between text-base text-neutral-500 hover:text-neutral-900 transition-colors group py-1">
                <span className="truncate">{board.name}</span>
                <ChevronRight size={16} className="text-neutral-300 group-hover:text-neutral-500 flex-shrink-0" />
              </button>
            ))}
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
