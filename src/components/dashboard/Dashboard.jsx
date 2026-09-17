import { useState, useEffect, useMemo, useCallback } from 'react';
import { useDashboard } from '../../hooks/useDashboard';
import { useFirestore } from '../../hooks/useFirestore';
import { useCalendar } from '../../hooks/useCalendar';
import { useGoogleCalendar } from '../../hooks/useGoogleCalendar';
import { toDateKey } from '../../utils/date';
import { useConfirm } from '../common/ConfirmDialog';
import CalendarWidget from '../calendar/CalendarWidget';
import { buildEntries, groupByDate, todosByDate, dashboardCalendarRange } from '../calendar/calendarEntries';
import DeadlinesWidget from './widgets/DeadlinesWidget';
import ScheduleWidget from './widgets/ScheduleWidget';
import TodoWidget from './widgets/TodoWidget';
import QuickCaptureWidget from './widgets/QuickCaptureWidget';
import PomodoroWidget from './widgets/PomodoroWidget';
import RecentNotesWidget from './widgets/RecentNotesWidget';

const cardClass = 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden flex flex-col';

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

  const { items: calendarItems } = useCalendar();
  const calendarRange = dashboardCalendarRange(currentTime);
  const google = useGoogleCalendar(calendarRange.start, calendarRange.end);
  const entriesByDate = useMemo(
    () => groupByDate(buildEntries({ items: calendarItems, deadlines, sections: allSections, googleEvents: google.events })),
    [calendarItems, deadlines, allSections, google.events],
  );
  const todoMap = useMemo(() => todosByDate(calendarItems), [calendarItems]);
  const todayKey = toDateKey(currentTime);
  const todaysTimedEvents = useMemo(
    () => (entriesByDate.get(todayKey) || []).filter(e => !e.allDay),
    [entriesByDate, todayKey],
  );
  const openCalendar = useCallback((date) => {
    onSelect?.({ id: 'calendar', type: 'calendar', name: 'Calendar', date });
  }, [onSelect]);

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

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#fafafa] dark:bg-neutral-950" role="status">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-600 dark:border-neutral-700 dark:border-t-neutral-300 rounded-full animate-spin mx-auto mb-3" aria-hidden="true" />
          <p className="text-base text-neutral-400 dark:text-neutral-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="flex-1 overflow-auto bg-[#fafafa] dark:bg-neutral-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 lg:py-8">
        {/* Header */}
        <header className="mb-5 sm:mb-6 lg:mb-10">
          <p className="text-sm text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">
            {currentTime.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-medium text-neutral-900 dark:text-neutral-100 tracking-tight">
            {getGreeting()}
          </h1>
        </header>

        {/* Grid - responsive layout optimized for all screen sizes */}
        <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-4 lg:gap-5">
          {/* Deadlines - full width on tablet portrait, narrower on landscape */}
          <section className={`md:col-span-3 lg:col-span-4 min-h-[240px] lg:min-h-[280px] ${cardClass}`}>
            <DeadlinesWidget
              deadlines={deadlines}
              onAddDeadline={addDeadline}
              onUpdateDeadline={updateDeadline}
              onDeleteDeadline={confirmDeleteDeadline}
            />
          </section>

          {/* Schedule */}
          <section className={`md:col-span-3 lg:col-span-5 min-h-[240px] lg:min-h-[280px] ${cardClass}`}>
            <ScheduleWidget
              currentTime={currentTime}
              blocks={scheduleBlocks}
              events={todaysTimedEvents}
              onOpenCalendar={() => openCalendar(todayKey)}
              onAddBlock={addScheduleBlock}
              onUpdateBlock={updateScheduleBlock}
              onDeleteBlock={confirmDeleteScheduleBlock}
            />
          </section>

          {/* Todo List - spans full width on tablet */}
          <section className={`md:col-span-6 lg:col-span-3 min-h-[240px] lg:min-h-[280px] ${cardClass}`}>
            <TodoWidget
              todos={todos}
              boards={boards}
              onAddTodo={addTodo}
              onToggleTodo={toggleTodo}
              onDeleteTodo={confirmDeleteTodo}
            />
          </section>

          {/* Calendar: mini month + next 7 days */}
          <section className={`md:col-span-6 lg:col-span-12 ${cardClass}`}>
            <CalendarWidget entriesByDate={entriesByDate} todoMap={todoMap} onOpenCalendar={openCalendar} />
          </section>

          {/* Quick Capture */}
          <section className={`md:col-span-3 lg:col-span-4 h-[420px] ${cardClass}`}>
            <QuickCaptureWidget
              captures={quickCaptures}
              onAddCapture={addQuickCapture}
              onUpdateCapture={updateQuickCapture}
              onDeleteCapture={confirmDeleteQuickCapture}
            />
          </section>

          {/* Focus Timer (Pomodoro) */}
          <section className={`md:col-span-3 lg:col-span-4 h-[420px] ${cardClass}`}>
            <PomodoroWidget />
          </section>

          {/* Recent Notes */}
          <section className={`md:col-span-6 lg:col-span-4 h-[420px] ${cardClass}`}>
            <RecentNotesWidget notes={notes} sections={sections} onNavigate={handleNoteNavigate} />
          </section>
        </div>
      </div>
    </main>
  );
}
