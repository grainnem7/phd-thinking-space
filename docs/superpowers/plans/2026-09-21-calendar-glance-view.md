# Calendar Glance View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full-screen, read-only calendar view (Today / Week / Month) to leave on a Boox e-ink screen with its Transparent screensaver, plus a per-device start page.

**Architecture:** A new special view (`type: 'glance'`) in `src/pages/Dashboard.jsx` that renders `GlanceView` as a fixed full-screen layer over the normal layout. `GlanceView` builds entries with the existing calendar pipeline (`buildEntries` → `groupByDate`, `todosByDate`) for the days the chosen layout needs and hands them to one of three layout components. Per-device choices live in `localStorage` via a small settings module.

**Tech Stack:** React 19, Vite 5, Tailwind CSS 3.4 (`portrait:` / `landscape:` variants), date-fns 4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-21-calendar-glance-view-design.md`

## Global Constraints

- Branch: `feature/calendar-glance-view` (already created from `origin/main`; the spec is committed there).
- `localStorage` keys: `glance-layout` (`today` | `week` | `month`, default `today`), `start-page` (`dashboard` | `glance`, default `dashboard`), `calendar-hidden-categories` (existing). Every storage access is wrapped in try/catch.
- Layout ids and labels exactly: `today` "Today", `week` "Week", `month` "Month".
- Controls auto-hide after 5 seconds (5000 ms). Clock refresh every 15 minutes (900000 ms). No per-minute updates.
- Weeks start on Monday (`weekStartsOn: 1`).
- Close goes to the Calendar page. Escape closes.
- Day lists never scroll: cut off with "+N more". Empty days show "Nothing planned".
- Use theme tokens and existing Tailwind colour classes only (`neutral-*`, `accent`, `red-*` via `styleFor`); no new colours, so e-reader mode styling applies automatically. No animations.
- No new dependencies. The repo has no test runner: each task is verified with `npm run lint`, `npm run build` where noted, and checks in the browser pane against the dev server.
- ESLint uses `eslint-plugin-react-hooks` 7 (`recommended`): no `setState` directly in an effect body (only in callbacks such as timers and listeners), no `Date.now()` anywhere in a component, including effects (the purity rule flags it); use `new Date()`, which is fine and already used in `CalendarWidget.jsx`.
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## Dev server and browser checks

Start the dev server once and keep it running:

```bash
npm run dev -- --host --port 5173 --strictPort
```

Browser checks run in the browser pane at `http://localhost:5173`. Use demo mode: on the sign-in screen click **Try Demo** (demo data has events, deadlines and to-dos around today). Pure-function checks import modules straight from the dev server, e.g. `await import('/src/components/calendar/calendarEntries.js?t=' + Date.now())` (the `?t=` defeats the module cache after edits).

Viewport sizes used below: portrait `834×1112`, landscape `1180×820`. E-reader mode: `localStorage.setItem('eink-mode','true'); location.reload()`; turn it off with `'false'`.

## File structure

| File | Responsibility |
| --- | --- |
| `src/components/calendar/glance/glanceSettings.js` (new) | Layout list; read/write `glance-layout` and `start-page` |
| `src/components/calendar/calendarEntries.js` (modify) | Add shared `HIDDEN_CATEGORIES_KEY`, `loadHiddenCategories()`, and `glanceDays(layout, now)` |
| `src/components/calendar/CalendarView.jsx` (modify) | Use the shared hidden-category loader; "Glance" button |
| `src/components/calendar/glance/GlanceEntry.jsx` (new) | One entry row (`GlanceEntry`), a capped list (`GlanceEntryList`), the empty note (`Nothing`) |
| `src/components/calendar/glance/GlanceControls.jsx` (new) | Tap-to-show toolbar: layout switcher and Close |
| `src/components/calendar/glance/GlanceToday.jsx` (new) | Today layout; exports `TodayDetails` for reuse by Month |
| `src/components/calendar/glance/GlanceWeek.jsx` (new) | Week layout |
| `src/components/calendar/glance/GlanceMonth.jsx` (new) | Month layout |
| `src/components/calendar/glance/GlanceView.jsx` (new) | Container: data, clock, layout choice, controls, "Updated" note |
| `src/pages/Dashboard.jsx` (modify) | `glance` special view, lazy import, command palette entry, start page |
| `src/components/settings/AppearanceSettings.jsx` (modify) | "Open the app on" setting; update the e-reader note copy |

---

### Task 1: Shared helpers (settings, hidden categories, glance days)

**Files:**
- Create: `src/components/calendar/glance/glanceSettings.js`
- Modify: `src/components/calendar/calendarEntries.js` (imports at lines 1-4; add helpers after `dashboardCalendarRange`)
- Modify: `src/components/calendar/CalendarView.jsx:17` (import) and `:28-37` (remove local copy)

**Interfaces:**
- Produces:
  - `GLANCE_LAYOUTS: Array<{ id: 'today'|'week'|'month', label: string }>`
  - `readGlanceLayout(): 'today'|'week'|'month'`, `writeGlanceLayout(layout: string): void`
  - `readStartPage(): 'dashboard'|'glance'`, `writeStartPage(page: string): void`
  - `HIDDEN_CATEGORIES_KEY: 'calendar-hidden-categories'`
  - `loadHiddenCategories(): Set<string>`
  - `glanceDays(layout: string, now?: Date): { today: string, days: string[], range: { start: string, end: string } }` (date keys `YYYY-MM-DD`)

- [ ] **Step 1: Run the check to see it fail**

In the browser pane (dev server running, any page), run:

```js
const m = await import('/src/components/calendar/calendarEntries.js?t=' + Date.now());
typeof m.glanceDays
```

Expected: `"undefined"`.

- [ ] **Step 2: Create `src/components/calendar/glance/glanceSettings.js`**

```js
// Per-device choices for the calendar glance view. They live in localStorage,
// not the account, so each device keeps its own: a Boox can open on the
// glance view while a phone opens the dashboard.

export const GLANCE_LAYOUTS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
];

const LAYOUT_KEY = 'glance-layout';
const START_PAGE_KEY = 'start-page';

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the choice lasts until reload */
  }
}

export function readGlanceLayout() {
  const value = read(LAYOUT_KEY);
  return GLANCE_LAYOUTS.some((layout) => layout.id === value) ? value : 'today';
}

export function writeGlanceLayout(layout) {
  write(LAYOUT_KEY, layout);
}

export function readStartPage() {
  return read(START_PAGE_KEY) === 'glance' ? 'glance' : 'dashboard';
}

export function writeStartPage(page) {
  write(START_PAGE_KEY, page === 'glance' ? 'glance' : 'dashboard');
}
```

- [ ] **Step 3: Add the helpers to `calendarEntries.js`**

Replace the first line:

```js
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays } from 'date-fns';
```

with:

```js
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, eachDayOfInterval } from 'date-fns';
```

Then insert directly after the `dashboardCalendarRange` function (after its closing `}`):

```js

// Days a glance-view layout shows, in display order, and the range to load.
// Today: today and the next six days. Week: Monday to Sunday of this week.
// Month: the month grid (Monday before the 1st to Sunday after the last day).
export function glanceDays(layout, now = new Date()) {
  const today = toDateKey(now);
  let days;
  if (layout === 'week') {
    const monday = startOfWeek(now, { weekStartsOn: 1 });
    days = Array.from({ length: 7 }, (_, i) => toDateKey(addDays(monday, i)));
  } else if (layout === 'month') {
    days = eachDayOfInterval({
      start: startOfWeek(startOfMonth(now), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(now), { weekStartsOn: 1 }),
    }).map(toDateKey);
  } else {
    days = Array.from({ length: 7 }, (_, i) => addDaysToKey(today, i));
  }
  return { today, days, range: { start: days[0], end: days[days.length - 1] } };
}

// Calendar categories hidden on the Calendar page (remembered per device)
export const HIDDEN_CATEGORIES_KEY = 'calendar-hidden-categories';

export function loadHiddenCategories() {
  try {
    const saved = JSON.parse(localStorage.getItem(HIDDEN_CATEGORIES_KEY));
    return new Set(Array.isArray(saved) ? saved : []);
  } catch {
    return new Set();
  }
}
```

(`toDateKey` and `addDaysToKey` are already imported in this file.)

- [ ] **Step 4: Make `CalendarView.jsx` use the shared loader**

Change line 17 from:

```js
import { buildEntries, groupByDate, todosByDate, spanBase } from './calendarEntries';
```

to:

```js
import { buildEntries, groupByDate, todosByDate, spanBase, HIDDEN_CATEGORIES_KEY, loadHiddenCategories } from './calendarEntries';
```

Delete the local copies (currently lines 28-37):

```js
const HIDDEN_CATEGORIES_KEY = 'calendar-hidden-categories';

function loadHiddenCategories() {
  try {
    const saved = JSON.parse(localStorage.getItem(HIDDEN_CATEGORIES_KEY));
    return new Set(Array.isArray(saved) ? saved : []);
  } catch {
    return new Set();
  }
}
```

Leave `const WEEKDAYS = …` and everything else as it is; the existing uses of `HIDDEN_CATEGORIES_KEY` and `loadHiddenCategories` now refer to the imports.

- [ ] **Step 5: Run the checks to see them pass**

In the browser pane:

```js
const m = await import('/src/components/calendar/calendarEntries.js?t=' + Date.now());
const s = await import('/src/components/calendar/glance/glanceSettings.js?t=' + Date.now());
const now = new Date('2026-09-23T10:00:00'); // a Wednesday
const t = m.glanceDays('today', now), w = m.glanceDays('week', now), mo = m.glanceDays('month', now);
localStorage.removeItem('glance-layout'); const def = s.readGlanceLayout();
s.writeGlanceLayout('month'); const saved = s.readGlanceLayout();
localStorage.setItem('glance-layout', 'bogus'); const bogus = s.readGlanceLayout();
localStorage.removeItem('glance-layout');
s.writeStartPage('glance'); const sp = s.readStartPage(); s.writeStartPage('dashboard');
JSON.stringify({
  today: [t.today, t.days.length, t.range],
  week: [w.days[0], w.days[6]],
  month: [mo.days.length, mo.range],
  hidden: m.loadHiddenCategories() instanceof Set,
  layouts: [def, saved, bogus], startPage: [sp, s.readStartPage()],
})
```

Expected:

```json
{"today":["2026-09-23",7,{"start":"2026-09-23","end":"2026-09-29"}],"week":["2026-09-21","2026-09-27"],"month":[35,{"start":"2026-08-31","end":"2026-10-04"}],"hidden":true,"layouts":["today","month","today"],"startPage":["glance","dashboard"]}
```

Then open the Calendar page in the app (sidebar → Calendar) and click a category chip to hide it, reload, and confirm it is still hidden (the shared loader works). Click it again to show it.

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: no output after the `eslint .` line (no errors).

- [ ] **Step 7: Commit**

```bash
git add src/components/calendar/glance/glanceSettings.js src/components/calendar/calendarEntries.js src/components/calendar/CalendarView.jsx
git commit -m "feat(glance): shared helpers for the calendar glance view

Per-device layout and start-page settings, the days each layout shows,
and the hidden-category loader shared with the Calendar page.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Glance view with the Today layout, reachable from the command palette

**Files:**
- Create: `src/components/calendar/glance/GlanceEntry.jsx`
- Create: `src/components/calendar/glance/GlanceControls.jsx`
- Create: `src/components/calendar/glance/GlanceToday.jsx`
- Create: `src/components/calendar/glance/GlanceView.jsx`
- Modify: `src/pages/Dashboard.jsx` (lazy imports ~line 22, `SPECIAL_VIEWS` ~line 25, `renderContent` special views ~line 332, command palette `actions` ~line 616)

**Interfaces:**
- Consumes (Task 1): `glanceDays`, `loadHiddenCategories` from `../calendarEntries`; `GLANCE_LAYOUTS`, `readGlanceLayout`, `writeGlanceLayout` from `./glanceSettings`. Existing: `buildEntries`, `groupByDate`, `todosByDate`, `styleFor` from `../calendarEntries`; `useCalendar()` → `{ items, isLoading }`; `useDashboard()` → `{ deadlines, deadlinesLoaded }`; `useGoogleCalendar(start, end)` → `{ events }`; `useCalendarCategories()` → `{ categories }`; `parseLocalDate`, `toDateKey` from `utils/date`; `addDaysToKey` from `lib/recurrence`.
- Produces:
  - `GlanceEntry({ entry, variant: 'large'|'list'|'cell' })`, `GlanceEntryList({ entries, max, variant })`, `Nothing()` from `GlanceEntry.jsx`
  - `GlanceControls({ visible, layout, onLayout, onClose, onFocusChange })`
  - `TodayDetails({ dateKey, entries, todos })` (named) and default `GlanceToday({ today, days, entriesByDate, todoMap })` from `GlanceToday.jsx`
  - default `GlanceView({ sections, onClose })`
  - Layout components all take `{ today, days, entriesByDate, todoMap, now }` (Today ignores `now`)
  - Dashboard: `SPECIAL_VIEWS.glance = 'Glance'`; `viewItem('glance')` opens the view

- [ ] **Step 1: Run the check to see it fail**

In the browser pane (demo mode, dashboard showing), press `Ctrl+K`, type `glance`.
Expected: no "Open glance calendar" command.

- [ ] **Step 2: Create `src/components/calendar/glance/GlanceEntry.jsx`**

```jsx
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
export default function GlanceEntry({ entry, variant = 'list', className = '' }) {
  if (variant === 'cell') {
    return (
      <li className={`min-w-0 text-sm leading-snug portrait:flex portrait:items-baseline portrait:gap-2 ${className}`}>
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
    <li className={`flex items-baseline min-w-0 ${v.row} ${className}`}>
      <Dot entry={entry} className={v.dot} />
      <span className={`${v.time} flex-shrink-0 tabular-nums text-neutral-500 dark:text-neutral-400`}>{timeLabel(entry)}</span>
      <Title entry={entry} className="truncate" />
      <RepeatMark entry={entry} />
    </li>
  );
}

export function MoreLine({ count, className = '' }) {
  if (count <= 0) return null;
  return <p className={`mt-1 text-sm text-neutral-500 dark:text-neutral-400 ${className}`}>+{count} more</p>;
}

// A day's entries, cut off with "+N more" so the screen works as a still image.
// `portraitMax` shows fewer when the screen is upright; it's done in CSS so the
// count is right the moment the tablet is turned.
export function GlanceEntryList({ entries, max, portraitMax = max, variant = 'list' }) {
  if (entries.length === 0) return null;
  return (
    <>
      <ul className="space-y-1.5">
        {entries.slice(0, max).map((entry, i) => (
          <GlanceEntry key={entry.id} entry={entry} variant={variant} className={i >= portraitMax ? 'portrait:hidden' : ''} />
        ))}
      </ul>
      {portraitMax === max ? (
        <MoreLine count={entries.length - max} />
      ) : (
        <>
          <MoreLine count={entries.length - max} className="portrait:hidden" />
          <MoreLine count={entries.length - portraitMax} className="landscape:hidden" />
        </>
      )}
    </>
  );
}

export function Nothing() {
  return <p className="text-sm text-neutral-400 dark:text-neutral-500">Nothing planned</p>;
}
```

- [ ] **Step 3: Create `src/components/calendar/glance/GlanceControls.jsx`**

```jsx
import { X } from 'lucide-react';
import { GLANCE_LAYOUTS } from './glanceSettings';

// Tap-to-show bar: layout switcher and Close. When hidden it is transparent
// but still reachable with Tab (focus shows it), so a sleeping e-ink screen
// shows only the calendar.
export default function GlanceControls({ visible, layout, onLayout, onClose, onFocusChange }) {
  return (
    <div
      role="toolbar"
      aria-label="Glance view"
      onClick={(e) => e.stopPropagation()}
      onFocus={() => onFocusChange(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) onFocusChange(false);
      }}
      className={`absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 p-1 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg ${visible ? '' : 'opacity-0 pointer-events-none'}`}
    >
      <div role="radiogroup" aria-label="Layout" className="flex items-center gap-1">
        {GLANCE_LAYOUTS.map((option) => {
          const checked = option.id === layout;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onLayout(option.id)}
              className={`px-4 py-2 text-sm rounded-lg ${checked
                ? 'bg-accent text-accent-fg'
                : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        <X size={16} aria-hidden="true" /> Close
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/calendar/glance/GlanceToday.jsx`**

```jsx
import { format } from 'date-fns';
import { parseLocalDate } from '../../../utils/date';
import { GlanceEntryList, Nothing } from './GlanceEntry';

const MAX_TODAY_ENTRIES = 8;
const COMPACT_TODAY_ENTRIES = 4;
const MAX_TODAY_TODOS = 6;
const MAX_DAY_ENTRIES = 3;

function TodoCount({ todos }) {
  if (todos.length === 0) return null;
  const done = todos.filter((t) => t.completed).length;
  return <span className="text-sm tabular-nums text-neutral-500 dark:text-neutral-400">{done} of {todos.length} to-dos</span>;
}

// Today's date, entries and to-dos (also used beside the month grid).
// `compactInPortrait`: under the month grid there's less room, so upright it
// shows fewer entries and a to-do count instead of the list.
export function TodayDetails({ dateKey, entries, todos, compactInPortrait = false }) {
  const hiddenTodos = todos.length - MAX_TODAY_TODOS;
  return (
    <section aria-labelledby="glance-today" className="min-w-0">
      <p className="text-sm uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Today</p>
      <h2
        id="glance-today"
        className={`mt-1 font-serif tracking-tight text-neutral-900 dark:text-neutral-100 ${compactInPortrait ? 'text-3xl landscape:text-5xl' : 'text-4xl sm:text-5xl'}`}
      >
        {format(parseLocalDate(dateKey), 'EEEE d MMMM')}
      </h2>
      <div className={compactInPortrait ? 'mt-6 portrait:mt-3' : 'mt-6'}>
        {entries.length === 0 && todos.length === 0
          ? <Nothing />
          : <GlanceEntryList entries={entries} max={MAX_TODAY_ENTRIES} portraitMax={compactInPortrait ? COMPACT_TODAY_ENTRIES : MAX_TODAY_ENTRIES} variant="large" />}
      </div>
      {compactInPortrait && todos.length > 0 && (
        <p className="mt-3 landscape:hidden"><TodoCount todos={todos} /></p>
      )}
      {todos.length > 0 && (
        <div className={`mt-6 ${compactInPortrait ? 'portrait:hidden' : ''}`}>
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
    <li className="w-full py-3 first:pt-0">
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
        className="min-h-0 overflow-hidden flex flex-col border-t border-neutral-200 dark:border-neutral-800 pt-6 landscape:border-t-0 landscape:border-l landscape:pt-0 landscape:pl-8"
      >
        {/* Days that don't fit wrap into a second column out of sight, so a
            busy week shows whole days only, never one cut in half */}
        <ul className="flex-1 min-h-0 flex flex-col flex-wrap overflow-hidden divide-y divide-neutral-100 dark:divide-neutral-800">
          {upcoming.map((key) => (
            <UpcomingDay key={key} dateKey={key} entries={entriesByDate.get(key) || []} todos={todoMap.get(key) || []} />
          ))}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Create `src/components/calendar/glance/GlanceView.jsx`**

Week and Month are added in Tasks 3 and 4; until then they fall back to Today.

```jsx
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
        <GlanceToday {...layoutProps} />
      </div>
      <p className="absolute bottom-2 right-4 text-xs tabular-nums text-neutral-400 dark:text-neutral-500">
        Updated {format(renderedAt, 'HH:mm')}
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Wire the view into `src/pages/Dashboard.jsx`**

After the line `const TrashView = lazy(() => import('../components/trash/TrashView'));` add:

```js
const GlanceView = lazy(() => import('../components/calendar/glance/GlanceView'));
```

In `SPECIAL_VIEWS`, after `trash: 'Trash',` add:

```js
  glance: 'Glance',
```

In `renderContent`, directly before `if (selectedItem.type === 'calendar') {` add:

```jsx
    if (selectedItem.type === 'glance') {
      return <GlanceView sections={sections} onClose={() => handleSelect(viewItem('calendar'))} />;
    }

```

In the command palette `actions`, after the `{ id: 'calendar', … }` entry add:

```js
          { id: 'glance', label: 'Open glance calendar', icon: CalendarDays, keywords: 'full screen screensaver e-ink boox today week month', run: () => handleSelect(viewItem('glance')) },
```

- [ ] **Step 7: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 8: Check it in the browser**

In the browser pane (demo mode), portrait `834×1112`:
1. `Ctrl+K`, type `glance`, choose **Open glance calendar**. Expected: full-screen view, no sidebar or header; "Today", the date ("Monday 21 September" style), today's entries in time order, a To-do list, then six following days each with entries (max 3 then "+N more") or "Nothing planned"; "Updated HH:MM" bottom right.
2. Click an empty area. Expected: the bar (Today · Week · Month · Close) appears at the top; it disappears about 5 seconds later.
3. Press `Tab` until focus reaches the bar. Expected: it becomes visible and stays while focused.
4. Press `Escape`. Expected: the Calendar page opens. Reopen the view and click **Close**: same.
5. Resize to landscape `1180×820`. Expected: today on the left, the six days on the right with a dividing line.
6. Turn on e-reader mode and reopen. Expected: near-black outline/divider lines, category dots in colour, deadlines red.
7. Check the console: `read_console_messages` with `onlyErrors: true` shows nothing new.

- [ ] **Step 9: Commit**

```bash
git add src/components/calendar/glance/GlanceEntry.jsx src/components/calendar/glance/GlanceControls.jsx src/components/calendar/glance/GlanceToday.jsx src/components/calendar/glance/GlanceView.jsx src/pages/Dashboard.jsx
git commit -m "feat(glance): full-screen calendar glance view with the Today layout

Opens from the command palette. Tap to show the layout switcher and
Close; Escape closes. Refreshes every 15 minutes, at midnight and when
the app returns to the foreground.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Week layout

**Files:**
- Create: `src/components/calendar/glance/GlanceWeek.jsx`
- Modify: `src/components/calendar/glance/GlanceView.jsx` (import and the layout switch)

**Interfaces:**
- Consumes: `GlanceEntryList`, `Nothing` from `./GlanceEntry`; props `{ today, days, entriesByDate, todoMap }` from `GlanceView`.
- Produces: default `GlanceWeek({ today, days, entriesByDate, todoMap })`.

- [ ] **Step 1: Run the check to see it fail**

Open the glance view, tap to show the bar, click **Week**.
Expected: the Today layout still shows (Week falls back to Today).

- [ ] **Step 2: Create `src/components/calendar/glance/GlanceWeek.jsx`**

```jsx
import { format } from 'date-fns';
import { parseLocalDate } from '../../../utils/date';
import { GlanceEntryList, Nothing } from './GlanceEntry';

const MAX_ENTRIES = 6;
// A portrait row is a seventh of the height: three entries, "+N more" and
// the to-do count fit
const MAX_ENTRIES_PORTRAIT = 3;

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
          : <GlanceEntryList entries={entries} max={MAX_ENTRIES} portraitMax={MAX_ENTRIES_PORTRAIT} variant="cell" />}
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
```

- [ ] **Step 3: Register it in `GlanceView.jsx`**

After `import GlanceToday from './GlanceToday';` add:

```js
import GlanceWeek from './GlanceWeek';
```

Replace:

```jsx
        <GlanceToday {...layoutProps} />
```

with:

```jsx
        {layout === 'week' ? <GlanceWeek {...layoutProps} /> : <GlanceToday {...layoutProps} />}
```

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Check it in the browser**

1. Landscape `1180×820`, glance view, choose **Week**. Expected: seven columns Mon–Sun of the current week, today's column tinted with a filled date circle, entries with time before title (titles wrap to at most 2 lines), "Nothing planned" on empty days, to-do counts.
2. Portrait `834×1112`. Expected: seven rows, day name and date on the left of each row.
3. Reload the page and reopen the glance view. Expected: it opens on Week (choice remembered).
4. E-reader mode on: dividers mid-grey, outer outline near-black, today tint visible grey.

- [ ] **Step 6: Commit**

```bash
git add src/components/calendar/glance/GlanceWeek.jsx src/components/calendar/glance/GlanceView.jsx
git commit -m "feat(glance): week layout

Monday to Sunday as seven columns in landscape and seven rows in portrait.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Month layout

**Files:**
- Create: `src/components/calendar/glance/GlanceMonth.jsx`
- Modify: `src/components/calendar/glance/GlanceView.jsx` (import and the layout switch)

**Interfaces:**
- Consumes: `TodayDetails` from `./GlanceToday`; `ChipBody` from `../MonthDayCell`; `styleFor`, `compareGridEntries` from `../calendarEntries`; props `{ today, days, entriesByDate, todoMap, now }`.
- Produces: default `GlanceMonth({ today, days, entriesByDate, todoMap, now })`.

- [ ] **Step 1: Run the check to see it fail**

Glance view → bar → **Month**. Expected: the Today layout shows (fallback).

- [ ] **Step 2: Create `src/components/calendar/glance/GlanceMonth.jsx`**

```jsx
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
```

- [ ] **Step 3: Register it in `GlanceView.jsx`**

After `import GlanceWeek from './GlanceWeek';` add:

```js
import GlanceMonth from './GlanceMonth';
```

Replace:

```jsx
        {layout === 'week' ? <GlanceWeek {...layoutProps} /> : <GlanceToday {...layoutProps} />}
```

with:

```jsx
        {layout === 'week' ? <GlanceWeek {...layoutProps} />
          : layout === 'month' ? <GlanceMonth {...layoutProps} />
            : <GlanceToday {...layoutProps} />}
```

- [ ] **Step 4: Lint and build**

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: ends with `✓ built in …`.

- [ ] **Step 5: Check it in the browser**

1. Landscape `1180×820`, glance view, **Month**. Expected: "September 2026" heading, Mon–Sun header, a 5- or 6-row grid filling the height, today circled, up to 3 chips per day then "+N more", out-of-month days shaded; today's details on the right.
2. Portrait `834×1112`. Expected: grid on top (about 3/5 of the height), today's details below.
3. A multi-day demo event (if present) shows on each of its days; deadlines red with a flag.
4. E-reader mode: chip colours stronger, grid lines visible.

- [ ] **Step 6: Commit**

```bash
git add src/components/calendar/glance/GlanceMonth.jsx src/components/calendar/glance/GlanceView.jsx
git commit -m "feat(glance): month layout

The month grid with today's details beside it in landscape and below it
in portrait.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Ways in: Calendar page button and start page setting

**Files:**
- Modify: `src/components/calendar/CalendarView.jsx` (lucide import line 7; header buttons ~line 329)
- Modify: `src/pages/Dashboard.jsx` (import; initial `selection` state ~line 58)
- Modify: `src/components/settings/AppearanceSettings.jsx` (imports lines 1-17; state in `AppearanceSettings`; new `ChoiceGroup` after the e-reader note ~line 245; note copy)

**Interfaces:**
- Consumes: `readStartPage`, `writeStartPage` from `glanceSettings.js`; `viewItem('glance')` in Dashboard; `onSelect` prop already passed to `CalendarView`.
- Produces: nothing new for other tasks.

- [ ] **Step 1: Run the check to see it fail**

Calendar page: no "Glance" button. Settings → Appearance: no "Open the app on" setting.

- [ ] **Step 2: Add the "Glance" button to `CalendarView.jsx`**

Change line 7 from:

```js
import { ChevronLeft, ChevronRight, Plus, Tags } from 'lucide-react';
```

to:

```js
import { ChevronLeft, ChevronRight, Maximize2, Plus, Tags } from 'lucide-react';
```

Directly before the Today button (`<button type="button" onClick={() => selectDate(todayKey)} …>`), add:

```jsx
            <button
              type="button"
              onClick={() => onSelect?.({ id: 'glance', type: 'glance', name: 'Glance' })}
              title="Full-screen calendar to leave on display"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-neutral-300 dark:hover:border-neutral-600 bg-white dark:bg-neutral-900"
            >
              <Maximize2 size={15} aria-hidden="true" /> Glance
            </button>
```

- [ ] **Step 3: Start on the glance view when chosen, in `Dashboard.jsx`**

After `import GoogleCalendarSync from '../components/calendar/GoogleCalendarSync';` add:

```js
import { readStartPage } from '../components/calendar/glance/glanceSettings';
```

Change:

```js
  const [selection, setSelectedItem] = useState(null);
```

to:

```js
  // Devices set to start on the glance calendar (Settings → Appearance) open on it
  const [selection, setSelectedItem] = useState(() => (readStartPage() === 'glance' ? viewItem('glance') : null));
```

- [ ] **Step 4: Add the setting to `AppearanceSettings.jsx`**

Change line 1 from `import { useId } from 'react';` to:

```js
import { useId, useState } from 'react';
```

After the `} from '../../lib/appearance';` line add:

```js
import { readStartPage, writeStartPage } from '../calendar/glance/glanceSettings';
```

After the `MODES` array add:

```js
const START_PAGES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'glance', label: 'Glance calendar' },
];
```

Inside `AppearanceSettings()`, after `const einkLabelId = useId();` add:

```js
  const [startPage, setStartPage] = useState(readStartPage);
  const chooseStartPage = (page) => {
    setStartPage(page);
    writeStartPage(page);
  };
```

Replace the e-reader note:

```jsx
          E-reader mode uses its own black-and-white palette. Your colour choices apply again when you turn it off.
```

with:

```jsx
          E-reader mode uses its own high-contrast palette, keeping colour only for categories and status. Your colour scheme applies again when you turn it off.
```

Directly after that note's closing `)}` (the `{einkMode && ( … )}` block) and before `<ChoiceGroup legend="Colour scheme"`, add:

```jsx
      <ChoiceGroup
        legend="Open the app on"
        hint="Remembered on this device only, so a Boox can open on the calendar while your phone opens the dashboard."
        value={startPage}
        options={START_PAGES}
        onChange={chooseStartPage}
        className={SEGMENTED}
        optionClassName={segmentClass}
        renderOption={(page) => page.label}
      />
```

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 6: Check it in the browser**

1. Calendar page: a "Glance" button left of "Today"; clicking it opens the glance view; Close returns to the Calendar page.
2. Settings → Appearance: "Open the app on" with Dashboard / Glance calendar; choose **Glance calendar**, close Settings, reload. Expected: the app opens straight on the glance view (after the demo data loads).
3. Close the glance view, Settings → choose **Dashboard**, reload. Expected: the dashboard opens.
4. `localStorage.removeItem('start-page'); location.reload()`. Expected: dashboard (default).
5. With e-reader mode on, the Appearance note reads "…keeping colour only for categories and status…".

- [ ] **Step 7: Commit**

```bash
git add src/components/calendar/CalendarView.jsx src/pages/Dashboard.jsx src/components/settings/AppearanceSettings.jsx
git commit -m "feat(glance): open from the Calendar page, or on start per device

A Glance button on the Calendar page and an \"Open the app on\" setting
(Dashboard / Glance calendar) remembered per device. Also updates the
e-reader note now that e-reader mode keeps some colour.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Full verification, pull request and Boox check

**Files:** none (verification and PR only)

- [ ] **Step 1: Lint and build**

Run: `npm run lint` then `npm run build`
Expected: no lint errors; build ends with `✓ built in …`.

- [ ] **Step 2: Matrix check in the browser**

For each layout (Today, Week, Month) × orientation (`834×1112`, `1180×820`) × theme (normal, dark, e-reader), open the glance view in demo mode and confirm: nothing scrolls or overflows off-screen, entries are in time order (all-day first), "+N more" appears when a day is full, empty days say "Nothing planned", the "Updated" note is visible, the bar shows on tap and hides after about 5 seconds.

Hidden categories: on the Calendar page hide one category, open the glance view, confirm its events are absent; show it again.

- [ ] **Step 3: Midnight roll-over**

In the browser pane, with the glance view open on Today, run:

```js
const RealDate = Date;
const fake = new RealDate(); fake.setDate(fake.getDate() + 1); fake.setHours(0, 0, 30, 0);
globalThis.Date = class extends RealDate {
  constructor(...a) { super(...(a.length ? a : [fake.getTime()])); }
  static now() { return fake.getTime(); }
};
document.dispatchEvent(new Event('visibilitychange'));
await new Promise((r) => setTimeout(r, 300));
const heading = document.getElementById('glance-today')?.textContent;
globalThis.Date = RealDate;
heading
```

Expected: tomorrow's date (e.g. "Tuesday 22 September"). Then run `document.dispatchEvent(new Event('visibilitychange'))` to return to the real date.

- [ ] **Step 4: Push and open the pull request** (only with the user's OK)

```bash
git push -u origin feature/calendar-glance-view
gh pr create --base main --head feature/calendar-glance-view --title "Calendar glance view for leaving on display" --body-file pr-body.md
```

The PR body summarises the three layouts, the controls, the start page setting, the verification above, and ends with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

(Write it to a temporary file outside the repo, e.g. the scratchpad, and pass that path to `--body-file`.)

- [ ] **Step 5: Boox check with the preview link**

Wait for the PR checks (`build_and_preview`, `Deploy Preview`) to pass, then give the user the preview URL from the PR comment. The user checks on the Boox: each layout readable in both orientations; with the Transparent screensaver, sleeping the Boox leaves the calendar on screen with no controls showing.

- [ ] **Step 6: Merge** (only when the user says so)

```bash
gh pr merge <number> --merge
```

Then confirm the deploy run on `main` succeeds.
