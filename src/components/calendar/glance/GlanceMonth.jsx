import { format, isSameMonth } from 'date-fns';
import { parseLocalDate } from '../../../utils/date';
import { styleFor, compareGridEntries } from '../calendarEntries';
import { ChipBody } from '../MonthDayCell';
import { TodayDetails } from './GlanceToday';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// Chips that fit a cell (with the date and "+N more"), by number of weeks in
// the grid. Upright cells are shorter: the grid shares the height with today.
const CHIPS = {
  landscape: { 4: 3, 5: 3, 6: 2 },
  portrait: { 4: 3, 5: 2, 6: 1 },
};
// Full class names so Tailwind keeps them
const ROWS = { 4: 'grid-rows-4', 5: 'grid-rows-5', 6: 'grid-rows-6' };

function MonthCell({ dateKey, inMonth, isToday, entries, borderClass, maxChips, portraitMaxChips }) {
  const date = parseLocalDate(dateKey);
  const sorted = [...entries].sort(compareGridEntries);
  return (
    <div
      aria-label={`${format(date, 'EEEE d MMMM')}${entries.length ? `, ${entries.length} item${entries.length === 1 ? '' : 's'}` : ''}`}
      className={`min-h-0 min-w-0 overflow-hidden p-1.5 border-neutral-100 dark:border-neutral-800 ${borderClass} ${inMonth ? '' : 'bg-neutral-50 dark:bg-neutral-900/50'}`}
    >
      <span
        className={isToday
          ? 'inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent text-accent-fg text-sm font-medium'
          : `inline-block px-1 text-sm tabular-nums ${inMonth ? 'text-neutral-800 dark:text-neutral-200' : 'text-neutral-400 dark:text-neutral-500'}`}
      >
        {date.getDate()}
      </span>
      <ul className="mt-1 space-y-0.5" aria-hidden="true">
        {sorted.slice(0, maxChips).map((entry, i) => {
          const style = styleFor(entry);
          return (
            <li
              key={entry.id}
              className={`flex items-center gap-1 px-1.5 rounded text-xs leading-5 min-w-0 ${style.chip} ${entry.done ? 'line-through opacity-60' : ''} ${i >= portraitMaxChips ? 'portrait:hidden' : ''}`}
              style={style.vars}
            >
              <ChipBody entry={entry} />
            </li>
          );
        })}
      </ul>
      <CellMore count={sorted.length - maxChips} className="portrait:hidden" />
      <CellMore count={sorted.length - portraitMaxChips} className="landscape:hidden" />
    </div>
  );
}

function CellMore({ count, className }) {
  if (count <= 0) return null;
  return <p className={`px-1 text-[11px] text-neutral-500 dark:text-neutral-400 ${className}`}>+{count} more</p>;
}

// The month grid with today's details beside it (landscape) or below (portrait)
export default function GlanceMonth({ today, days, entriesByDate, todoMap, now }) {
  const weeks = days.length / 7;
  return (
    <div className="h-full min-h-0 grid gap-6 landscape:grid-cols-[2fr_1fr] portrait:grid-rows-[3fr_2fr]">
      <section aria-label={format(now, 'MMMM yyyy')} className="min-h-0 flex flex-col">
        <h2 className="mb-3 font-serif text-3xl tracking-tight text-neutral-900 dark:text-neutral-100">{format(now, 'MMMM yyyy')}</h2>
        <div className="grid grid-cols-7 mb-1 text-xs uppercase tracking-widest text-neutral-500 dark:text-neutral-400" aria-hidden="true">
          {WEEKDAYS.map((d) => <span key={d} className="px-2">{d}</span>)}
        </div>
        <div className={`flex-1 min-h-0 grid grid-cols-7 ${ROWS[weeks] || 'grid-rows-6'} rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden`}>
          {days.map((key, i) => (
            <MonthCell
              key={key}
              dateKey={key}
              inMonth={isSameMonth(parseLocalDate(key), now)}
              isToday={key === today}
              entries={entriesByDate.get(key) || []}
              borderClass={`${(i + 1) % 7 !== 0 ? 'border-r' : ''} ${i < days.length - 7 ? 'border-b' : ''}`}
              maxChips={CHIPS.landscape[weeks] ?? 2}
              portraitMaxChips={CHIPS.portrait[weeks] ?? 1}
            />
          ))}
        </div>
      </section>
      <div className="min-h-0 overflow-hidden border-neutral-200 dark:border-neutral-800 landscape:border-l landscape:pl-6 portrait:border-t portrait:pt-4">
        <TodayDetails dateKey={today} entries={entriesByDate.get(today) || []} todos={todoMap.get(today) || []} compactInPortrait />
      </div>
    </div>
  );
}
