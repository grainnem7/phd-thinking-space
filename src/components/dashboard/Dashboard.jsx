import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { LayoutGrid, Plus, RotateCcw, Check } from 'lucide-react';
import { useDashboard } from '../../hooks/useDashboard';
import { useDashboardLayout, DASHBOARD_WIDGETS, computeSpans } from '../../hooks/useDashboardLayout';
import { useFirestore } from '../../hooks/useFirestore';
import { useCalendar } from '../../hooks/useCalendar';
import { useGoogleCalendar } from '../../hooks/useGoogleCalendar';
import { toDateKey } from '../../utils/date';
import { useConfirm } from '../common/ConfirmDialog';
import CalendarWidget from '../calendar/CalendarWidget';
import { buildEntries, groupByDate, todosByDate, dashboardCalendarRange } from '../calendar/calendarEntries';
import SortableWidget from './SortableWidget';
import DeadlinesWidget from './widgets/DeadlinesWidget';
import ScheduleWidget from './widgets/ScheduleWidget';
import TodoWidget from './widgets/TodoWidget';
import QuickCaptureWidget from './widgets/QuickCaptureWidget';
import PomodoroWidget from './widgets/PomodoroWidget';
import RecentNotesWidget from './widgets/RecentNotesWidget';
import WritingWidget from './widgets/WritingWidget';

const TITLES = Object.fromEntries(DASHBOARD_WIDGETS.map((w) => [w.id, w.title]));

// Card heights per widget (rows stretch to their tallest card)
const HEIGHTS = {
  deadlines: 'min-h-[240px] lg:min-h-[280px]',
  schedule: 'min-h-[240px] lg:min-h-[280px]',
  todo: 'min-h-[240px] lg:min-h-[280px]',
  calendar: '',
  quickCapture: 'h-[420px]',
  pomodoro: 'h-[420px]',
  recentNotes: 'h-[420px]',
  writing: 'min-h-[260px]',
};

const headerButton =
  'inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-600';
const quietButton = `${headerButton} text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600`;
const solidButton = `${headerButton} text-white bg-neutral-900 hover:bg-neutral-800 border-neutral-900 dark:text-neutral-900 dark:bg-neutral-100 dark:hover:bg-neutral-200 dark:border-neutral-100`;

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard({ notes = [], sections = [], onSelect }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [editing, setEditing] = useState(false);

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

  const layout = useDashboardLayout();
  const { sections: allSections } = useFirestore();
  const confirm = useConfirm();

  const boards = useMemo(() => {
    return allSections.filter(s => s.type === 'board');
  }, [allSections]);

  const { items: calendarItems } = useCalendar();
  const { start: rangeStart, end: rangeEnd } = dashboardCalendarRange(currentTime);
  const google = useGoogleCalendar(rangeStart, rangeEnd);
  const entriesByDate = useMemo(
    () => groupByDate(buildEntries({ items: calendarItems, deadlines, sections: allSections, googleEvents: google.events, range: { start: rangeStart, end: rangeEnd } })),
    [calendarItems, deadlines, allSections, google.events, rangeStart, rangeEnd],
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

  // --- Layout editing -------------------------------------------------------

  const { widgets, reorderVisible, setVisible, setSize, resetLayout } = layout;
  const visible = useMemo(() => widgets.filter((w) => w.visible), [widgets]);
  const hidden = useMemo(() => widgets.filter((w) => !w.visible), [widgets]);
  const visibleIds = useMemo(() => visible.map((w) => w.id), [visible]);
  const spans = useMemo(() => computeSpans(visible), [visible]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(({ active, over }) => {
    if (!over || active.id === over.id) return;
    const from = visibleIds.indexOf(active.id);
    const to = visibleIds.indexOf(over.id);
    if (from < 0 || to < 0) return;
    reorderVisible(arrayMove(visibleIds, from, to));
  }, [visibleIds, reorderVisible]);

  // Which widget control should get focus back after a move re-renders the grid
  const focusRequest = useRef(null);
  const takeFocusRequest = useCallback((id) => {
    const request = focusRequest.current;
    if (!request || request.id !== id) return null;
    focusRequest.current = null;
    return request.action;
  }, []);

  const moveWidget = useCallback((id, delta) => {
    const from = visibleIds.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= visibleIds.length) return;
    focusRequest.current = { id, action: delta < 0 ? 'up' : 'down' };
    reorderVisible(arrayMove(visibleIds, from, to));
  }, [visibleIds, reorderVisible]);

  const announcements = useMemo(() => {
    const name = (id) => TITLES[id] || 'widget';
    const position = (id) => visibleIds.indexOf(id) + 1;
    return {
      onDragStart: ({ active }) => `Picked up ${name(active.id)}, position ${position(active.id)} of ${visibleIds.length}.`,
      onDragOver: ({ active, over }) => (over ? `${name(active.id)} is over position ${position(over.id)}.` : `${name(active.id)} is not over a position.`),
      onDragEnd: ({ active, over }) => (over ? `${name(active.id)} dropped at position ${position(over.id)}.` : `${name(active.id)} dropped.`),
      onDragCancel: ({ active }) => `Moving ${name(active.id)} cancelled.`,
    };
  }, [visibleIds]);

  const handleReset = useCallback(async () => {
    const ok = await confirm({
      title: 'Reset home screen layout?',
      body: 'All widgets will be shown again in their original order and sizes.',
      confirmLabel: 'Reset',
      danger: false,
    });
    if (ok) resetLayout();
  }, [confirm, resetLayout]);

  const renderWidget = (id, size) => {
    switch (id) {
      case 'deadlines':
        return (
          <DeadlinesWidget
            deadlines={deadlines}
            onAddDeadline={addDeadline}
            onUpdateDeadline={updateDeadline}
            onDeleteDeadline={confirmDeleteDeadline}
          />
        );
      case 'schedule':
        return (
          <ScheduleWidget
            currentTime={currentTime}
            blocks={scheduleBlocks}
            events={todaysTimedEvents}
            onOpenCalendar={() => openCalendar(todayKey)}
            onAddBlock={addScheduleBlock}
            onUpdateBlock={updateScheduleBlock}
            onDeleteBlock={confirmDeleteScheduleBlock}
          />
        );
      case 'todo':
        return (
          <TodoWidget
            todos={todos}
            boards={boards}
            onAddTodo={addTodo}
            onToggleTodo={toggleTodo}
            onDeleteTodo={confirmDeleteTodo}
          />
        );
      case 'calendar':
        return <CalendarWidget entriesByDate={entriesByDate} todoMap={todoMap} onOpenCalendar={openCalendar} />;
      case 'quickCapture':
        return (
          <QuickCaptureWidget
            captures={quickCaptures}
            onAddCapture={addQuickCapture}
            onUpdateCapture={updateQuickCapture}
            onDeleteCapture={confirmDeleteQuickCapture}
          />
        );
      case 'pomodoro':
        return <PomodoroWidget />;
      case 'recentNotes':
        return <RecentNotesWidget notes={notes} sections={sections} onNavigate={(note) => onSelect?.(note)} />;
      case 'writing':
        return <WritingWidget size={size} />;
      default:
        return null;
    }
  };

  if (isLoading || !layout.loaded) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--bg-page)]" role="status">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-600 dark:border-neutral-700 dark:border-t-neutral-300 rounded-full animate-spin mx-auto mb-3" aria-hidden="true" />
          <p className="text-base text-neutral-400 dark:text-neutral-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="flex-1 overflow-auto bg-[var(--bg-page)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 lg:py-8">
        {/* Header */}
        <header className="mb-5 sm:mb-6 lg:mb-10 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">
              {currentTime.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-medium text-neutral-900 dark:text-neutral-100 tracking-tight">
              {editing ? 'Customise home' : getGreeting()}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button type="button" onClick={handleReset} className={quietButton}>
                  <RotateCcw size={16} aria-hidden="true" />
                  Reset layout
                </button>
                <button type="button" onClick={() => setEditing(false)} className={solidButton}>
                  <Check size={16} aria-hidden="true" />
                  Done
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setEditing(true)} className={quietButton}>
                <LayoutGrid size={16} aria-hidden="true" />
                Customise
              </button>
            )}
          </div>
        </header>

        {editing && (
          <div className="mb-4 lg:mb-5 p-4 sm:px-6 bg-white dark:bg-neutral-900 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Drag widgets by their handle (or use the arrows) to reorder, choose a size, or hide the ones you don't need.
            </p>
            <h2 className="mt-4 mb-2 text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-widest font-medium">Add widget</h2>
            {hidden.length === 0 ? (
              <p className="text-sm text-neutral-400 dark:text-neutral-500">Every widget is on your home screen.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {hidden.map((w) => (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => setVisible(w.id, true)}
                      className={quietButton}
                      aria-label={`Add ${TITLES[w.id]} widget`}
                    >
                      <Plus size={16} aria-hidden="true" />
                      {TITLES[w.id]}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {visible.length === 0 && !editing ? (
          <div className="py-16 text-center">
            <p className="text-neutral-500 dark:text-neutral-400 mb-4">Your home screen is empty.</p>
            <button type="button" onClick={() => setEditing(true)} className={quietButton}>
              <LayoutGrid size={16} aria-hidden="true" />
              Add widgets
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            accessibility={{ announcements }}
          >
            <SortableContext items={visibleIds} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-4 lg:gap-5">
                {visible.map((w, index) => (
                  <SortableWidget
                    key={w.id}
                    id={w.id}
                    title={TITLES[w.id]}
                    size={w.size}
                    span={spans[w.id]}
                    heightClass={HEIGHTS[w.id]}
                    editing={editing}
                    isFirst={index === 0}
                    isLast={index === visible.length - 1}
                    onMove={moveWidget}
                    onHide={(id) => setVisible(id, false)}
                    onResize={setSize}
                    takeFocusRequest={takeFocusRequest}
                  >
                    {renderWidget(w.id, w.size)}
                  </SortableWidget>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </main>
  );
}
