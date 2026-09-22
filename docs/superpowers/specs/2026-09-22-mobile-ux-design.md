# Phone layout and touch UX

Date: 2026-09-22
Status: approved design, awaiting spec review

## Goal

Make Thinking Space comfortable to use on a phone (iPhone and Samsung, 360–430
px wide): thumb-reachable navigation, one-tap adding, controls big enough for a
finger, and no zooming, sideways sliding or accidental drags. Tablets (the Boox),
laptops and desktops keep their current layout, apart from the touch fixes
that also help touch tablets.

"Phone" means the app's existing phone breakpoint, `(max-width: 767.98px)`
(`isMobile` in `SidebarContext`).

## Audit findings this answers (2026-09-22, 360 and 375 px, demo data)

1. The add-event form slides sideways while scrolling (reported on a phone).
   Likely causes: iOS date/time inputs in two-column grids without
   `min-width: 0` / `appearance: none`, and calendar entries picked up by
   the 300 ms touch drag when a finger rests while scrolling.
2. Board cards can't reliably be moved between columns by touch: the board
   uses a plain pointer sensor (drag after 8 px, fighting scroll) and the card
   menu has no "Move to" option. Columns are 256 px in a strip with no snapping.
3. iPhones zoom in on fields under 16 px: sidebar search, tag inputs (notes,
   boards, papers, tasks), paper status / priority / citation style selects,
   the reading list collection filter.
4. Controls hidden until hover at ≥640 px (task card menu, day panel entry
   actions, dashboard folder card actions, template delete) can't be reached
   on touch tablets.
5. Most controls are 16–32 px (69 of 80 on the dashboard under 36 px); the
   drawer's bottom rows are 16–20 px and include "Reset to defaults".
6. In tall sheet forms the primary button is off-screen (New event: Save sits
   below the colour picker).
7. The phone dashboard is ~3,500 px tall; Quick Capture, Focus Timer and
   Recent Notes are fixed at 420 px and mostly empty; Writing scrolls inside
   the page.
8. The notes editor loses ~60 px on the left to BlockNote's drag-handle
   gutter; headings are desktop-sized; DOCX/PDF buttons are 16 px tall.
9. Paper detail shows status/priority/collections above the title; Settings'
   preview card pushes the settings down; some chart labels are 9 px.

## 1. Navigation (phones only)

### Bottom bar

- Fixed to the bottom on phones: **Home · Calendar · + · Reading · Menu**.
  Home = dashboard, Calendar = Calendar page, Reading = Reading List,
  Menu = the menu page (below), + = the Add sheet (below).
- Each tab is a real button with icon and label, at least 48 px tall; the
  current one is marked (`aria-current="page"`) with a tinted pill behind the
  icon, as in mockup B. The + is a raised 56 px round button labelled "Add".
- Height 64 px plus `env(safe-area-inset-bottom)`; `index.html` gets
  `viewport-fit=cover` so iPhones draw it edge to edge above the home bar.
- Hidden while the on-screen keyboard is up (a text field, textarea, select
  or the editor has focus), so typing in a note isn't squeezed.
- Hidden in the glance view and focus mode (they're full-screen already).
- The page content gets bottom padding equal to the bar, so nothing hides
  behind it.

### Top bar (phones)

- The ☰ button goes; the bar shows the page title or breadcrumbs, a Search
  button (opens the existing command palette) and the page's own ⋮ actions.
- Header gets `env(safe-area-inset-top)` padding so it clears the status bar
  under `viewport-fit=cover`.

### Menu page

- The Menu tab opens the existing `Sidebar` in a phone form: full screen
  above the bottom bar (not an 85 % drawer), so the section tree keeps its
  drag-to-reorder, rename, move and ⋯ menus with no second implementation.
- Phone form contents, top to bottom: search box (16 px text), the quick
  links that aren't tabs (Weekly Review, Tags), "Notes and boards" (the
  existing tree, rows ≥ 48 px), "New note, board or folder", then a row of
  large tiles: Settings, Trash, Dark mode, E-reader mode, and the account
  button (Sign out / Sign up to save). Dashboard, Calendar and Reading List
  quick links are left out on phones (they're tabs).
- Choosing an item closes the menu and opens it, as the drawer does today.
- "Reset to defaults" leaves the sidebar on every screen size and moves to
  Settings → Data & backup as a danger-zone button with the same
  confirmation.

### Add sheet (the + button)

A bottom sheet titled "Add" with large tiles **Note, Task, Event, Idea** and
rows **Deadline, Paper to read**, as in mockup B2. Each uses what exists:

- **Note**: creates an untitled note at the top level and opens it (the
  existing `handleCreateItem('note')`).
- **Task**: a task form with a **Board** picker (boards listed by name,
  defaulting to the last board used on this device, stored in
  `localStorage` key `quick-add-board`); the task goes into that board's
  first column. No boards yet: the tile says "Create a board first" and opens
  the new-board flow.
- **Event** / **Deadline**: the existing `EventModal`, preset to Event or
  Deadline, for today.
- **Idea**: a one-line field inside the sheet; Enter or "Save" adds it with
  `addQuickCapture` and shows "Saved to Quick Capture".
- **Paper to read**: the existing `AddPaperModal`.

## 2. Touch fixes (phones, and touch tablets where noted)

- **Tap targets**: icon buttons and small text buttons get a hit area of at
  least 44 × 44 px on phones, mostly by padding (with matching negative
  margin where the layout must not move) or an invisible `::after` hit area
  on buttons that are already positioned; icons keep their size. Target
  after the change, measured by the audit script on every screen: no control
  under 32 px in its smaller dimension (links inside running text excepted),
  and tabs, sheet buttons and form buttons at least 44 px.
- **No iPhone zoom**: on phones every `input`, `select` and `textarea`
  (including tag inputs and the editor's link fields) uses at least 16 px
  text, set once in `index.css`.
- **No sideways sliding**: date/time inputs get `min-width: 0`,
  `appearance: none` and `display: block`; form grid cells get `min-width: 0`;
  the page, main area and sheet panels clip horizontal overflow
  (`overflow-x: clip`) and set `overscroll-behavior-x: none`.
- **Drag only on purpose**: the board switches to the calendar's sensors
  (mouse drag after 6 px; touch drag after a 300 ms press-and-hold within
  8 px), so swipes scroll; the sidebar tree (the Menu page) gets the same.
  Day panel entries already drag only from their grip handle.
- **Hover-only controls** (the four above) are hidden only when the device
  can hover (`@media (hover: hover)`), so touch tablets always see them.

## 3. Screen by screen

- **Dashboard (phones)**: widgets size to their content (no fixed heights),
  nothing scrolls inside a widget (Writing included), empty states stay
  compact, chart and mini-calendar labels at least 11 px.
- **Forms in sheets** (`Modal` on phones): the action buttons live in a
  footer pinned to the bottom of the sheet above the safe area, so Save is
  always visible; the body scrolls. `Modal` gains a `footer` prop; EventModal,
  TaskModal, AddPaperModal and the quick task form pass their buttons
  through it. The "All day" checkbox and similar get a full-row tap area.
- **Boards (phones)**: each column is 85 % of the screen width with
  scroll-snap so a swipe lands on the next column; the card menu gets
  **Move to →** listing the other columns.
- **Notes (phones)**: BlockNote's left gutter shrinks to about 16 px and its
  side menu (the + and drag handle beside each block, a hover control) is
  hidden on phones; typing "/" and the formatting toolbar remain the way to
  add and format blocks. Heading sizes step down (H1 ~28 px, H2 ~22 px, H3 ~18 px),
  DOCX / PDF / template / cite / focus / delete move into the note's ⋮ menu,
  leaving the word count and ⋮.
- **Paper detail (phones)**: title and authors first, then status, priority
  and collections; the copy / trash / tab controls get proper tap areas.
- **Settings (phones)**: opens full-screen; the preview card is shorter
  (one line of sample text and the swatch row).

## Stages

1. **Navigation and touch fixes**: sections 1 and 2. Pull request with a
   preview link to try on the iPhone and Samsung.
2. **Screen by screen**: section 3. Second pull request and preview.

## Out of scope

- A different dashboard layout per device (the widget layout stays shared
  across devices; phones just stop wasting height).
- Offline or native-app changes; the Samsung PNG-icon fix (declined for now).
- Changing the tablet or desktop layout beyond the touch fixes.

## Verification

- `npm run lint` and `npm run build` pass after each stage.
- The audit script (tap sizes, zoom-prone fields, horizontal overflow, tiny
  text) run on every screen at 360 × 780, 375 × 812 and 390 × 844 before and
  after: no horizontal overflow, no zoom-prone fields, no control under
  32 px, primary controls ≥ 44 px.
- Screenshots of every screen at 375 px before and after for review.
- Tablet (834 × 1112) and desktop (1280 × 800): layout unchanged apart from
  hover-only controls now visible on touch.
- Bottom bar hides with the keyboard (focus a field), shows again on blur;
  hidden in glance view and focus mode.
- Board: swipe scrolls between columns; press-and-hold drags a card; Move to
  moves it. Calendar day panel: slow scrolls don't pick up entries.
- On real phones via each preview link: iPhone (the sideways drift in the
  add-event form is gone, no zoom on fields, bar clears the home indicator)
  and Samsung.
