import { format } from 'date-fns';
import { parseLocalDate } from '../../../utils/date';
import { GlanceEntryList, Nothing } from './GlanceEntry';

// Five fit a portrait row (a seventh of the height) with the to-do count
const MAX_ENTRIES = 5;

function WeekDay({ dateKey, isToday, entries, todos }) {
  const date = parseLocalDate(dateKey);
  const done = todos.filter((t) => t.completed).length;
  return (
    <section
      aria-label={`${format(date, 'EEEE d MMMM')}${isToday ? ', today' : ''}`}
      className={`min-h-0 min-w-0 overflow-hidden p-3 flex portrait:gap-4 landscape:flex-col ${isToday ? 'bg-accent-soft' : ''}`}
    >
      <div className="flex-shrink-0 portrait:w-20">
        <p className="text-xs uppercase tracking-widest text-neutral-500 dark:text-neutral-400">{format(date, 'EEE')}</p>
        <p
          className={isToday
            ? 'mt-0.5 inline-flex items-center justify-center w-9 h-9 rounded-full bg-accent text-accent-fg font-serif text-xl'
            : 'mt-0.5 font-serif text-2xl text-neutral-900 dark:text-neutral-100'}
        >
          {format(date, 'd')}
        </p>
      </div>
      <div className="flex-1 min-w-0 landscape:mt-2">
        {entries.length === 0 && todos.length === 0
          ? <Nothing />
          : <GlanceEntryList entries={entries} max={MAX_ENTRIES} variant="cell" />}
        {todos.length > 0 && (
          <p className="mt-1 text-sm tabular-nums text-neutral-500 dark:text-neutral-400">{done} of {todos.length} to-dos</p>
        )}
      </div>
    </section>
  );
}

// Monday to Sunday: seven columns in landscape, seven rows in portrait
export default function GlanceWeek({ today, days, entriesByDate, todoMap }) {
  return (
    <div className="h-full min-h-0 grid rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden landscape:grid-cols-7 portrait:grid-rows-7 landscape:divide-x portrait:divide-y divide-neutral-100 dark:divide-neutral-800">
      {days.map((key) => (
        <WeekDay key={key} dateKey={key} isToday={key === today} entries={entriesByDate.get(key) || []} todos={todoMap.get(key) || []} />
      ))}
    </div>
  );
}
