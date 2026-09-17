import { useId } from 'react';
import { Repeat } from 'lucide-react';
import { describeRecurrence, nthWeekdayOf, WEEKDAY_SHORT, WEEKDAY_LONG } from '../../lib/recurrence';
import { toDateKey } from '../../utils/date';
import { REPEAT_OPTIONS, recurrenceFromForm, repeatError } from './repeatForm';

const LABEL_CLASS = 'block text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1.5';
const SELECT_CLASS = 'w-full px-3 py-2.5 text-base bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-neutral-300 dark:focus:border-neutral-600 text-neutral-900 dark:text-neutral-100';
const SMALL_INPUT = 'px-2.5 py-1.5 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-neutral-300 dark:focus:border-neutral-600 text-neutral-900 dark:text-neutral-100 disabled:opacity-50';
const ORDINALS = ['first', 'second', 'third', 'fourth', 'last'];

// The "Repeat" and "Ends" controls of the event editor.
export default function RepeatFields({ value, onChange, dateKey }) {
  const id = useId();
  const set = (patch) => onChange({ ...value, ...patch });
  const repeating = value.preset !== 'never';
  const rule = recurrenceFromForm(value, dateKey);
  const error = repeatError(value, dateKey);
  const nth = dateKey ? nthWeekdayOf(dateKey) : null;
  const dayOfMonth = dateKey ? Number(dateKey.slice(8)) : null;

  const toggleDay = (day) => {
    const has = value.byWeekday.includes(day);
    set({ byWeekday: has ? value.byWeekday.filter((d) => d !== day) : [...value.byWeekday, day].sort((a, b) => a - b) });
  };

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={`${id}-repeat`} className={LABEL_CLASS}>Repeat</label>
        <select id={`${id}-repeat`} value={value.preset} onChange={(e) => set({ preset: e.target.value })} className={SELECT_CLASS}>
          {value.preset === 'custom' && <option value="custom">{describeRecurrence({ ...value.custom, until: undefined, count: undefined }, dateKey)}</option>}
          {REPEAT_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>

      {(value.preset === 'weekly' || value.preset === 'biweekly') && (
        <div role="group" aria-label="Repeat on" className="flex flex-wrap gap-1.5">
          {WEEKDAY_SHORT.map((label, day) => {
            const on = value.byWeekday.includes(day);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                aria-label={WEEKDAY_LONG[day]}
                onClick={() => toggleDay(day)}
                className={`w-10 h-9 text-sm rounded-lg border transition-colors ${on
                  ? 'bg-neutral-900 border-neutral-900 text-white dark:bg-neutral-100 dark:border-neutral-100 dark:text-neutral-900'
                  : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-600'}`}
              >
                {label.slice(0, 2)}
              </button>
            );
          })}
        </div>
      )}

      {value.preset === 'monthly' && dateKey && (
        <div>
          <label htmlFor={`${id}-monthly`} className="sr-only">Monthly on</label>
          <select id={`${id}-monthly`} value={value.monthlyMode} onChange={(e) => set({ monthlyMode: e.target.value })} className={SELECT_CLASS}>
            <option value="dayOfMonth">On day {dayOfMonth}{dayOfMonth > 28 ? ' (skips shorter months)' : ''}</option>
            <option value="nthWeekday">On the {ORDINALS[nth.n - 1]} {WEEKDAY_LONG[nth.weekday]}</option>
          </select>
        </div>
      )}

      {repeating && (
        <fieldset>
          <legend className={LABEL_CLASS}>Ends</legend>
          <div className="space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name={`${id}-ends`} checked={value.endMode === 'never'} onChange={() => set({ endMode: 'never' })} className="accent-neutral-800" />
              Never
            </label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name={`${id}-ends`} checked={value.endMode === 'until'} onChange={() => set({ endMode: 'until', until: value.until || dateKey || toDateKey(new Date()) })} className="accent-neutral-800" />
                On
              </label>
              <input
                type="date"
                aria-label="End date"
                value={value.until}
                min={dateKey || undefined}
                disabled={value.endMode !== 'until'}
                onChange={(e) => set({ until: e.target.value })}
                className={SMALL_INPUT}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name={`${id}-ends`} checked={value.endMode === 'count'} onChange={() => set({ endMode: 'count' })} className="accent-neutral-800" />
                After
              </label>
              <input
                type="number"
                aria-label="Number of occurrences"
                min={1}
                max={999}
                value={value.count}
                disabled={value.endMode !== 'count'}
                onChange={(e) => set({ count: e.target.value === '' ? '' : Math.max(1, Math.min(999, Number(e.target.value))) })}
                className={`${SMALL_INPUT} w-20`}
              />
              <span>occurrences</span>
            </div>
          </div>
        </fieldset>
      )}

      {repeating && (error
        ? <p className="text-sm text-rose-600">{error}</p>
        : rule && (
          <p className="flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400" aria-live="polite">
            <Repeat size={14} className="flex-shrink-0" aria-hidden="true" />
            {describeRecurrence(rule, dateKey, { todayKey: toDateKey(new Date()) })}
          </p>
        ))}
    </div>
  );
}
