import { useDraggable, useDroppable } from '@dnd-kit/core';
import { format } from 'date-fns';
import { CheckSquare, Repeat, Check, Flag } from 'lucide-react';
import { styleFor, compareGridEntries } from './calendarEntries';
import { canMoveEntry, dayDropId } from './calendarDnd';

const MAX_CHIPS = 3;

// Compact chip content shared by month cells and the drag overlay
export function ChipBody({ entry }) {
  return (
    <>
      {entry.source === 'google' && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.colorHex }} />}
      {entry.source === 'deadline' && <Flag size={10} strokeWidth={2.5} className="flex-shrink-0" aria-label="Deadline" />}
      {entry.span?.index > 0 && <span className="opacity-60 flex-shrink-0" aria-hidden="true">↳</span>}
      {!entry.allDay && !(entry.span?.index > 0) && <span className="tabular-nums opacity-70 flex-shrink-0">{entry.startTime}</span>}
      <span className={`truncate ${entry.span?.index > 0 ? 'opacity-80' : ''}`}>{entry.title}</span>
      {entry.seriesId && <Repeat size={10} className="flex-shrink-0 opacity-60" aria-label="Repeats" />}
    </>
  );
}

// What follows the pointer while dragging
export function DragPreview({ item }) {
  if (!item) return null;
  if (item.kind === 'todo') {
    const { todo } = item;
    return (
      <div className="flex items-center gap-2 max-w-[220px] px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-800 text-sm text-neutral-700 dark:text-neutral-200 shadow-lg ring-1 ring-neutral-200 dark:ring-neutral-700 cursor-grabbing">
        <span className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${todo.completed ? 'bg-neutral-700 border-neutral-700' : 'border-neutral-300 dark:border-neutral-500'}`}>
          {todo.completed && <Check size={9} strokeWidth={3} className="text-white" />}
        </span>
        <span className="truncate">{todo.title}</span>
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-1 max-w-[220px] px-2 py-1 rounded-md text-xs shadow-lg cursor-grabbing ${styleFor(item.entry).chip}`} style={styleFor(item.entry).vars}>
      <ChipBody entry={item.entry} />
    </div>
  );
}

function GridChip({ entry, onSelectDay, onOpenEntry }) {
  const movable = canMoveEntry(entry);
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `grid:${entry.id}`,
    data: { kind: 'entry', entry, date: entry.date },
    disabled: !movable,
  });
  const style = styleFor(entry);
  return (
    <span
      ref={setNodeRef}
      {...(movable ? listeners : {})}
      onClick={onSelectDay}
      onDoubleClick={(e) => { e.stopPropagation(); onOpenEntry(entry); }}
      title={`${entry.title}${entry.span ? ` (day ${entry.span.index + 1} of ${entry.span.length})` : ''}${movable ? ' — drag to another day' : ''}`}
      className={`flex items-center gap-1 px-1.5 py-px rounded text-[11px] leading-4 min-w-0 pointer-events-auto touch-manipulation select-none
        ${entry.span && entry.span.index > 0 ? 'rounded-l-none -ml-1 sm:-ml-1.5 pl-2 sm:pl-2.5' : ''}
        ${entry.span && entry.span.index < entry.span.length - 1 ? 'rounded-r-none -mr-1 sm:-mr-1.5' : ''}
        ${movable ? 'cursor-grab' : 'cursor-pointer'} ${style.chip} ${entry.done ? 'line-through opacity-60' : ''} ${isDragging ? 'opacity-40' : ''}`}
      style={style.vars}
    >
      <ChipBody entry={entry} />
    </span>
  );
}

// One day of the month grid: a selectable button, draggable chips and a drop target.
export default function MonthDayCell({
  day, dateKey, inMonth, isToday, isSelected, tabbable, entries: dayEntries, todos, borderClass,
  onSelect, onOpenNew, onOpenEntry,
}) {
  // Entries arrive in list order (by time); the grid keeps multi-day events on top
  const entries = [...dayEntries].sort(compareGridEntries);
  const { setNodeRef, isOver, active } = useDroppable({ id: dayDropId(dateKey), data: { date: dateKey } });
  const hidden = entries.length - MAX_CHIPS;
  const doneTodos = todos.filter((t) => t.completed).length;
  const isTarget = isOver && active?.data?.current?.date !== dateKey;
  const label = `${format(day, 'EEEE d MMMM')}${entries.length ? `, ${entries.length} item${entries.length === 1 ? '' : 's'}` : ''}${todos.length ? `, ${doneTodos} of ${todos.length} to-dos done` : ''}`;

  return (
    <div
      ref={setNodeRef}
      className={`relative flex flex-col min-h-[64px] sm:min-h-[104px] xl:min-h-[118px] border-neutral-100 dark:border-neutral-800 transition-colors ${borderClass}
        ${inMonth ? '' : 'bg-neutral-50/70 dark:bg-neutral-950/40'}
        ${isSelected ? 'bg-neutral-100/80 dark:bg-neutral-800/70' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40'}
        ${isTarget ? '!bg-sky-50 dark:!bg-sky-950/50 ring-2 ring-inset ring-sky-400 dark:ring-sky-500 z-[1]' : ''}`}
    >
      <button
        type="button"
        data-date={dateKey}
        aria-pressed={isSelected}
        aria-current={isToday ? 'date' : undefined}
        aria-label={label}
        tabIndex={tabbable ? 0 : -1}
        onClick={() => onSelect(dateKey)}
        onDoubleClick={() => onOpenNew(dateKey)}
        className="absolute inset-0 w-full h-full focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-400"
      />
      <div className="relative flex-1 p-1 sm:p-1.5 flex flex-col items-stretch pointer-events-none" aria-hidden="true">
        <span className={`self-center sm:self-start w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full text-xs sm:text-sm tabular-nums
          ${isToday ? 'bg-accent text-accent-fg font-medium' : inMonth ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-300 dark:text-neutral-600'}`}
        >
          {day.getDate()}
        </span>

        {/* Phones: dots only */}
        {(entries.length > 0 || todos.length > 0) && (
          <span className="sm:hidden flex justify-center flex-wrap gap-0.5 mt-1">
            {entries.slice(0, 4).map((e) => (
              <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${styleFor(e).dot}`} style={e.source === 'google' ? { backgroundColor: e.colorHex } : styleFor(e).vars} />
            ))}
            {todos.length > 0 && <span className="w-1.5 h-1.5 rounded-full border border-neutral-400" />}
          </span>
        )}

        {/* Larger screens: chips */}
        <span className="hidden sm:flex flex-col gap-0.5 mt-1 min-w-0">
          {entries.slice(0, MAX_CHIPS).map((e) => (
            <GridChip key={e.id} entry={e} onSelectDay={() => onSelect(dateKey)} onOpenEntry={onOpenEntry} />
          ))}
          {hidden > 0 && <span className="px-1.5 text-[11px] leading-4 text-neutral-400">+{hidden} more</span>}
        </span>

        {todos.length > 0 && (
          <span className={`hidden sm:flex items-center gap-1 mt-auto pt-1 px-1 text-[11px] tabular-nums ${doneTodos === todos.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-400'}`}>
            <CheckSquare size={11} /> {doneTodos}/{todos.length}
          </span>
        )}
      </div>
    </div>
  );
}
