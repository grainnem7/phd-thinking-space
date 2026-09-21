import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useCalendar } from '../../../hooks/useCalendar';
import { useDashboard } from '../../../hooks/useDashboard';
import { useGoogleCalendar } from '../../../hooks/useGoogleCalendar';
import { useCalendarCategories } from '../../../hooks/useCalendarCategories';
import { parseLocalDate } from '../../../utils/date';
import { addDaysToKey } from '../../../lib/recurrence';
import { buildEntries, groupByDate, todosByDate, glanceDays, loadHiddenCategories } from '../calendarEntries';
import { readGlanceLayout, writeGlanceLayout } from './glanceSettings';
import GlanceControls from './GlanceControls';
import GlanceToday from './GlanceToday';
import GlanceWeek from './GlanceWeek';
import GlanceMonth from './GlanceMonth';

const REFRESH_MS = 15 * 60 * 1000;
const CONTROLS_HIDE_MS = 5000;

// Full-screen, read-only calendar to leave on display (e.g. a Boox with the
// Transparent screensaver). Tap to show the controls; Escape or Close leaves.
export default function GlanceView({ sections = [], onClose }) {
  const [layout, setLayout] = useState(readGlanceLayout);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [barFocused, setBarFocused] = useState(false);
  const [hiddenCategories] = useState(loadHiddenCategories);
  // Dates come from `clock`, which timers move on; `renderedAt` is only for
  // the "Updated" note, so it also moves when the data changes
  const [clock, setClock] = useState(() => new Date());
  const renderedAt = new Date();

  const { today, days, range } = glanceDays(layout, clock);
  const { start: rangeStart, end: rangeEnd } = range;

  const { items, isLoading } = useCalendar();
  const { deadlines, deadlinesLoaded } = useDashboard();
  const { categories } = useCalendarCategories();
  const google = useGoogleCalendar(rangeStart, rangeEnd);

  const entriesByDate = useMemo(() => groupByDate(buildEntries({
    items,
    deadlines,
    sections,
    googleEvents: google.events,
    categories,
    range: { start: rangeStart, end: rangeEnd },
  }).filter((e) => !(e.source === 'event' && e.category && hiddenCategories.has(e.category.id)))),
  [items, deadlines, sections, google.events, categories, hiddenCategories, rangeStart, rangeEnd]);
  const todoMap = useMemo(() => todosByDate(items), [items]);

  // Refresh every 15 minutes and when the app comes back to the foreground
  useEffect(() => {
    const refresh = () => setClock(new Date());
    const interval = setInterval(refresh, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Move on to the new day just after midnight
  useEffect(() => {
    const nextDay = parseLocalDate(addDaysToKey(today, 1));
    const timer = setTimeout(() => setClock(new Date()), nextDay.getTime() - new Date().getTime() + 1000);
    return () => clearTimeout(timer);
  }, [today]);

  // Hide the controls after a few seconds without interaction
  useEffect(() => {
    if (!controlsOpen || barFocused) return undefined;
    const timer = setTimeout(() => setControlsOpen(false), CONTROLS_HIDE_MS);
    return () => clearTimeout(timer);
  }, [controlsOpen, barFocused, layout]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const chooseLayout = (next) => {
    setLayout(next);
    writeGlanceLayout(next);
  };

  if (isLoading || !deadlinesLoaded) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-[var(--bg-page)]" role="status" aria-label="Loading">
        <div className="w-6 h-6 border-2 border-neutral-300 dark:border-neutral-700 border-t-neutral-600 dark:border-t-neutral-300 rounded-full animate-spin" />
      </div>
    );
  }

  const layoutProps = { today, days, entriesByDate, todoMap, now: clock };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[var(--bg-page)] text-neutral-900 dark:text-neutral-100" onClick={() => setControlsOpen((open) => !open)}>
      <h1 className="sr-only">Calendar at a glance</h1>
      <GlanceControls
        visible={controlsOpen || barFocused}
        layout={layout}
        onLayout={chooseLayout}
        onClose={onClose}
        onFocusChange={setBarFocused}
      />
      <div className="flex-1 min-h-0 p-5 sm:p-8">
        {layout === 'week' ? <GlanceWeek {...layoutProps} />
          : layout === 'month' ? <GlanceMonth {...layoutProps} />
            : <GlanceToday {...layoutProps} />}
      </div>
      <p className="absolute bottom-2 right-4 text-xs tabular-nums text-neutral-400 dark:text-neutral-500">
        Updated {format(renderedAt, 'HH:mm')}
      </p>
    </div>
  );
}
