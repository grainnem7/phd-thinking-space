import { useState } from 'react';
import { format } from 'date-fns';
import { parseLocalDate } from '../../utils/date';

// Small daily bar chart of words written. `days`: [{ date: 'YYYY-MM-DD', words }].
// Bars that meet the goal are drawn darker; the goal is a dashed rule.
// Hover/focus a bar to read its value; the full series is also in an sr-only table.

const WIDTH = 280;
const HEIGHT = 96;
const LABEL_H = 16;
const GAP = 2;

function barPath(x, y, w, h) {
  const r = Math.min(4, w / 2, h);
  if (h <= 0) return '';
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export default function WordsBarChart({ days, goal = 0, today, labelEvery = 1, dayFormat = 'EEEEE', className = '', onSelectDay }) {
  const [active, setActive] = useState(null);
  const max = Math.max(goal || 0, ...days.map((d) => d.words), 1);
  const plotH = HEIGHT - LABEL_H;
  const slot = WIDTH / days.length;
  const barW = Math.max(4, Math.min(24, slot - GAP * 2 - slot * 0.25));
  const goalY = goal > 0 ? plotH - (goal / max) * plotH : null;
  const activeDay = active != null ? days[active] : null;
  const total = days.reduce((n, d) => n + d.words, 0);

  return (
    <div className={`relative ${className}`}>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 h-4 mb-1 tabular-nums" aria-live="polite">
        {activeDay
          ? `${format(parseLocalDate(activeDay.date), 'EEE d MMM')} · ${activeDay.words.toLocaleString()} words`
          : `${total.toLocaleString()} words`}
      </p>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto overflow-visible" aria-hidden="true" onMouseLeave={() => setActive(null)}>
        <line x1="0" x2={WIDTH} y1={plotH + 0.5} y2={plotH + 0.5} className="stroke-neutral-200 dark:stroke-neutral-700" strokeWidth="1" />
        {goalY != null && (
          <line x1="0" x2={WIDTH} y1={goalY} y2={goalY} className="stroke-neutral-300 dark:stroke-neutral-600" strokeWidth="1" strokeDasharray="3 3" />
        )}
        {days.map((d, i) => {
          const h = d.words > 0 ? Math.max(2, (d.words / max) * plotH) : 0;
          const x = i * slot + (slot - barW) / 2;
          const met = goal > 0 && d.words >= goal;
          const isActive = active === i;
          const showLabel = i % labelEvery === (days.length - 1) % labelEvery;
          return (
            <g key={d.date} onMouseEnter={() => setActive(i)} onClick={onSelectDay ? () => onSelectDay(d.date) : undefined} className={onSelectDay ? 'cursor-pointer' : undefined}>
              {/* Hit target larger than the bar */}
              <rect x={i * slot} y="0" width={slot} height={HEIGHT} fill="transparent" />
              {h === 0 ? (
                <rect x={x} y={plotH - 1} width={barW} height="1" className="fill-neutral-200 dark:fill-neutral-700" />
              ) : (
                <path
                  d={barPath(x, plotH - h, barW, h)}
                  className={
                    met
                      ? (isActive ? 'fill-neutral-600 dark:fill-neutral-300' : 'fill-neutral-800 dark:fill-neutral-200')
                      : (isActive ? 'fill-neutral-400 dark:fill-neutral-500' : 'fill-neutral-300 dark:fill-neutral-600')
                  }
                />
              )}
              {showLabel && (
                <text
                  x={i * slot + slot / 2}
                  y={HEIGHT - 3}
                  textAnchor="middle"
                  className={`text-[9px] ${d.date === today ? 'fill-neutral-900 dark:fill-neutral-100 font-semibold' : 'fill-neutral-400 dark:fill-neutral-500'}`}
                >
                  {format(parseLocalDate(d.date), dayFormat)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>Words written per day{goal > 0 ? `, daily goal ${goal}` : ''}</caption>
        <thead>
          <tr><th scope="col">Day</th><th scope="col">Words</th></tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th scope="row">{format(parseLocalDate(d.date), 'EEEE d MMMM')}</th>
              <td>{d.words}{goal > 0 && d.words >= goal ? ' (goal met)' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
