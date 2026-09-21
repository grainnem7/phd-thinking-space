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
  large: { row: 'gap-3 text-lg', dot: 'w-2.5 h-2.5', time: 'w-24' },
  list: { row: 'gap-3 text-base', dot: 'w-2 h-2', time: 'w-20' },
};

function Dot({ entry, className }) {
  const style = styleFor(entry);
  return (
    <span
      aria-hidden="true"
      className={`${className} rounded-full flex-shrink-0 self-center ${style.dot}`}
      style={entry.source === 'google' ? { backgroundColor: entry.colorHex } : style.vars}
    />
  );
}

function Title({ entry, className }) {
  const isDeadline = entry.source === 'deadline';
  return (
    <span
      className={`min-w-0 ${className} ${isDeadline ? 'font-semibold text-red-700 dark:text-red-300' : 'text-neutral-900 dark:text-neutral-100'} ${entry.done ? 'line-through text-neutral-400 dark:text-neutral-500' : ''}`}
    >
      {isDeadline && <Flag size={12} strokeWidth={2.5} className="inline mr-1 -mt-0.5" aria-label="Deadline" />}
      {entry.title}
    </span>
  );
}

function RepeatMark({ entry }) {
  if (!entry.seriesId) return null;
  return <Repeat size={12} className="flex-shrink-0 self-center text-neutral-400" aria-label="Repeats" />;
}

// One calendar entry: colour dot, time, title. `cell` (narrow week columns)
// puts the time on its own line in landscape so the title gets the width.
export default function GlanceEntry({ entry, variant = 'list' }) {
  if (variant === 'cell') {
    return (
      <li className="min-w-0 text-sm leading-snug portrait:flex portrait:items-baseline portrait:gap-2">
        <span className="flex items-center gap-1.5 flex-shrink-0 tabular-nums text-neutral-500 dark:text-neutral-400 landscape:text-xs">
          <Dot entry={entry} className="w-1.5 h-1.5" />
          {timeLabel(entry)}
          <RepeatMark entry={entry} />
        </span>
        <Title entry={entry} className="block line-clamp-2 break-words" />
      </li>
    );
  }
  const v = VARIANTS[variant];
  return (
    <li className={`flex items-baseline min-w-0 ${v.row}`}>
      <Dot entry={entry} className={v.dot} />
      <span className={`${v.time} flex-shrink-0 tabular-nums text-neutral-500 dark:text-neutral-400`}>{timeLabel(entry)}</span>
      <Title entry={entry} className="truncate" />
      <RepeatMark entry={entry} />
    </li>
  );
}

// A day's entries, cut off with "+N more" so the screen works as a still image
export function GlanceEntryList({ entries, max, variant = 'list' }) {
  if (entries.length === 0) return null;
  const hidden = entries.length - max;
  return (
    <>
      <ul className="space-y-1.5">
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
