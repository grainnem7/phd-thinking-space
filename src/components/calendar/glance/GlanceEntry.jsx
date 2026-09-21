import { Flag, Repeat } from 'lucide-react';
import { styleFor } from '../calendarEntries';

// "All day" / "Due", the start time, or "until" the end time on the last day
// of an event that runs past midnight
function timeLabel(entry) {
  if (entry.allDay) return entry.source === 'deadline' ? 'Due' : 'All day';
  if (entry.span?.index > 0) return `until ${entry.endTime}`;
  return entry.startTime;
}

const VARIANTS = {
  large: { row: 'gap-3 text-lg', dot: 'w-2.5 h-2.5', time: 'w-24', title: 'truncate' },
  list: { row: 'gap-3 text-base', dot: 'w-2 h-2', time: 'w-20', title: 'truncate' },
  cell: { row: 'gap-1.5 text-sm leading-snug', dot: 'w-1.5 h-1.5', time: '', title: 'line-clamp-2' },
};

// One calendar entry: colour dot, time, title
export default function GlanceEntry({ entry, variant = 'list' }) {
  const v = VARIANTS[variant];
  const style = styleFor(entry);
  const isDeadline = entry.source === 'deadline';
  return (
    <li className={`flex items-baseline min-w-0 ${v.row}`}>
      <span
        aria-hidden="true"
        className={`${v.dot} rounded-full flex-shrink-0 self-center ${style.dot}`}
        style={entry.source === 'google' ? { backgroundColor: entry.colorHex } : style.vars}
      />
      <span className={`${v.time} flex-shrink-0 tabular-nums text-neutral-500 dark:text-neutral-400`}>{timeLabel(entry)}</span>
      <span
        className={`min-w-0 ${v.title} ${isDeadline ? 'font-semibold text-red-700 dark:text-red-300' : 'text-neutral-900 dark:text-neutral-100'} ${entry.done ? 'line-through text-neutral-400 dark:text-neutral-500' : ''}`}
      >
        {isDeadline && <Flag size={12} strokeWidth={2.5} className="inline mr-1 -mt-0.5" aria-label="Deadline" />}
        {entry.title}
      </span>
      {entry.seriesId && <Repeat size={12} className="flex-shrink-0 self-center text-neutral-400" aria-label="Repeats" />}
    </li>
  );
}

// A day's entries, cut off with "+N more" so the screen works as a still image
export function GlanceEntryList({ entries, max, variant = 'list' }) {
  if (entries.length === 0) return null;
  const hidden = entries.length - max;
  return (
    <>
      <ul className={variant === 'cell' ? 'space-y-1' : 'space-y-1.5'}>
        {entries.slice(0, max).map((entry) => (
          <GlanceEntry key={entry.id} entry={entry} variant={variant} />
        ))}
      </ul>
      {hidden > 0 && <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">+{hidden} more</p>}
    </>
  );
}

export function Nothing() {
  return <p className="text-sm text-neutral-400 dark:text-neutral-500">Nothing planned</p>;
}
