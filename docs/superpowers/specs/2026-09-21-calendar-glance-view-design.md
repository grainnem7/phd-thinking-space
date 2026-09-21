# Calendar glance view

Date: 2026-09-21
Status: approved design, awaiting spec review

## Goal

A full-screen, read-only calendar screen designed to be left on display. The
main use is a Boox Note Air5 C (10.3" colour e-ink, Android 15) with its
**Transparent** screensaver, which keeps whatever was last on screen while the
tablet sleeps. The user opens the glance view, puts the Boox to sleep, and the
calendar stays visible with no power use.

It should also work on any other screen (laptop, phone), in the normal, dark
and e-reader themes.

## What it shows

Everything the Calendar page shows, from the same data:

- calendar events, including repeating and multi-day events
- Google Calendar events, while a Google account is connected
- deadlines
- board task due dates
- per-day to-dos

Calendar categories hidden on the Calendar page stay hidden (same
`calendar-hidden-categories` setting). Entries within a day use the existing
list order (`compareEntries`: all-day first, then by start time); month cells
use the grid order (`compareGridEntries`).

## Layouts

Three layouts; the user switches between them and the choice is remembered on
the device (`localStorage` key `glance-layout`, default `today`). Each adapts to
the screen's orientation with Tailwind's `portrait:` / `landscape:` variants.

1. **Today** (`today`), best in portrait
   - Large date heading ("Monday 21 September").
   - Today: all-day items, then the timed schedule, then to-dos with their
     done state.
   - The next six days as a compact list: day name and date, then each
     entry's time and title (to-dos as a "2 of 3 to-dos" count).
   - Landscape: today on the left, the next six days on the right.
2. **Week** (`week`), best in landscape
   - Monday to Sunday of the current week, today highlighted.
   - Landscape: seven columns. Portrait: seven rows, one per day, so nothing
     is squeezed.
   - Each day lists its entries (time and title) and a to-do count.
3. **Month** (`month`), best in landscape
   - The current month grid (weeks start Monday), larger and cleaner than
     the Calendar page's grid, with category chips and deadline styling.
   - Today's details (as in the Today layout's "today" block) beside the grid
     in landscape, underneath it in portrait.

A day with nothing on it says so quietly ("Nothing planned") rather than
leaving an unexplained gap. Long lists are cut off with "+N more" instead of
scrolling: the screen must make sense as a still image.

## Getting in and out

- **Calendar page:** a "Glance" button in the page header opens the view.
- **Command palette:** an "Open glance calendar" command.
- **Start page:** Settings → Appearance gets "Open the app on:
  Dashboard / Glance calendar", stored per device (`localStorage` key
  `start-page`, default `dashboard`). When set to glance, the app opens
  straight into the glance view after sign-in.
- **Controls:** the view is full-screen with no sidebar or header. A small
  bar with Today · Week · Month · Close shows when the view opens and whenever
  you tap; it hides again after 5 seconds without interaction, so the sleeping
  screen shows only the calendar. A small "Tap for options" note beside the
  "Updated" time says how to bring it back. The bar stays visible while it has keyboard focus. Escape closes
  the view.
- **Close** goes to the Calendar page.

## Staying current

- Data updates live while the app is open (the existing Firestore listeners
  and Google fetches).
- The view re-renders at midnight so "today" moves on, and when the app comes
  back to the foreground (`visibilitychange`).
- A small "Updated 14:30" note in a corner shows when the view last refreshed
  its clock. It refreshes when data changes, when the app returns to the
  foreground, and every 15 minutes; not every minute, to avoid needless e-ink
  refreshes.
- While the Boox is asleep nothing updates; that's the screensaver, not the
  app. The "Updated" note makes a stale screen obvious.

## Look

- Large type and generous spacing; readable from arm's length.
- Uses the theme tokens, so e-reader mode gets the colour e-ink styling
  (near-black outlines, mid-grey dividers, deeper category colours, red
  deadlines) with no special casing. Normal and dark themes work too.
- No hover-only affordances, no animations.

## Architecture

The view lives inside the app, so sign-in, data, Google, categories and
themes all work unchanged. It renders as a fixed, full-screen layer (like the
PDF viewer) on top of the normal layout, so `Layout`, `Sidebar` and `Header`
need no changes.

New files, each with one job:

| File | Purpose |
| --- | --- |
| `src/components/calendar/glance/GlanceView.jsx` | Container: loads data, builds `entriesByDate` / `todoMap` for the range the layout needs, holds the layout choice and the clock, renders the controls and the chosen layout |
| `src/components/calendar/glance/GlanceControls.jsx` | Tap-to-show bar (layout switcher, close) with auto-hide |
| `src/components/calendar/glance/GlanceToday.jsx` | Today layout |
| `src/components/calendar/glance/GlanceWeek.jsx` | Week layout |
| `src/components/calendar/glance/GlanceMonth.jsx` | Month layout |
| `src/components/calendar/glance/GlanceEntry.jsx` | One entry (dot or chip, time, title), shared by the layouts |
| `src/components/calendar/glance/glanceSettings.js` | Read/write `glance-layout` and `start-page` (with try/catch around storage) |

Changes to existing files:

- `src/components/calendar/calendarEntries.js`: move
  `loadHiddenCategories` / the storage key here from `CalendarView.jsx` so
  both views share them; add a helper for the date range a layout needs.
- `src/components/calendar/CalendarView.jsx`: use the shared hidden-category
  loader; add the "Glance" button.
- `src/pages/Dashboard.jsx`: add `glance` to `SPECIAL_VIEWS`, render
  `GlanceView` for it, add the command palette entry, and start on the glance
  view when `start-page` is `glance`.
- `src/components/settings/AppearanceSettings.jsx`: the "Open the app on"
  setting.

Data comes from the same hooks the Calendar page uses: `useCalendar`,
`useDashboard`, `useGoogleCalendar(rangeStart, rangeEnd)`,
`useCalendarCategories`, and `sections` (board tasks) passed in from the page.
The range is today to today + 6 for Today, the current Monday–Sunday for Week,
and the month grid (Monday before the 1st to Sunday after the last day) for
Month; all ranges include today for the "today" block.

## Out of scope

- Keeping the Google connection alive beyond an hour (needs a server-side
  token refresh; tracked separately with the sync issue).
- A native Android widget or a no-sign-in web widget.
- Editing from the glance view: tapping shows the controls; editing stays on
  the Calendar page.

## Verification

The repo has no test runner, so verification is lint, build and hands-on
checks:

- `npm run lint` and `npm run build` pass.
- In the browser, each layout in portrait (834×1112) and landscape
  (1180×820), in normal, dark and e-reader modes, with demo data: correct
  days, ordering, "+N more" cut-off, empty days, hidden categories respected.
- Controls: tap shows the bar, it hides after 5 s, stays while focused,
  Escape and Close go to the Calendar page, layout choice persists across a
  reload.
- Start page: with "Glance calendar" chosen, a reload opens the glance view;
  another device (or cleared storage) still opens the dashboard.
- Midnight roll-over, checked by faking the clock in the browser.
- On the Boox via the pull request's preview link: readable in both
  orientations, and the Transparent screensaver keeps it on screen.
