import { useId, useState } from 'react';
import { Flame, Target } from 'lucide-react';
import WidgetHeader from './WidgetHeader';
import WordsBarChart from '../../writing/WordsBarChart';
import { useWritingStats, currentStreak, dailySeries } from '../../../hooks/useWritingStats';
import { toDateKey } from '../../../utils/date';
import { inputClass, primaryTextButton, secondaryTextButton, labelClass } from './styles';

function ProgressRing({ value, goal }) {
  const size = 112;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(1, value / goal) : 0;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-neutral-100 dark:stroke-neutral-800" />
        {pct > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            className="stroke-neutral-800 dark:stroke-neutral-200 transition-[stroke-dashoffset] duration-500"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-2xl text-neutral-900 dark:text-neutral-100 tabular-nums leading-none">{value.toLocaleString()}</span>
        <span className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">of {goal.toLocaleString()}</span>
      </div>
    </div>
  );
}

export default function WritingWidget({ size = 'small' }) {
  const { writtenByDate, dailyGoal, setDailyGoal } = useWritingStats();
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');
  const goalInputId = useId();

  const today = toDateKey(new Date());
  const todayWords = writtenByDate.get(today) || 0;
  const streak = currentStreak(writtenByDate, dailyGoal, today);
  const days = dailySeries(writtenByDate, today, 14);
  const remaining = Math.max(0, dailyGoal - todayWords);
  const wide = size === 'wide';

  const startEditing = () => {
    setGoalDraft(String(dailyGoal));
    setEditingGoal(true);
  };

  const saveGoal = () => {
    const value = Math.round(Number(goalDraft));
    if (value > 0) setDailyGoal(value);
    setEditingGoal(false);
  };

  return (
    <>
      <WidgetHeader
        title="Writing"
        actions={!editingGoal && (
          <button
            type="button"
            onClick={startEditing}
            aria-label="Edit daily word goal"
            title="Edit daily goal"
            className="text-neutral-300 hover:text-neutral-500 dark:text-neutral-600 dark:hover:text-neutral-300 transition-colors p-1.5 -m-1 rounded touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-600"
          >
            <Target size={18} aria-hidden="true" />
          </button>
        )}
      />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {editingGoal && (
          <form
            className="mb-4 pb-4 border-b border-neutral-100 dark:border-neutral-800"
            onSubmit={(e) => { e.preventDefault(); saveGoal(); }}
          >
            <label htmlFor={goalInputId} className={labelClass}>Daily goal (words)</label>
            <input
              id={goalInputId}
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setEditingGoal(false); }}
              autoFocus
              className={inputClass}
            />
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setEditingGoal(false)} className={secondaryTextButton}>Cancel</button>
              <button type="submit" disabled={!(Number(goalDraft) > 0)} className={primaryTextButton}>Save</button>
            </div>
          </form>
        )}

        <div className={`flex ${wide ? 'flex-col sm:flex-row sm:items-center gap-6 sm:gap-10' : 'flex-col gap-5'}`}>
          <div className="flex items-center gap-5">
            <ProgressRing value={todayWords} goal={dailyGoal} />
            <div className="min-w-0">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Written today</p>
              <p className="text-base text-neutral-900 dark:text-neutral-100 mt-0.5">
                {remaining > 0 ? `${remaining.toLocaleString()} to go` : 'Goal met'}
              </p>
              <p className="flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400 mt-3">
                <Flame size={16} aria-hidden="true" className={streak > 0 ? 'text-amber-500' : 'text-neutral-300 dark:text-neutral-600'} />
                <span>
                  <span className="text-neutral-900 dark:text-neutral-100 tabular-nums">{streak}</span> day streak
                </span>
              </p>
            </div>
          </div>

          <div className={wide ? 'flex-1 min-w-0 max-w-xl' : ''}>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">Last 14 days</p>
            <WordsBarChart days={days} goal={dailyGoal} today={today} labelEvery={wide ? 1 : 2} dayFormat={wide ? 'EEEEE' : 'd'} />
          </div>
        </div>
      </div>
    </>
  );
}
