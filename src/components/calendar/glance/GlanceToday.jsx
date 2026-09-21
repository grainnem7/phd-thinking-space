import { format } from 'date-fns';
import { parseLocalDate } from '../../../utils/date';
import { GlanceEntryList, Nothing } from './GlanceEntry';

const MAX_TODAY_ENTRIES = 8;
const MAX_TODAY_TODOS = 6;
const MAX_DAY_ENTRIES = 3;

function TodoCount({ todos }) {
  if (todos.length === 0) return null;
  const done = todos.filter((t) => t.completed).length;
  return <span className="text-sm tabular-nums text-neutral-500 dark:text-neutral-400">{done} of {todos.length} to-dos</span>;
}

// Today's date, entries and to-dos (also used beside the month grid)
export function TodayDetails({ dateKey, entries, todos }) {
  const hiddenTodos = todos.length - MAX_TODAY_TODOS;
  return (
    <section aria-labelledby="glance-today" className="min-w-0">
      <p className="text-sm uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Today</p>
      <h2 id="glance-today" className="mt-1 font-serif text-4xl sm:text-5xl tracking-tight text-neutral-900 dark:text-neutral-100">
        {format(parseLocalDate(dateKey), 'EEEE d MMMM')}
      </h2>
      <div className="mt-6">
        {entries.length === 0 && todos.length === 0 ? <Nothing /> : <GlanceEntryList entries={entries} max={MAX_TODAY_ENTRIES} variant="large" />}
      </div>
      {todos.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm uppercase tracking-widest text-neutral-500 dark:text-neutral-400">To-do</h3>
          <ul className="space-y-1.5">
            {todos.slice(0, MAX_TODAY_TODOS).map((todo) => (
              <li key={todo.id} className="flex items-baseline gap-3 text-lg min-w-0">
                <span aria-hidden="true" className="w-5 flex-shrink-0 text-center">{todo.completed ? '✓' : '○'}</span>
                <span className={`min-w-0 truncate ${todo.completed ? 'line-through text-neutral-400 dark:text-neutral-500' : 'text-neutral-900 dark:text-neutral-100'}`}>
                  {todo.title}
                  {todo.completed && <span className="sr-only"> (done)</span>}
                </span>
              </li>
            ))}
          </ul>
          {hiddenTodos > 0 && <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">+{hiddenTodos} more</p>}
        </div>
      )}
    </section>
  );
}

function UpcomingDay({ dateKey, entries, todos }) {
  return (
    <li className="py-3 first:pt-0">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100">{format(parseLocalDate(dateKey), 'EEEE d MMM')}</h3>
        <TodoCount todos={todos} />
      </div>
      <div className="mt-1.5">
        {entries.length === 0 && todos.length === 0 ? <Nothing /> : <GlanceEntryList entries={entries} max={MAX_DAY_ENTRIES} variant="list" />}
      </div>
    </li>
  );
}

// Today in detail, then the next six days
export default function GlanceToday({ today, days, entriesByDate, todoMap }) {
  const upcoming = days.filter((key) => key !== today);
  return (
    <div className="h-full min-h-0 grid gap-8 landscape:grid-cols-[3fr_2fr] portrait:grid-rows-[auto_minmax(0,1fr)]">
      <TodayDetails dateKey={today} entries={entriesByDate.get(today) || []} todos={todoMap.get(today) || []} />
      <section
        aria-label="Next six days"
        className="min-h-0 overflow-hidden border-t border-neutral-200 dark:border-neutral-800 pt-6 landscape:border-t-0 landscape:border-l landscape:pt-0 landscape:pl-8"
      >
        <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {upcoming.map((key) => (
            <UpcomingDay key={key} dateKey={key} entries={entriesByDate.get(key) || []} todos={todoMap.get(key) || []} />
          ))}
        </ul>
      </section>
    </div>
  );
}
