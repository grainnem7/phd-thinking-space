import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, addDays,
} from 'date-fns';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, Plus, Tags } from 'lucide-react';
import { useCalendar } from '../../hooks/useCalendar';
import { useDashboard } from '../../hooks/useDashboard';
import { useReadingList } from '../../hooks/useReadingList';
import { useGoogleCalendar } from '../../hooks/useGoogleCalendar';
import { useBoards } from '../../hooks/useBoards';
import { useCalendarCategories } from '../../hooks/useCalendarCategories';
import { useConfirm } from '../common/ConfirmDialog';
import { parseLocalDate, toDateKey } from '../../utils/date';
import { sameRecurrence, addDaysToKey } from '../../lib/recurrence';
import { buildEntries, groupByDate, todosByDate, spanBase, HIDDEN_CATEGORIES_KEY, loadHiddenCategories } from './calendarEntries';
import { useCalendarSensors, dayCollision } from './calendarDnd';
import { useSeriesActions } from './useSeriesActions';
import EventModal from './EventModal';
import DayPanel from './DayPanel';
import GoogleCalendarControl from './GoogleCalendarControl';
import { CategoryManager } from './CategoryControls';
import { colorVars } from './categoryColors';
import MonthDayCell, { DragPreview } from './MonthDayCell';
import { SeriesScopeDialog, MoveToDialog, UndoToast } from './CalendarDialogs';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const shortDay = (key) => format(parseLocalDate(key), 'EEE d MMM');
const longDay = (key) => format(parseLocalDate(key), 'EEEE d MMMM');
const dragName = (data) => (data?.kind === 'todo' ? `to-do ${data.todo.title}` : data?.entry?.title || 'item');

const SCREEN_READER_INSTRUCTIONS = {
  draggable: 'To move this item, press Space or Enter to pick it up, use the arrow keys to choose a day in the month, then press Space or Enter to drop it. Press Escape to cancel. You can also use the Move to action.',
};

const ANNOUNCEMENTS = {
  onDragStart: ({ active }) => `Picked up ${dragName(active.data.current)}. Use the arrow keys to choose a day.`,
  onDragOver: ({ active, over }) => (over?.data.current?.date
    ? `${dragName(active.data.current)} is over ${longDay(over.data.current.date)}.`
    : `${dragName(active.data.current)} is not over a day.`),
  onDragEnd: ({ active, over }) => (over?.data.current?.date && over.data.current.date !== active.data.current?.date
    ? `Dropped ${dragName(active.data.current)} on ${longDay(over.data.current.date)}.`
    : `${dragName(active.data.current)} was not moved.`),
  onDragCancel: ({ active }) => `Cancelled. ${dragName(active.data.current)} was not moved.`,
};

// Board task due dates are saved through useBoards, which is bound to one board;
// each bridge registers its board's updateTask with the calendar.
function BoardTaskBridge({ boardId, register }) {
  const { updateTask } = useBoards(boardId);
  useEffect(() => register(boardId, updateTask), [boardId, updateTask, register]);
  return null;
}

export default function CalendarView({ initialDate, sections = [], onSelect }) {
  const todayKey = toDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(initialDate || todayKey);
  const [month, setMonth] = useState(() => startOfMonth(parseLocalDate(initialDate || todayKey)));
  const [modal, setModal] = useState({ open: false, entry: null, defaults: null });
  const [activeDrag, setActiveDrag] = useState(null);
  const [scopeRequest, setScopeRequest] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const [manageCategories, setManageCategories] = useState(false);
  const [hiddenCategories, setHiddenCategories] = useState(loadHiddenCategories);
  const [announcement, setAnnouncement] = useState('');
  const gridRef = useRef(null);
  const panelRef = useRef(null);
  const focusAfterMove = useRef(false);
  const taskUpdaters = useRef(new Map());

  const confirm = useConfirm();
  const { items, addItem, updateItem, deleteItem, moveItems } = useCalendar();
  const { deadlines, addDeadline, updateDeadline, deleteDeadline } = useDashboard();
  const { papers } = useReadingList();
  const { categories } = useCalendarCategories();

  const toggleCategory = (id) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try { localStorage.setItem(HIDDEN_CATEGORIES_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };
  const { changeEvent, deleteEvent, duplicateEvent } = useSeriesActions({ items, addItem, updateItem, deleteItem });
  const sensors = useCalendarSensors();

  const days = useMemo(() => eachDayOfInterval({
    start: startOfWeek(month, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  }), [month]);
  const rangeStart = toDateKey(days[0]);
  const rangeEnd = toDateKey(days[days.length - 1]);
  const selectedInGrid = selectedDate >= rangeStart && selectedDate <= rangeEnd;

  const google = useGoogleCalendar(rangeStart, rangeEnd);

  // The day panel can show a date outside the visible grid, so widen the range to include it
  const entriesByDate = useMemo(() => groupByDate(buildEntries({
    items,
    deadlines,
    sections,
    googleEvents: google.events,
    categories,
    range: {
      start: selectedDate < rangeStart ? selectedDate : rangeStart,
      end: selectedDate > rangeEnd ? selectedDate : rangeEnd,
    },
  }).filter((e) => !(e.source === 'event' && e.category && hiddenCategories.has(e.category.id)))),
  [items, deadlines, sections, google.events, categories, hiddenCategories, rangeStart, rangeEnd, selectedDate]);
  const todoMap = useMemo(() => todosByDate(items), [items]);
  const boardIds = useMemo(() => sections.filter((s) => s.type === 'board').map((s) => s.id), [sections]);

  const registerTaskUpdater = useCallback((boardId, updateTask) => {
    taskUpdaters.current.set(boardId, updateTask);
    return () => {
      if (taskUpdaters.current.get(boardId) === updateTask) taskUpdaters.current.delete(boardId);
    };
  }, []);

  const selectDate = useCallback((key, { scroll = false } = {}) => {
    setSelectedDate(key);
    const d = parseLocalDate(key);
    setMonth((m) => (isSameMonth(d, m) ? m : startOfMonth(d)));
    if (scroll && window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, []);

  // Keep keyboard focus on the selected cell after arrow-key navigation
  useEffect(() => {
    if (!focusAfterMove.current) return;
    focusAfterMove.current = false;
    gridRef.current?.querySelector(`[data-date="${selectedDate}"]`)?.focus();
  }, [selectedDate, month]);

  const handleGridKeyDown = (e) => {
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(e.key in offsets) || !e.target.matches('[data-date]')) return;
    e.preventDefault();
    focusAfterMove.current = true;
    selectDate(toDateKey(addDays(parseLocalDate(selectedDate), offsets[e.key])));
  };

  const dismissToast = useCallback(() => setToast(null), []);
  const showToast = (message, undo) => {
    setToast({ id: Date.now(), message, undo });
    setAnnouncement(undo ? `${message}. Undo is available for a few seconds.` : message);
  };
  const handleUndo = async () => {
    const current = toast;
    setToast(null);
    if (!current?.undo) return;
    await current.undo();
    setAnnouncement('Undone.');
  };

  // Resolves to 'this' | 'following' | 'all', or null when cancelled
  const askScope = (request) => new Promise((resolve) => setScopeRequest({ ...request, resolve }));
  const chooseScope = (scope) => {
    scopeRequest?.resolve(scope);
    setScopeRequest(null);
  };

  const moveEntry = async (dayEntry, dropDate) => {
    // Dropping day N of a multi-day event moves the whole event so that day lands there
    const entry = spanBase(dayEntry);
    const date = dayEntry?.span && dropDate ? addDaysToKey(dropDate, -dayEntry.span.index) : dropDate;
    if (!date || date === entry.date) return;
    let undo = null;
    if (entry.source === 'deadline') {
      const from = entry.date;
      await updateDeadline(entry.deadlineId, { date });
      undo = () => updateDeadline(entry.deadlineId, { date: from });
    } else if (entry.source === 'task') {
      const updateTask = taskUpdaters.current.get(entry.boardId);
      if (!updateTask) return;
      const from = entry.date;
      await updateTask(entry.taskId, { dueDate: date });
      undo = () => updateTask(entry.taskId, { dueDate: from });
    } else if (entry.source === 'event') {
      let scope = 'all';
      if (entry.seriesId) {
        scope = await askScope({ title: entry.title, verb: 'Move' });
        if (!scope) {
          setAnnouncement(`${entry.title} was not moved.`);
          return;
        }
      }
      undo = await changeEvent({ entry, scope, date });
    } else {
      return;
    }
    showToast(`Moved “${entry.title}” to ${shortDay(date)}`, undo);
  };

  const moveTodo = async (todo, date) => {
    if (!date || date === todo.date) return;
    const order = (todoMap.get(date) || []).reduce((max, t) => Math.max(max, t.order ?? 0), -1) + 1;
    const from = { date: todo.date, order: todo.order ?? 0 };
    await updateItem(todo.id, { date, order });
    showToast(`Moved to-do “${todo.title}” to ${shortDay(date)}`, () => updateItem(todo.id, from));
  };

  const handleDragEnd = ({ active, over }) => {
    setActiveDrag(null);
    const data = active.data.current;
    const date = over?.data.current?.date;
    if (!data || !date || date === data.date) return;
    if (data.kind === 'todo') moveTodo(data.todo, date);
    else moveEntry(data.entry, date);
  };

  const handleMoveTo = (date) => {
    const target = moveTarget;
    setMoveTarget(null);
    if (target?.todo) moveTodo(target.todo, date);
    else if (target?.entry) moveEntry(target.entry, date);
  };

  const handleDuplicate = async (dayEntry) => {
    const entry = spanBase(dayEntry);
    const id = await duplicateEvent(entry);
    if (id) showToast(`Duplicated “${entry.title}”`, () => deleteItem(id));
  };

  const openNew = (date, extra = {}) => setModal({ open: true, entry: null, defaults: { date, ...extra } });
  const closeModal = () => setModal({ open: false, entry: null, defaults: null });

  const handleOpenEntry = (entry) => {
    if (entry.source === 'event' || entry.source === 'deadline') {
      setModal({ open: true, entry: spanBase(entry), defaults: null });
    } else if (entry.source === 'task') {
      onSelect?.({ id: entry.boardId, openTaskId: entry.taskId });
    } else if (entry.source === 'google' && entry.htmlLink) {
      window.open(entry.htmlLink, '_blank', 'noopener,noreferrer');
    }
  };

  const handleOpenLink = (link) => {
    if (link.type === 'paper') {
      onSelect?.({ id: 'reading-list', type: 'reading-list', name: 'Reading List', paperId: link.id });
    } else {
      onSelect?.({ id: link.id });
    }
  };

  const handleSave = async ({ type, data }) => {
    const { entry } = modal;
    if (type === 'deadline') {
      closeModal();
      if (entry) await updateDeadline(entry.deadlineId, data);
      else await addDeadline({ ...data, createdAt: new Date().toISOString() });
    } else if (entry) {
      const { date, recurrence, ...changes } = data;
      let scope = 'all';
      if (entry.seriesId) {
        // Changing the rule itself can't apply to a single occurrence
        const ruleChanged = 'recurrence' in data && !sameRecurrence(recurrence, entry.recurrence, entry.date);
        scope = await askScope({ title: data.title, verb: 'Save', allowThis: !ruleChanged });
        if (!scope) return;
      }
      closeModal();
      await changeEvent({ entry, scope, date, changes, recurrence: 'recurrence' in data ? recurrence : undefined });
    } else {
      closeModal();
      await addItem(data.recurrence ? { ...data, exdates: [] } : data);
    }
    selectDate(data.date);
  };

  const handleDelete = async () => {
    const { entry } = modal;
    if (!entry) return;
    if (entry.seriesId) {
      const scope = await askScope({ title: entry.title, verb: 'Delete' });
      if (!scope) return;
      closeModal();
      await deleteEvent(entry, scope);
      return;
    }
    const ok = await confirm({
      title: `Delete "${entry.title}"?`,
      body: 'This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    closeModal();
    if (entry.source === 'deadline') await deleteDeadline(entry.deadlineId);
    else await deleteEvent(entry);
  };

  const selectedTodos = todoMap.get(selectedDate) || [];

  return (
    <main className="flex-1 overflow-auto bg-[#fafafa] dark:bg-neutral-950">
      {boardIds.map((id) => <BoardTaskBridge key={id} boardId={id} register={registerTaskUpdater} />)}
      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 lg:py-8">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-5">
          <div className="flex items-center gap-1 mr-auto">
            <h1 className="font-serif text-2xl sm:text-3xl font-medium text-neutral-900 dark:text-neutral-100 tracking-tight whitespace-nowrap sm:min-w-[12ch]" aria-live="polite">
              {format(month, 'MMMM yyyy')}
            </h1>
            <button type="button" onClick={() => setMonth((m) => subMonths(m, 1))} aria-label="Previous month" className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-white dark:hover:bg-neutral-900">
              <ChevronLeft size={20} />
            </button>
            <button type="button" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month" className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-white dark:hover:bg-neutral-900">
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => selectDate(todayKey)} className="px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-neutral-300 dark:hover:border-neutral-600 bg-white dark:bg-neutral-900">
              Today
            </button>
            <GoogleCalendarControl google={google} />
            <button
              type="button"
              onClick={() => openNew(selectedDate)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm bg-accent text-accent-fg rounded-lg hover:bg-accent-hover transition-colors"
            >
              <Plus size={16} /> New
            </button>
          </div>
        </header>

        {/* Category filter: tap a category to hide or show its events */}
        <div className="flex flex-wrap items-center gap-1.5 -mt-2 mb-4" role="group" aria-label="Show or hide categories">
          {categories.map((category) => {
            const hidden = hiddenCategories.has(category.id);
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={!hidden}
                onClick={() => toggleCategory(category.id)}
                title={hidden ? `Show ${category.name}` : `Hide ${category.name}`}
                style={colorVars(category.color)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring ${hidden
                  ? 'bg-transparent text-neutral-400 dark:text-neutral-500 border border-dashed border-neutral-300 dark:border-neutral-700'
                  : 'cat-chip border border-transparent'}`}
              >
                <span
                  aria-hidden="true"
                  style={colorVars(category.color)}
                  className={`w-2 h-2 rounded-full ${hidden ? 'bg-neutral-300 dark:bg-neutral-600' : 'cat-dot'}`}
                />
                <span className={hidden ? 'line-through' : ''}>{category.name}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setManageCategories(true)}
            className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
          >
            <Tags size={13} aria-hidden="true" />
            {categories.length ? 'Edit categories' : 'Add categories'}
          </button>
        </div>

        {google.error && (
          <p role="alert" className="mb-4 px-4 py-3 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900 rounded-lg">
            {google.error}
          </p>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={dayCollision}
          accessibility={{ announcements: ANNOUNCEMENTS, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
          onDragStart={({ active }) => setActiveDrag(active.data.current)}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveDrag(null)}
        >
          <div className="flex flex-col lg:flex-row gap-5 items-start">
            <div className="w-full flex-1 min-w-0 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
              <div className="grid grid-cols-7 border-b border-neutral-100 dark:border-neutral-800" aria-hidden="true">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="px-2 py-2.5 text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-widest text-center sm:text-left">
                    <span className="sm:hidden">{d[0]}</span><span className="hidden sm:inline">{d}</span>
                  </div>
                ))}
              </div>
              <div ref={gridRef} role="group" aria-label={format(month, 'MMMM yyyy')} onKeyDown={handleGridKeyDown} className="grid grid-cols-7">
                {days.map((day, i) => {
                  const key = toDateKey(day);
                  return (
                    <MonthDayCell
                      key={key}
                      day={day}
                      dateKey={key}
                      inMonth={isSameMonth(day, month)}
                      isToday={key === todayKey}
                      isSelected={key === selectedDate}
                      tabbable={key === selectedDate || (!selectedInGrid && key === toDateKey(month))}
                      entries={entriesByDate.get(key) || []}
                      todos={todoMap.get(key) || []}
                      borderClass={`${(i + 1) % 7 !== 0 ? 'border-r' : ''} ${i < days.length - 7 ? 'border-b' : ''}`}
                      onSelect={(k) => selectDate(k, { scroll: true })}
                      onOpenNew={openNew}
                      onOpenEntry={handleOpenEntry}
                    />
                  );
                })}
              </div>
            </div>

            <div className="w-full lg:w-[360px] xl:w-[400px] flex-shrink-0 lg:sticky lg:top-0">
              <DayPanel
                key={selectedDate}
                ref={panelRef}
                dateKey={selectedDate}
                entries={entriesByDate.get(selectedDate) || []}
                todos={selectedTodos}
                onNewEvent={() => openNew(selectedDate)}
                onOpenEntry={handleOpenEntry}
                onOpenLink={handleOpenLink}
                onQuickAddEvent={(data) => addItem({ kind: 'event', date: selectedDate, allDay: false, color: 'sky', notes: '', links: [], ...data })}
                onAddTodo={(title) => addItem({
                  kind: 'todo',
                  title,
                  date: selectedDate,
                  completed: false,
                  order: selectedTodos.reduce((max, t) => Math.max(max, t.order ?? 0), -1) + 1,
                })}
                onToggleTodo={(todo) => updateItem(todo.id, { completed: !todo.completed })}
                onDeleteTodo={(todo) => deleteItem(todo.id)}
                onMoveUnfinished={(todos) => moveItems(todos.map((t) => t.id), toDateKey(addDays(parseLocalDate(selectedDate), 1)))}
                onMoveEntry={(dayEntry) => {
                  const entry = spanBase(dayEntry);
                  setMoveTarget({ key: `entry:${entry.id}`, title: entry.title, date: entry.date, entry });
                }}
                onDuplicateEntry={handleDuplicate}
                onMoveTodo={(todo) => setMoveTarget({ key: `todo:${todo.id}`, title: todo.title, date: todo.date, todo })}
              />
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            <DragPreview item={activeDrag} />
          </DragOverlay>
        </DndContext>
      </div>

      <CategoryManager isOpen={manageCategories} onClose={() => setManageCategories(false)} />

      <EventModal
        isOpen={modal.open}
        onClose={closeModal}
        entry={modal.entry}
        defaults={modal.defaults}
        sections={sections}
        papers={papers}
        onSave={handleSave}
        onDelete={handleDelete}
      />
      <SeriesScopeDialog request={scopeRequest} onChoose={chooseScope} />
      <MoveToDialog target={moveTarget} onClose={() => setMoveTarget(null)} onMove={handleMoveTo} />
      <UndoToast key={toast?.id} toast={toast} onUndo={handleUndo} onDismiss={dismissToast} />
    </main>
  );
}
