import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, addDays,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, CheckSquare } from 'lucide-react';
import { useCalendar } from '../../hooks/useCalendar';
import { useDashboard } from '../../hooks/useDashboard';
import { useReadingList } from '../../hooks/useReadingList';
import { useGoogleCalendar } from '../../hooks/useGoogleCalendar';
import { useConfirm } from '../common/ConfirmDialog';
import { parseLocalDate, toDateKey } from '../../utils/date';
import { buildEntries, groupByDate, todosByDate, styleFor } from './calendarEntries';
import EventModal from './EventModal';
import DayPanel from './DayPanel';
import GoogleCalendarControl from './GoogleCalendarControl';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_CHIPS = 3;

export default function CalendarView({ initialDate, sections = [], onSelect }) {
  const todayKey = toDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(initialDate || todayKey);
  const [month, setMonth] = useState(() => startOfMonth(parseLocalDate(initialDate || todayKey)));
  const [modal, setModal] = useState({ open: false, entry: null, defaults: null });
  const gridRef = useRef(null);
  const panelRef = useRef(null);
  const focusAfterMove = useRef(false);

  const confirm = useConfirm();
  const { items, addItem, updateItem, deleteItem, moveItems } = useCalendar();
  const { deadlines, addDeadline, updateDeadline, deleteDeadline } = useDashboard();
  const { papers } = useReadingList();

  const days = useMemo(() => eachDayOfInterval({
    start: startOfWeek(month, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  }), [month]);
  const rangeStart = toDateKey(days[0]);
  const rangeEnd = toDateKey(days[days.length - 1]);
  const selectedInGrid = selectedDate >= rangeStart && selectedDate <= rangeEnd;

  const google = useGoogleCalendar(rangeStart, rangeEnd);

  const entriesByDate = useMemo(
    () => groupByDate(buildEntries({ items, deadlines, sections, googleEvents: google.events })),
    [items, deadlines, sections, google.events],
  );
  const todoMap = useMemo(() => todosByDate(items), [items]);

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
    if (!(e.key in offsets)) return;
    e.preventDefault();
    focusAfterMove.current = true;
    selectDate(toDateKey(addDays(parseLocalDate(selectedDate), offsets[e.key])));
  };

  const openNew = (date, extra = {}) => setModal({ open: true, entry: null, defaults: { date, ...extra } });
  const closeModal = () => setModal({ open: false, entry: null, defaults: null });

  const handleOpenEntry = (entry) => {
    if (entry.source === 'event' || entry.source === 'deadline') {
      setModal({ open: true, entry, defaults: null });
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
    closeModal();
    if (type === 'deadline') {
      if (entry) await updateDeadline(entry.deadlineId, data);
      else await addDeadline({ ...data, createdAt: new Date().toISOString() });
    } else if (entry) {
      await updateItem(entry.id, data);
    } else {
      await addItem(data);
    }
    selectDate(data.date);
  };

  const handleDelete = async () => {
    const { entry } = modal;
    if (!entry) return;
    const ok = await confirm({
      title: `Delete "${entry.title}"?`,
      body: 'This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    closeModal();
    if (entry.source === 'deadline') await deleteDeadline(entry.deadlineId);
    else await deleteItem(entry.id);
  };

  const selectedTodos = todoMap.get(selectedDate) || [];

  return (
    <main className="flex-1 overflow-auto bg-[#fafafa] dark:bg-neutral-950">
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
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg hover:bg-neutral-800 dark:hover:bg-white transition-colors"
            >
              <Plus size={16} /> New
            </button>
          </div>
        </header>

        {google.error && (
          <p role="alert" className="mb-4 px-4 py-3 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900 rounded-lg">
            {google.error}
          </p>
        )}

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
                const dayEntries = entriesByDate.get(key) || [];
                const dayTodos = todoMap.get(key) || [];
                const inMonth = isSameMonth(day, month);
                const isToday = key === todayKey;
                const isSelected = key === selectedDate;
                const hidden = dayEntries.length - MAX_CHIPS;
                const doneTodos = dayTodos.filter((t) => t.completed).length;
                const label = `${format(day, 'EEEE d MMMM')}${dayEntries.length ? `, ${dayEntries.length} item${dayEntries.length === 1 ? '' : 's'}` : ''}${dayTodos.length ? `, ${doneTodos} of ${dayTodos.length} to-dos done` : ''}`;

                return (
                  <button
                    key={key}
                    type="button"
                    data-date={key}
                    aria-pressed={isSelected}
                    aria-current={isToday ? 'date' : undefined}
                    aria-label={label}
                    tabIndex={isSelected || (!selectedInGrid && key === toDateKey(month)) ? 0 : -1}
                    onClick={() => selectDate(key, { scroll: true })}
                    onDoubleClick={() => openNew(key)}
                    className={`relative min-h-[64px] sm:min-h-[104px] xl:min-h-[118px] p-1 sm:p-1.5 flex flex-col items-stretch text-left border-neutral-100 dark:border-neutral-800 transition-colors focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-400
                      ${(i + 1) % 7 !== 0 ? 'border-r' : ''} ${i < days.length - 7 ? 'border-b' : ''}
                      ${inMonth ? '' : 'bg-neutral-50/70 dark:bg-neutral-950/40'}
                      ${isSelected ? 'bg-neutral-100/80 dark:bg-neutral-800/70' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40'}`}
                  >
                    <span className={`self-center sm:self-start w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full text-xs sm:text-sm tabular-nums
                      ${isToday ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-medium' : inMonth ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-300 dark:text-neutral-600'}`}
                    >
                      {day.getDate()}
                    </span>

                    {/* Phones: dots only */}
                    {(dayEntries.length > 0 || dayTodos.length > 0) && (
                      <span className="sm:hidden flex justify-center flex-wrap gap-0.5 mt-1" aria-hidden="true">
                        {dayEntries.slice(0, 4).map((e) => (
                          <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${styleFor(e).dot}`} style={e.source === 'google' ? { backgroundColor: e.colorHex } : undefined} />
                        ))}
                        {dayTodos.length > 0 && <span className="w-1.5 h-1.5 rounded-full border border-neutral-400" />}
                      </span>
                    )}

                    {/* Larger screens: chips */}
                    <span className="hidden sm:flex flex-col gap-0.5 mt-1 min-w-0" aria-hidden="true">
                      {dayEntries.slice(0, MAX_CHIPS).map((e) => {
                        const style = styleFor(e);
                        return (
                          <span key={e.id} className={`flex items-center gap-1 px-1.5 py-px rounded text-[11px] leading-4 min-w-0 ${style.chip} ${e.done ? 'line-through opacity-60' : ''}`}>
                            {e.source === 'google' && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: e.colorHex }} />}
                            {!e.allDay && <span className="tabular-nums opacity-70 flex-shrink-0">{e.startTime}</span>}
                            <span className="truncate">{e.title}</span>
                          </span>
                        );
                      })}
                      {hidden > 0 && <span className="px-1.5 text-[11px] leading-4 text-neutral-400">+{hidden} more</span>}
                    </span>

                    {dayTodos.length > 0 && (
                      <span className={`hidden sm:flex items-center gap-1 mt-auto pt-1 px-1 text-[11px] tabular-nums ${doneTodos === dayTodos.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-400'}`} aria-hidden="true">
                        <CheckSquare size={11} /> {doneTodos}/{dayTodos.length}
                      </span>
                    )}
                  </button>
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
            />
          </div>
        </div>
      </div>

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
    </main>
  );
}
