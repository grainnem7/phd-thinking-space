import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, addDays } from 'date-fns';
import { ChevronRight, Plus, CheckSquare, Repeat } from 'lucide-react';
import { toDateKey } from '../../utils/date';
import { styleFor } from './calendarEntries';

const MAX_PER_DAY = 4;

function dayLabel(offset, date) {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  return format(date, 'EEEE d MMM');
}

export default function CalendarWidget({ entriesByDate, todoMap, onOpenCalendar }) {
  const now = new Date();
  const todayKey = toDateKey(now);
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(now), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(now), { weekStartsOn: 1 }),
  });

  const upcoming = Array.from({ length: 7 }, (_, offset) => {
    const date = addDays(now, offset);
    const key = toDateKey(date);
    return { offset, date, key, entries: entriesByDate.get(key) || [], todos: todoMap.get(key) || [] };
  }).filter((d) => d.entries.length > 0 || d.todos.length > 0);

  return (
    <>
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm text-neutral-500 dark:text-neutral-400 uppercase tracking-widest font-medium">Calendar</h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onOpenCalendar(todayKey)}
            className="flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
          >
            Open calendar <ChevronRight size={14} />
          </button>
          <button
            type="button"
            onClick={() => onOpenCalendar(todayKey)}
            aria-label="Plan today in the calendar"
            title="Plan today"
            className="text-neutral-300 hover:text-neutral-500 dark:text-neutral-600 dark:hover:text-neutral-300 transition-colors p-1.5 -m-1"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Mini month */}
        <div className="p-4 sm:p-6 md:w-[300px] flex-shrink-0 md:border-r border-b md:border-b-0 border-neutral-100 dark:border-neutral-800">
          <p className="font-serif text-xl text-neutral-900 dark:text-neutral-100 mb-3">{format(now, 'MMMM yyyy')}</p>
          <div className="grid grid-cols-7 gap-y-1 text-center" aria-hidden="true">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <span key={i} className="text-[11px] text-neutral-400 uppercase">{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1 mt-1">
            {days.map((day) => {
              const key = toDateKey(day);
              const count = (entriesByDate.get(key)?.length || 0) + (todoMap.get(key)?.length || 0);
              const isToday = key === todayKey;
              const inMonth = isSameMonth(day, now);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onOpenCalendar(key)}
                  aria-label={`${format(day, 'EEEE d MMMM')}${count ? `, ${count} item${count === 1 ? '' : 's'}` : ''}`}
                  className="relative mx-auto w-8 h-8 flex items-center justify-center rounded-full text-sm tabular-nums hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <span className={isToday
                    ? 'w-7 h-7 flex items-center justify-center rounded-full bg-accent text-accent-fg font-medium'
                    : inMonth ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-300 dark:text-neutral-600'}
                  >
                    {day.getDate()}
                  </span>
                  {count > 0 && !isToday && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-neutral-400 dark:bg-neutral-500" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Next 7 days */}
        <div className="flex-1 min-w-0 overflow-y-auto max-h-[360px] md:max-h-none">
          <p className="px-4 sm:px-6 pt-4 text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Next 7 days</p>
          {upcoming.length === 0 ? (
            <div className="px-4 sm:px-6 py-4">
              <p className="text-base text-neutral-400 mb-2">Nothing planned this week.</p>
              <button type="button" onClick={() => onOpenCalendar(todayKey)} className="text-base text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 flex items-center gap-2">
                <Plus size={16} /> Plan your week
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {upcoming.map(({ offset, date, key, entries, todos }) => {
                const done = todos.filter((t) => t.completed).length;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => onOpenCalendar(key)}
                      className="w-full text-left px-4 sm:px-6 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
                    >
                      <span className="flex items-baseline justify-between gap-3 mb-1.5">
                        <span className={`text-sm font-medium ${offset === 0 ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-300'}`}>
                          {dayLabel(offset, date)}
                        </span>
                        {todos.length > 0 && (
                          <span className={`flex items-center gap-1 text-xs tabular-nums ${done === todos.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-400'}`}>
                            <CheckSquare size={12} /> {done}/{todos.length} to-dos
                          </span>
                        )}
                      </span>
                      {entries.length > 0 && (
                        <span className="block space-y-1">
                          {entries.slice(0, MAX_PER_DAY).map((e) => (
                            <span key={e.id} className="flex items-center gap-2 text-sm min-w-0">
                              <span
                                className={`w-2 h-2 rounded-full flex-shrink-0 ${styleFor(e).dot}`}
                                style={e.source === 'google' ? { backgroundColor: e.colorHex } : styleFor(e).vars}
                              />
                              <span className="w-14 flex-shrink-0 whitespace-nowrap tabular-nums text-neutral-400">{e.allDay ? 'All day' : e.startTime}</span>
                              <span className={`truncate text-neutral-700 dark:text-neutral-300 ${e.done ? 'line-through text-neutral-400' : ''}`}>{e.title}</span>
                              {e.seriesId && <Repeat size={12} className="flex-shrink-0 text-neutral-400" aria-label="Repeats" />}
                            </span>
                          ))}
                          {entries.length > MAX_PER_DAY && (
                            <span className="block text-xs text-neutral-400 pl-4">+{entries.length - MAX_PER_DAY} more</span>
                          )}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
