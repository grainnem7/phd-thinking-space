import { useState, useEffect, forwardRef } from 'react';
import { format, differenceInCalendarDays } from 'date-fns';
import { useDraggable } from '@dnd-kit/core';
import {
  Plus, Flag, Kanban, ExternalLink, FileText, BookOpen, X, ArrowRight, Check,
  GripVertical, Ellipsis, CalendarDays, Copy, Repeat,
} from 'lucide-react';
import Dropdown, { DropdownItem } from '../common/Dropdown';
import { parseLocalDate, timeToMinutes, toDateKey } from '../../utils/date';
import { styleFor } from './calendarEntries';
import { canMoveEntry, canDragTodo } from './calendarDnd';
import { INPUT_CLASS } from './EventModal';
import { useCalendarCategories } from '../../hooks/useCalendarCategories';
import { REPEAT_OPTIONS, repeatFormFrom, recurrenceFromForm } from './repeatForm';

function relativeLabel(dateKey) {
  const diff = differenceInCalendarDays(parseLocalDate(dateKey), new Date());
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return diff > 0 ? `In ${diff} days` : `${Math.abs(diff)} days ago`;
}

function minutesToTime(mins) {
  const clamped = Math.max(0, Math.min(mins, 23 * 60 + 59));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

function SectionHeading({ children, aside }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-widest font-medium">{children}</h3>
      {aside}
    </div>
  );
}

function EntryMeta({ entry }) {
  if (entry.source === 'deadline') return <><Flag size={12} /> Deadline</>;
  if (entry.source === 'task') return <><Kanban size={12} /> {entry.boardName}{entry.done ? ' · done' : ''}</>;
  if (entry.source === 'google') return <><ExternalLink size={12} /> {entry.calendarName}</>;
  return null;
}

const HANDLE_CLASS = 'p-1 text-neutral-300 hover:text-neutral-600 dark:text-neutral-600 dark:hover:text-neutral-300 rounded cursor-grab touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400';
const ROW_ACTION_CLASS = 'p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400';

function EntryRow({ entry, isNow, onOpen, onOpenLink, onMove, onDuplicate }) {
  const style = styleFor(entry);
  const meta = <EntryMeta entry={entry} />;
  const movable = canMoveEntry(entry);
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `panel:${entry.id}`,
    data: { kind: 'entry', entry, date: entry.date },
    disabled: !movable,
  });
  return (
    <li
      ref={setNodeRef}
      className={`rounded-lg border-l-[3px] ${style.bar} ${isNow ? 'bg-neutral-100 dark:bg-neutral-800' : 'bg-neutral-50 dark:bg-neutral-800/50'} ${isDragging ? 'opacity-40' : ''}`}
      style={entry.source === 'google' ? { borderLeftColor: entry.colorHex } : style.vars}
    >
      <div className="flex items-start">
        <button
          type="button"
          onClick={() => onOpen(entry)}
          className="flex-1 min-w-0 text-left px-3 py-2.5 rounded-r-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <span className="flex flex-wrap items-baseline gap-x-2">
            {!entry.allDay && (
              <span className="text-sm tabular-nums text-neutral-500 dark:text-neutral-400 flex-shrink-0">
                {entry.startTime}{entry.endTime ? `–${entry.endTime}` : ''}
              </span>
            )}
            <span className={`text-base text-neutral-900 dark:text-neutral-100 min-w-0 break-words ${entry.done ? 'line-through text-neutral-400 dark:text-neutral-500' : ''}`}>
              {entry.title}
            </span>
            {entry.category && (
              <span className="cat-chip px-1.5 py-px text-[11px] rounded" style={style.vars}>{entry.category.name}</span>
            )}
            {entry.seriesId && <Repeat size={13} className="self-center text-neutral-400 flex-shrink-0" aria-label="Repeats" />}
            {isNow && <span className="ml-auto text-xs text-rose-500 font-medium uppercase flex-shrink-0">Now</span>}
          </span>
          {entry.source !== 'event' && (
            <span className="flex items-center gap-1 text-xs text-neutral-400 dark:text-neutral-500 mt-1 truncate">{meta}</span>
          )}
          {entry.notes && <span className="block text-sm text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2 whitespace-pre-line">{entry.notes}</span>}
        </button>
        {movable && (
          <div className="flex items-center gap-0.5 pt-1.5 pr-1.5 flex-shrink-0">
            <button
              type="button"
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              aria-label={`Drag ${entry.title} to another day`}
              title="Drag to a day in the month"
              className={HANDLE_CLASS}
            >
              <GripVertical size={16} />
            </button>
            <Dropdown
              align="right"
              trigger={(
                <button type="button" aria-label={`Actions for ${entry.title}`} className={ROW_ACTION_CLASS}>
                  <Ellipsis size={16} />
                </button>
              )}
            >
              {({ close }) => (
                <>
                  <DropdownItem onClick={() => { close(); onMove(entry); }}><CalendarDays size={15} /> Move to…</DropdownItem>
                  {entry.source === 'event' && (
                    <DropdownItem onClick={() => { close(); onDuplicate(entry); }}><Copy size={15} /> Duplicate</DropdownItem>
                  )}
                </>
              )}
            </Dropdown>
          </div>
        )}
      </div>
      {entry.links?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2.5 -mt-1">
          {entry.links.map((link) => (
            <button
              key={`${link.type}:${link.id}`}
              type="button"
              onClick={() => onOpenLink(link)}
              className="inline-flex items-center gap-1 max-w-full px-2 py-0.5 text-xs text-neutral-600 dark:text-neutral-300 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-md hover:border-neutral-300 dark:hover:border-neutral-600"
            >
              {link.type === 'paper' ? <BookOpen size={11} className="flex-shrink-0" /> : <FileText size={11} className="flex-shrink-0" />}
              <span className="truncate">{link.name}</span>
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

function TodoRow({ todo, todayKey, onToggle, onDelete, onMove }) {
  const draggable = canDragTodo(todo, todayKey);
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `todo:${todo.id}`,
    data: { kind: 'todo', todo, date: todo.date },
    disabled: !draggable,
  });
  return (
    <li ref={setNodeRef} className={`flex items-center gap-3 py-2 group ${isDragging ? 'opacity-40' : ''}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={Boolean(todo.completed)}
        aria-label={todo.title}
        onClick={() => onToggle(todo)}
        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${todo.completed
          ? 'bg-neutral-700 border-neutral-700 dark:bg-neutral-300 dark:border-neutral-300'
          : 'border-neutral-300 dark:border-neutral-600 hover:border-neutral-500'}`}
      >
        {todo.completed && <Check size={12} strokeWidth={3} className="text-white dark:text-neutral-900" />}
      </button>
      <span className={`flex-1 min-w-0 break-words text-base ${todo.completed ? 'text-neutral-400 line-through' : 'text-neutral-700 dark:text-neutral-200'}`}>
        {todo.title}
      </span>
      <div className="flex items-center sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => onMove(todo)}
          aria-label={`Move to-do ${todo.title} to another day`}
          title="Move to…"
          className="p-1 text-neutral-300 hover:text-neutral-600 dark:hover:text-neutral-300"
        >
          <CalendarDays size={16} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(todo)}
          aria-label={`Delete to-do ${todo.title}`}
          className="p-1 text-neutral-300 hover:text-rose-500"
        >
          <X size={16} />
        </button>
      </div>
      {draggable && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Drag to-do ${todo.title} to another day`}
          title="Drag to a day in the month"
          className={HANDLE_CLASS}
        >
          <GripVertical size={16} />
        </button>
      )}
    </li>
  );
}

const DayPanel = forwardRef(function DayPanel({
  dateKey,
  entries = [],
  todos = [],
  onNewEvent,
  onOpenEntry,
  onOpenLink,
  onQuickAddEvent,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
  onMoveUnfinished,
  onMoveEntry,
  onDuplicateEntry,
  onMoveTodo,
}, ref) {
  const [todoText, setTodoText] = useState('');
  const [quickAdd, setQuickAdd] = useState(null);
  const { categories } = useCalendarCategories();
  const [now, setNow] = useState(() => new Date());
  const todayKey = toDateKey(now);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const date = parseLocalDate(dateKey);
  const allDay = entries.filter((e) => e.allDay);
  const timed = entries.filter((e) => !e.allDay);
  const isToday = differenceInCalendarDays(date, now) === 0;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const doneCount = todos.filter((t) => t.completed).length;
  const unfinished = todos.filter((t) => !t.completed);

  const startQuickAdd = () => {
    const lastEnd = timed.reduce((max, e) => Math.max(max, timeToMinutes(e.endTime) ?? 0), 0);
    let start = lastEnd || 9 * 60;
    if (isToday && start < nowMinutes) start = Math.ceil(nowMinutes / 30) * 30;
    setQuickAdd({ title: '', startTime: minutesToTime(start), endTime: minutesToTime(start + 60), categoryId: '', repeat: 'never' });
  };

  const submitQuickAdd = (e) => {
    e.preventDefault();
    if (!quickAdd?.title.trim()) return;
    if ((timeToMinutes(quickAdd.endTime) ?? 0) < (timeToMinutes(quickAdd.startTime) ?? 0)) return;
    onQuickAddEvent({
      title: quickAdd.title.trim(),
      startTime: quickAdd.startTime,
      endTime: quickAdd.endTime,
      categoryId: quickAdd.categoryId || null,
      recurrence: quickAdd.repeat === 'never'
        ? null
        : recurrenceFromForm({ ...repeatFormFrom(null, dateKey), preset: quickAdd.repeat }, dateKey),
    });
    setQuickAdd(null);
  };

  const submitTodo = (e) => {
    e.preventDefault();
    if (!todoText.trim()) return;
    onAddTodo(todoText.trim());
    setTodoText('');
  };

  const quickAddInvalid = quickAdd && (timeToMinutes(quickAdd.endTime) ?? 0) < (timeToMinutes(quickAdd.startTime) ?? 0);

  return (
    <section
      ref={ref}
      aria-label={`Plan for ${format(date, 'EEEE d MMMM')}`}
      className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden scroll-mt-4"
    >
      <header className="px-4 sm:px-5 py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
            {format(date, 'EEEE')} · {relativeLabel(dateKey)}
          </p>
          <h2 className="font-serif text-2xl font-medium text-neutral-900 dark:text-neutral-100 tracking-tight mt-0.5">
            {format(date, 'd MMMM yyyy')}
          </h2>
        </div>
        <button
          type="button"
          onClick={onNewEvent}
          aria-label="New event on this day"
          title="New event or deadline"
          className="p-2 -m-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          <Plus size={20} />
        </button>
      </header>

      <div className="px-4 sm:px-5 py-4 space-y-6">
        {allDay.length > 0 && (
          <div>
            <SectionHeading>All day</SectionHeading>
            <ul className="space-y-1.5">
              {allDay.map((entry) => (
                <EntryRow key={entry.id} entry={entry} onOpen={onOpenEntry} onOpenLink={onOpenLink} onMove={onMoveEntry} onDuplicate={onDuplicateEntry} />
              ))}
            </ul>
          </div>
        )}

        <div>
          <SectionHeading
            aside={!quickAdd && (
              <button type="button" onClick={startQuickAdd} className="flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors">
                <Plus size={14} /> Add
              </button>
            )}
          >
            Schedule
          </SectionHeading>

          {timed.length === 0 && !quickAdd && (
            <p className="text-sm text-neutral-400 dark:text-neutral-500 py-1">Nothing scheduled.</p>
          )}

          {timed.length > 0 && (
            <ul className="space-y-1.5">
              {timed.map((entry) => {
                const start = timeToMinutes(entry.startTime);
                const end = timeToMinutes(entry.endTime) ?? start;
                const isNow = isToday && start !== null && nowMinutes >= start && nowMinutes < end;
                return <EntryRow key={entry.id} entry={entry} isNow={isNow} onOpen={onOpenEntry} onOpenLink={onOpenLink} onMove={onMoveEntry} onDuplicate={onDuplicateEntry} />;
              })}
            </ul>
          )}

          {quickAdd && (
            <form onSubmit={submitQuickAdd} className="mt-2 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg space-y-2">
              <input
                type="text"
                value={quickAdd.title}
                onChange={(e) => setQuickAdd({ ...quickAdd, title: e.target.value })}
                onKeyDown={(e) => e.key === 'Escape' && setQuickAdd(null)}
                placeholder="What are you doing?"
                aria-label="Schedule item title"
                autoFocus
                className={INPUT_CLASS}
              />
              <div className="flex items-center gap-2">
                <input type="time" aria-label="Start time" value={quickAdd.startTime} onChange={(e) => setQuickAdd({ ...quickAdd, startTime: e.target.value })} className={INPUT_CLASS} />
                <span className="text-neutral-400">–</span>
                <input type="time" aria-label="End time" value={quickAdd.endTime} onChange={(e) => setQuickAdd({ ...quickAdd, endTime: e.target.value })} className={INPUT_CLASS} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  aria-label="Category"
                  value={quickAdd.categoryId}
                  onChange={(e) => setQuickAdd({ ...quickAdd, categoryId: e.target.value })}
                  className={INPUT_CLASS}
                >
                  <option value="">No category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select
                  aria-label="Repeat"
                  value={quickAdd.repeat}
                  onChange={(e) => setQuickAdd({ ...quickAdd, repeat: e.target.value })}
                  className={INPUT_CLASS}
                >
                  {REPEAT_OPTIONS.map(([id, label]) => (
                    <option key={id} value={id}>{id === 'never' ? 'Does not repeat' : `Repeats ${label.toLowerCase()}`}</option>
                  ))}
                </select>
              </div>
              {quickAddInvalid && <p className="text-sm text-rose-600">End time must be after the start time.</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setQuickAdd(null)} className="px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300">Cancel</button>
                <button type="submit" disabled={!quickAdd.title.trim() || quickAddInvalid} className="px-3 py-1.5 text-sm bg-accent text-accent-fg hover:bg-accent-hover rounded-lg disabled:opacity-40">Add</button>
              </div>
            </form>
          )}
        </div>

        <div>
          <SectionHeading aside={todos.length > 0 && (
            <span className="text-sm text-neutral-400 tabular-nums">{doneCount}/{todos.length}</span>
          )}>
            To-do
          </SectionHeading>

          {todos.length > 0 && (
            <ul className="mb-2">
              {todos.map((todo) => (
                <TodoRow key={todo.id} todo={todo} todayKey={todayKey} onToggle={onToggleTodo} onDelete={onDeleteTodo} onMove={onMoveTodo} />
              ))}
            </ul>
          )}

          <form onSubmit={submitTodo} className="flex items-center gap-3">
            <Plus size={18} className="text-neutral-300 dark:text-neutral-600 flex-shrink-0 ml-0.5" />
            <input
              type="text"
              value={todoText}
              onChange={(e) => setTodoText(e.target.value)}
              placeholder="Add a to-do…"
              aria-label="Add a to-do for this day"
              className="flex-1 min-w-0 py-2 text-base bg-transparent text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none"
            />
          </form>

          {unfinished.length > 0 && (
            <button
              type="button"
              onClick={() => onMoveUnfinished(unfinished)}
              className="mt-2 flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
            >
              Move {unfinished.length} unfinished to next day <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
});

export default DayPanel;
