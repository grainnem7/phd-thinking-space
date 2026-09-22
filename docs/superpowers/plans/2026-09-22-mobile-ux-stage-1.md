# Phone UX, Stage 1 (Navigation and Touch Fixes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On phones, a bottom tab bar (Home · Calendar · + · Reading · Menu) with a quick-add sheet and a full-screen Menu page, plus app-wide touch fixes (no iPhone zoom, no sideways sliding, deliberate drags, finger-sized controls, no hover-only controls on touch).

**Architecture:** `Layout` renders a new `BottomNav` below the phone breakpoint and pads `main` for it. The Menu tab opens the existing `Sidebar`, restyled full-screen on phones. The + opens `QuickAdd`, which mounts its data hooks only while in use and reuses `EventModal`, `AddPaperModal` and the board `TaskForm`. Touch fixes are mostly one phone-only block in `index.css`, plus shared drag sensors in `src/lib/dndSensors.js`.

**Tech Stack:** React 19, Vite 5, Tailwind CSS 3.4 (`max-md:` variant, arbitrary values), @dnd-kit/core, lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-22-mobile-ux-design.md` (sections 1 and 2; section 3 is Stage 2).

## Global Constraints

- Branch: `feature/mobile-ux` (from `origin/main`; the spec is committed there).
- Phone = `(max-width: 767.98px)`: `isMobile` from `useSidebar()` in JS, `max-md:` in Tailwind, `@media (max-width: 767.98px)` in CSS. Tablet and desktop layouts must not change, except hover-only controls becoming visible on touch devices.
- Bottom bar height: `--bottom-nav-h: calc(4rem + env(safe-area-inset-bottom))` (defined in `index.css`); use `var(--bottom-nav-h)` everywhere, never a literal.
- Layers: phone menu (`Sidebar`) `z-30`; bottom bar `z-[35]`; glance view, PDF viewer, toasts `z-40`; dialogs, command palette, dropdowns `z-50`.
- `localStorage` key for the quick-add board: `quick-add-board`.
- No new dependencies. No test runner: verify with `npm run lint`, `npm run build` and the browser checks below.
- ESLint `react-hooks` 7: no `setState` directly in an effect body (callbacks only), no `Date.now()` anywhere in components (use `new Date()`), no manual memo the compiler can't preserve.
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## Dev server, demo data and the audit

```bash
npm run dev -- --port 5173 --strictPort
```

Browser pane at `http://localhost:5173`, **Try Demo**. Phone sizes: `375×812` (main), `360×780`, `390×844`; tablet `834×1112`; desktop `1280×800`. Stop the server at the end by port (`Get-NetTCPConnection -LocalPort 5173 -State Listen` → `Stop-Process`), not just the shell task.

**Audit script** (paste into the browser pane; call `__audit()` on each screen). Counts a control's effective tap size including a `.tap-area` hit area:

```js
window.__audit = () => {
  const W = innerWidth;
  const vis = (el) => { const r = el.getBoundingClientRect(); if (!r.width || !r.height) return false; let n = el; while (n && n !== document.body) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false; n = n.parentElement; } return !el.closest('[inert]'); };
  const name = (el) => (el.getAttribute('aria-label') || el.title || el.textContent || el.placeholder || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 28);
  const size = (el) => { const r = el.getBoundingClientRect(); let w = r.width, h = r.height; const a = getComputedStyle(el, '::after'); if (a.content && a.content !== 'none' && a.position === 'absolute') { w = Math.max(w, parseFloat(a.width) || 0); h = Math.max(h, parseFloat(a.height) || 0); } return Math.min(w, h); };
  const controls = [...document.querySelectorAll('button, a[href], [role=button], [role=checkbox], [role=radio], [role=tab], [role=menuitem]')].filter(vis).filter((el) => !el.closest('.bn-editor p, .bn-editor li'));
  const small = controls.filter((el) => size(el) < 32);
  const zoom = [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]), textarea, select')].filter(vis).filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16);
  return { overflowX: document.documentElement.scrollWidth - W, controls: controls.length, under32: small.map((el) => `${name(el)} ${Math.round(size(el))}px`), zoomFields: zoom.map(name) };
};
```

## File structure

| File | Responsibility |
| --- | --- |
| `src/lib/dndSensors.js` (new) | Mouse-or-long-press drag sensors shared by calendar, board and sidebar |
| `src/hooks/useEditingFocus.js` (new) | True while a text field or the editor has focus (keyboard likely up) |
| `src/components/layout/BottomNav.jsx` (new) | The phone bottom bar |
| `src/components/layout/QuickAdd.jsx` (new) | The + sheet and the forms it opens |
| `src/components/layout/QuickTaskModal.jsx` (new) | New task with a board picker |
| `src/index.css` (modify) | Phone block: 16 px fields, date fields, no sideways overflow, tap sizes, `--bottom-nav-h` |
| `index.html` (modify) | `viewport-fit=cover` |
| `src/components/common/Modal.jsx` (modify) | Dialog panel clips horizontal overflow |
| `src/components/layout/Layout.jsx` (modify) | Renders `BottomNav`, pads `main` |
| `src/components/layout/Header.jsx` (modify) | No ☰ on phones, safe-area top |
| `src/components/layout/Sidebar.jsx` (modify) | Full-screen phone form, tiles footer, shared sensors, no Reset |
| `src/components/settings/DataSettings.jsx` (modify) | "Reset to defaults" danger zone |
| `src/pages/Dashboard.jsx` (modify) | Quick add state and wiring |
| `src/components/calendar/calendarDnd.js`, `src/components/board/KanbanBoard.jsx` (modify) | Shared sensors |
| `src/components/calendar/EventModal.jsx`, `src/components/board/TaskModal.jsx` (modify) | Deadline preset; export `TaskForm` |
| Toasts: `CalendarDialogs.jsx`, `NoteEditor.jsx` (modify) | Sit above the bar on phones |
| Hover-only: `TaskCard.jsx`, `DayPanel.jsx`, `TemplatePickerModal.jsx`, `pages/Dashboard.jsx` (modify) | Hide only on hover-capable devices |
| Small text controls (Task 7 list) (modify) | `tap-area` class |

---

### Task 1: Touch-friendly drag sensors

**Files:**
- Create: `src/lib/dndSensors.js`
- Modify: `src/components/calendar/calendarDnd.js` (imports; remove `MousePointerSensor`; `useCalendarSensors`)
- Modify: `src/components/board/KanbanBoard.jsx` (sensor block ~line 54)
- Modify: `src/components/layout/Sidebar.jsx` (sensor block ~line 429)

**Interfaces:**
- Produces: `MousePointerSensor` (class), `useTouchFriendlySensors(keyboardOptions)` → sensors for `DndContext`.

- [ ] **Step 1: Create `src/lib/dndSensors.js`**

```js
import { PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';

// Mouse and pen only; touch goes through TouchSensor so a swipe still scrolls.
export class MousePointerSensor extends PointerSensor {
  static activators = [{
    eventName: 'onPointerDown',
    handler: ({ nativeEvent: event }, { onActivation }) => {
      if (event.pointerType === 'touch' || !event.isPrimary || event.button !== 0) return false;
      onActivation?.({ event });
      return true;
    },
  }];
}

// A mouse drags after moving 6px. A finger has to press and hold for 300ms
// (moving less than 8px) first, so swiping over draggable things scrolls.
export function useTouchFriendlySensors(keyboardOptions) {
  return useSensors(
    useSensor(MousePointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
    useSensor(KeyboardSensor, keyboardOptions),
  );
}
```

- [ ] **Step 2: Use it in `calendarDnd.js`**

Change the `@dnd-kit/core` import to:

```js
import { KeyboardCode, pointerWithin, closestCenter } from '@dnd-kit/core';
import { useTouchFriendlySensors } from '../../lib/dndSensors';
```

(keep any other names from that import that the file still uses; run lint to confirm). Delete the `// Mouse and pen only…` comment and the whole `class MousePointerSensor extends PointerSensor { … }` block. Replace the body of `useCalendarSensors` with:

```js
export function useCalendarSensors() {
  return useTouchFriendlySensors({ coordinateGetter: dayCellCoordinates });
}
```

- [ ] **Step 3: Use it in `KanbanBoard.jsx`**

Replace

```js
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
```

with

```js
  const sensors = useTouchFriendlySensors({ coordinateGetter: sortableKeyboardCoordinates });
```

Add `import { useTouchFriendlySensors } from '../../lib/dndSensors';` and remove `PointerSensor`, `KeyboardSensor`, `useSensor`, `useSensors` from the `@dnd-kit/core` import if nothing else uses them.

- [ ] **Step 4: Use it in `Sidebar.jsx`**

Replace

```js
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: siblingKeyboardCoordinates,
      keyboardCodes: KEYBOARD_CODES,
    })
  );
```

with

```js
  const sensors = useTouchFriendlySensors({ coordinateGetter: siblingKeyboardCoordinates, keyboardCodes: KEYBOARD_CODES });
```

Add the import and trim the `@dnd-kit/core` import the same way.

- [ ] **Step 5: Lint and check**

Run: `npm run lint` → no errors. `grep -rn "MousePointerSensor" src` → only `src/lib/dndSensors.js`.
Browser, desktop size: drag a board card to another column with the mouse (`left_click_drag`) → it moves; drag a calendar entry's grip to another day → it moves; drag a sidebar item to reorder → it moves.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dndSensors.js src/components/calendar/calendarDnd.js src/components/board/KanbanBoard.jsx src/components/layout/Sidebar.jsx
git commit -m "fix(dnd): press and hold to drag on touch, so swipes scroll

The board and the sidebar tree dragged after 8px of any pointer
movement, fighting scrolling on phones. They now share the calendar's
sensors: mouse after 6px, touch after a 300ms hold.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Phone CSS foundation and hover-only controls

**Files:**
- Modify: `src/index.css` (append a PHONES section at the end)
- Modify: `index.html:6`
- Modify: `src/components/common/Modal.jsx` (panel className)
- Modify: `src/components/board/TaskCard.jsx:120`, `src/components/calendar/DayPanel.jsx:170`, `src/components/templates/TemplatePickerModal.jsx:95`, `src/pages/Dashboard.jsx:488`

**Interfaces:**
- Produces: CSS variable `--bottom-nav-h`; CSS class `.tap-area` (phones: invisible 44 px hit area; element must not be `absolute`/`fixed`/`sticky`).

- [ ] **Step 1: Record the before state**

At `375×812`, paste the audit script and run `__audit()` on Dashboard, Calendar with the New event dialog open, a paper page, a note and a board. Keep the output to compare (zoom fields and under-32 lists).

- [ ] **Step 2: Append to `src/index.css`**

```css
/* ========================================
   PHONES
   Touch-first fixes below the phone breakpoint (767.98px, the same as
   SidebarContext's MOBILE_QUERY and Tailwind's max-md). Tablets and
   desktops are unaffected.
   ======================================== */

:root {
  /* Height of the phone bottom bar, including the iPhone home-bar area */
  --bottom-nav-h: calc(4rem + env(safe-area-inset-bottom));
}

@media (max-width: 767.98px) {
  /* iPhones zoom into fields with text under 16px; large title fields keep their size */
  input:not([type="checkbox"], [type="radio"], [type="range"], [type="color"]):not(.text-lg, .text-xl, .text-2xl, .text-3xl, .text-4xl),
  select,
  textarea:not(.text-lg, .text-xl, .text-2xl, .text-3xl, .text-4xl) {
    font-size: 16px !important;
  }

  /* iOS draws date and time fields at a fixed minimum width; let them shrink
     so two side by side can't push a form wider than the screen */
  input[type="date"],
  input[type="time"],
  input[type="datetime-local"] {
    display: block;
    min-width: 0;
    -webkit-appearance: none;
    appearance: none;
  }
  input[type="date"]::-webkit-date-and-time-value,
  input[type="time"]::-webkit-date-and-time-value {
    text-align: left;
  }
  form .grid > *,
  [role="dialog"] .grid > * {
    min-width: 0;
  }

  /* Pages and dialogs never scroll sideways */
  html,
  body {
    overflow-x: clip;
  }
  [role="dialog"] {
    overflow-x: clip;
    overscroll-behavior-x: none;
  }

  /* Icon-only buttons get a finger-sized box (the icon stays the same size).
     Swatches and tick boxes draw their look on the button itself, and the
     editor has its own toolbars, so they're left alone. */
  :where(button, [role="button"]):has(> svg:only-child):not([role="checkbox"], [role="radio"], .bn-container *) {
    min-width: 40px;
    min-height: 40px;
  }

  /* Small text buttons and chips: an invisible tap area at least 44px tall
     around them, without changing how they look. Only on elements that
     aren't already absolutely positioned. */
  .tap-area {
    position: relative;
  }
  .tap-area::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: max(100%, 44px);
    height: max(100%, 44px);
    transform: translate(-50%, -50%);
  }
}
```

- [ ] **Step 3: `viewport-fit=cover` in `index.html`**

Change `<meta name="viewport" content="width=device-width, initial-scale=1.0" />` to:

```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

- [ ] **Step 4: Dialog panel clips sideways overflow (`Modal.jsx`)**

In the panel's className, change `max-h-[90vh] sm:max-h-[85vh] overflow-y-auto focus:outline-none` to `max-h-[90vh] sm:max-h-[85vh] overflow-y-auto overflow-x-hidden overscroll-contain focus:outline-none`.

- [ ] **Step 5: Hover-only controls only on hover devices**

In each of the four files, in the className at the given line, replace:
- `sm:opacity-0` → `[@media(hover:hover)]:opacity-0`
- `sm:group-hover:opacity-100` → `[@media(hover:hover)]:group-hover:opacity-100`
- `sm:group-focus-within:opacity-100` → `[@media(hover:hover)]:group-focus-within:opacity-100`
- `sm:focus-within:opacity-100` → `[@media(hover:hover)]:focus-within:opacity-100`

Files: `src/components/board/TaskCard.jsx` (line ~120), `src/components/calendar/DayPanel.jsx` (~170), `src/components/templates/TemplatePickerModal.jsx` (~95), `src/pages/Dashboard.jsx` (~488). Afterwards `grep -rn "sm:opacity-0" src` → no results.

- [ ] **Step 6: Lint, build, check**

Run `npm run lint` and `npm run build` → clean. Browser at `375×812`, `__audit()` again:
- `zoomFields` is empty on every screen from Step 1.
- `overflowX` is 0; with the New event dialog open, `document.querySelector('[role=dialog]').scrollWidth - document.querySelector('[role=dialog]').clientWidth` is 0.
- Icon-only buttons from the Step 1 list (edit/delete pencils, ⋯ menus, paper star/open/trash, tab controls) now measure ≥ 40.
- The note title field is still large (`getComputedStyle(document.querySelector('input.font-serif')).fontSize` ≥ 30px).
At `834×1112` (tablet), open a board: card ⋯ buttons are visible without hovering. At `1280×800` with the mouse, they appear on hover as before.

- [ ] **Step 7: Commit**

```bash
git add src/index.css index.html src/components/common/Modal.jsx src/components/board/TaskCard.jsx src/components/calendar/DayPanel.jsx src/components/templates/TemplatePickerModal.jsx src/pages/Dashboard.jsx
git commit -m "fix(mobile): no zoom, no sideways sliding, finger-sized icon buttons

Phone-only CSS: 16px fields (iPhones zoom below that), date and time
fields that can shrink (iOS kept them wide enough to push forms past the
screen edge), no horizontal scrolling in pages or dialogs, 40px icon
buttons and a .tap-area helper. Controls that appeared only on hover now
hide only on devices that can hover, so touch tablets see them.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Move "Reset to defaults" into Settings

**Files:**
- Modify: `src/components/settings/DataSettings.jsx`
- Modify: `src/components/layout/Sidebar.jsx` (remove the Reset button ~line 958-967, the reset confirmation `Modal` ~line 1073-1094, `resetToDefaults` from the `useFirestore()` destructuring, `RotateCcw` from the lucide import if unused)

- [ ] **Step 1: Add the danger zone to `DataSettings.jsx`**

Add imports:

```js
import { RotateCcw } from 'lucide-react';
import { useConfirm } from '../common/ConfirmDialog';
import Button from '../common/Button';
```

(merge `RotateCcw` into the existing lucide import). Get `resetToDefaults` from `useFirestore()` alongside `sections`, and add inside the component:

```js
  const confirm = useConfirm();

  const handleReset = async () => {
    const ok = await confirm({
      title: 'Reset all data',
      body: 'This permanently deletes all your notes, boards and folders, including anything in Trash, and brings back the starter sections. It can’t be undone, so download a backup first.',
      confirmLabel: 'Delete all & reset',
      danger: true,
    });
    if (!ok) return;
    await resetToDefaults();
    setMessage({ text: 'Everything has been reset to the starter sections.' });
  };
```

After the closing `</section>` of the Backup section (before the `role="status"` div), add:

```jsx
      <section aria-labelledby="reset-heading">
        <h3 id="reset-heading" className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-widest font-medium mb-3">Start over</h3>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border border-rose-200 dark:border-rose-900/60 rounded-xl">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <RotateCcw size={18} className="mt-0.5 flex-shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Reset to defaults</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Deletes all notes, boards and folders and restores the starter sections.</p>
            </div>
          </div>
          <Button variant="danger" onClick={handleReset}>Reset…</Button>
        </div>
      </section>
```

- [ ] **Step 2: Remove it from `Sidebar.jsx`**

Delete the `{!iconOnly && ( <button … onClick={() => setModalState({ type: 'reset' })} …>Reset to defaults</button> )}` block and the `{/* Reset to Defaults Confirmation Modal */} <Modal isOpen={modalState.type === 'reset'} …>…</Modal>` block. Remove `resetToDefaults` from the `useFirestore()` destructuring and `RotateCcw` from the lucide import if nothing else uses it.

- [ ] **Step 3: Lint and check**

`npm run lint` → clean; `grep -n "Reset to defaults\|resetToDefaults" src/components/layout/Sidebar.jsx` → nothing.
Browser (demo): Settings → Data & backup shows "Start over · Reset to defaults"; clicking Reset… opens the confirmation; Cancel closes it with nothing deleted. The sidebar footer no longer has the link.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/DataSettings.jsx src/components/layout/Sidebar.jsx
git commit -m "fix(settings): move Reset to defaults out of the sidebar

It deletes everything, and sat among small links at the bottom of the
sidebar where a finger can hit it by mistake. It now lives in Settings,
Data & backup, under Start over, with the same confirmation.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Bottom bar

**Files:**
- Create: `src/hooks/useEditingFocus.js`, `src/components/layout/BottomNav.jsx`
- Modify: `src/components/layout/Layout.jsx`, `src/components/layout/Header.jsx`, `src/pages/Dashboard.jsx`, `src/components/calendar/CalendarDialogs.jsx:94`, `src/components/notes/NoteEditor.jsx:306`

**Interfaces:**
- Produces: `useEditingFocus(): boolean`; `BottomNav({ current, onHome, onCalendar, onReading, onAdd, onMenu })` with `current` one of `'home' | 'calendar' | 'reading' | 'menu'`; `Layout` gains prop `onQuickAdd`.

- [ ] **Step 1: Create `src/hooks/useEditingFocus.js`**

```js
import { useEffect, useState } from 'react';

const TEXT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);

function isTyping(el) {
  if (!el || el === document.body) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && TEXT_TYPES.has((el.getAttribute('type') || 'text').toLowerCase());
}

// True while a text field or the editor has focus, i.e. while a phone's
// on-screen keyboard is probably up
export function useEditingFocus() {
  const [typing, setTyping] = useState(() => typeof document !== 'undefined' && isTyping(document.activeElement));

  useEffect(() => {
    let timer;
    const update = () => setTyping(isTyping(document.activeElement));
    // Focus moves in two steps (out, then in): read it once it has landed
    const onFocusOut = () => {
      clearTimeout(timer);
      timer = setTimeout(update, 0);
    };
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  return typing;
}
```

- [ ] **Step 2: Create `src/components/layout/BottomNav.jsx`**

```jsx
import { BookOpen, CalendarDays, Home, Menu, Plus } from 'lucide-react';

function Tab({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-col items-center justify-center gap-0.5 text-xs touch-manipulation ${active
        ? 'text-neutral-900 dark:text-neutral-100 font-semibold'
        : 'text-neutral-500 dark:text-neutral-400'}`}
    >
      <span className={`flex items-center justify-center w-14 h-8 rounded-full ${active ? 'bg-accent-soft' : ''}`}>
        <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
      </span>
      {label}
    </button>
  );
}

// Phone navigation: Home, Calendar, Add, Reading and Menu within thumb reach
export default function BottomNav({ current, onHome, onCalendar, onReading, onAdd, onMenu }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-[35] bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="h-16 grid grid-cols-5 px-1.5">
        <Tab icon={Home} label="Home" active={current === 'home'} onClick={onHome} />
        <Tab icon={CalendarDays} label="Calendar" active={current === 'calendar'} onClick={onCalendar} />
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={onAdd}
            aria-label="Add"
            className="w-14 h-14 -mt-5 rounded-full bg-accent text-accent-fg hover:bg-accent-hover shadow-lg flex items-center justify-center touch-manipulation"
          >
            <Plus size={26} aria-hidden="true" />
          </button>
        </div>
        <Tab icon={BookOpen} label="Reading" active={current === 'reading'} onClick={onReading} />
        <Tab icon={Menu} label="Menu" active={current === 'menu'} onClick={onMenu} />
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Render it from `Layout.jsx`**

Replace the file's imports and component opening so it reads:

```jsx
import { Minimize2 } from 'lucide-react';
import { useSidebar } from '../../contexts/SidebarContext';
import { useFocusMode } from '../../contexts/FocusModeContext';
import { useEditingFocus } from '../../hooks/useEditingFocus';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';

// Which bottom-bar tab a view belongs to (notes, boards, review, tags and trash are reached from Menu)
function tabFor(selectedId) {
  if (selectedId == null) return 'home';
  if (selectedId === 'calendar') return 'calendar';
  if (selectedId === 'reading-list') return 'reading';
  return 'menu';
}

export default function Layout({ children, selectedId, onSelect, onOpenSettings, onQuickAdd }) {
  const { isOpen, isMobile, open: openMenu, close: closeMenu } = useSidebar();
  const { focusMode, exit: exitFocusMode } = useFocusMode();
  const typing = useEditingFocus();
  // Phones only; out of the way in full-screen views and while typing
  const showBottomNav = isMobile && !focusMode && selectedId !== 'glance' && !typing;
```

Change the `<main>` className to

```jsx
      <main className={`flex-1 flex flex-col min-h-0 overflow-auto ${!isMobile && !isOpen ? 'w-full' : ''} ${showBottomNav ? 'pb-[var(--bottom-nav-h)]' : ''}`}>
```

and directly after `</main>` add:

```jsx
      {showBottomNav && (
        <BottomNav
          current={isOpen ? 'menu' : tabFor(selectedId)}
          onHome={() => onSelect(null)}
          onCalendar={() => onSelect({ id: 'calendar', type: 'calendar', name: 'Calendar' })}
          onReading={() => onSelect({ id: 'reading-list', type: 'reading-list', name: 'Reading List' })}
          onAdd={onQuickAdd}
          onMenu={isOpen ? closeMenu : openMenu}
        />
      )}
```

- [ ] **Step 4: Header: no ☰ on phones, clear the status bar**

In `Header.jsx`, delete the `{/* Mobile menu toggle */} {isMobile && ( <button … aria-label="Open sidebar" …><Menu size={20} /></button> )}` block; remove `Menu` from the lucide import and `toggle`, `isMobile` from `useSidebar()` if now unused. Change the header's `h-12 sm:h-14` to `h-12 sm:h-14 box-content pt-[env(safe-area-inset-top)]`.

- [ ] **Step 5: Lift toasts above the bar on phones**

- `CalendarDialogs.jsx` (~94): `fixed inset-x-0 bottom-4 z-40` → `fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+1rem)] md:bottom-4 z-40`
- `NoteEditor.jsx` (~306): `fixed bottom-4 left-1/2` → `fixed bottom-[calc(var(--bottom-nav-h)+1rem)] md:bottom-4 left-1/2`

- [ ] **Step 6: Quick add state in `pages/Dashboard.jsx`**

Add `const [quickAddOpen, setQuickAddOpen] = useState(false);` with the other state, and pass `onQuickAdd={() => setQuickAddOpen(true)}` to `<Layout …>`. (Task 6 renders the sheet; until then the + does nothing.)

- [ ] **Step 7: Lint and check**

`npm run lint` → clean. Browser `375×812`:
- The bar shows on Dashboard with Home active; Calendar and Reading open their pages with their tab active; a note or board shows Menu active; the ☰ button is gone from the top bar.
- The last dashboard widget can be scrolled fully above the bar.
- Focusing the dashboard's Quick Capture field hides the bar; tapping elsewhere shows it again.
- Open the glance view (Calendar → Glance): no bar. Enter focus mode on a note: no bar.
- `834×1112` and `1280×800`: no bar, header unchanged.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useEditingFocus.js src/components/layout/BottomNav.jsx src/components/layout/Layout.jsx src/components/layout/Header.jsx src/pages/Dashboard.jsx src/components/calendar/CalendarDialogs.jsx src/components/notes/NoteEditor.jsx
git commit -m "feat(mobile): bottom tab bar on phones

Home, Calendar, Add, Reading and Menu along the bottom within thumb
reach, clearing the iPhone home bar; hidden while typing, in the glance
view and in focus mode. The top bar loses its menu button on phones.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Menu page (the sidebar's phone form)

**Files:**
- Modify: `src/components/layout/Sidebar.jsx`

- [ ] **Step 1: Full-screen panel above the bar**

In `sidebarClasses`, replace the phone branch

```js
    ? `fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 transform transition-transform duration-200 ${
        isVisible ? 'translate-x-0' : '-translate-x-full'
      }`
```

with

```js
    ? `fixed inset-0 z-30 w-full pb-[var(--bottom-nav-h)] bg-white dark:bg-neutral-900 transform transition-transform duration-200 ${
        isVisible ? 'translate-x-0' : '-translate-x-full'
      }`
```

Delete the phone backdrop (`{isMobile && isVisible && ( <div className="fixed inset-0 bg-black/20 dark:bg-black/60 z-40" onClick={close} aria-hidden="true" /> )}`).

- [ ] **Step 2: No duplicate quick links, bigger rows**

Wrap the Dashboard, Calendar and Reading List `<QuickLink …/>` elements in `{!isMobile && ( <> … </> )}` (Weekly Review and Tags stay). In `QuickLink`, change `'gap-2 px-3 py-2.5'` to `'gap-2 px-3 py-2.5 max-md:py-3'` and its label `className="text-sm"` to `className="text-sm max-md:text-base"`. In `TreeItem`, change the row's `py-1.5 mb-0.5` to `py-1.5 max-md:py-2.5 mb-0.5` and the name span's `text-sm truncate py-1.5` to `text-sm max-md:text-base truncate py-1.5`.

- [ ] **Step 3: Tiles instead of small links at the bottom**

Add above `export default function Sidebar`:

```jsx
// Large footer buttons in the phone menu
function MenuTile({ icon: Icon, label, pressed, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`flex flex-col items-center justify-center gap-1 min-h-16 px-1 rounded-xl text-xs text-center touch-manipulation transition-colors ${pressed
        ? 'bg-accent-soft text-accent-ink font-medium'
        : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'}`}
    >
      <Icon size={20} aria-hidden="true" />
      {label}
    </button>
  );
}
```

In the footer, keep the demo banner and the account button; replace the Settings/Trash row, the dark mode row and the e-reader button with:

```jsx
            {isMobile ? (
              <div className="grid grid-cols-4 gap-2">
                <MenuTile icon={Settings} label="Settings" onClick={() => { close(); onOpenSettings(); }} />
                <MenuTile icon={Trash2} label="Trash" onClick={() => onSelect({ id: 'trash', type: 'trash', name: 'Trash' })} />
                <MenuTile icon={darkChosen ? Moon : Sun} label={isDarkSuppressed ? 'Dark (paused)' : 'Dark mode'} pressed={darkChosen} onClick={toggleTheme} />
                <MenuTile icon={Monitor} label="E-reader" pressed={einkMode} onClick={toggleEinkMode} />
              </div>
            ) : (
              <>
                {/* the existing Settings/Trash row, dark mode row and e-reader button, unchanged */}
              </>
            )}
```

(move those three existing blocks, unchanged, into the fragment).

- [ ] **Step 4: Lint and check**

`npm run lint` → clean. Browser `375×812`: Menu tab opens a full-screen menu above the bar (bar still visible, Menu active); it lists Weekly Review, Tags, the notes/boards tree and the four tiles; rows ≥ 44 px (`__audit()` shows no under-32 items in the menu); tapping PhD Tasks opens the board and closes the menu; Settings tile opens Settings with the menu closed; Menu again closes it. Desktop `1280×800`: sidebar unchanged (quick links, small footer), minus Reset.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Sidebar.jsx
git commit -m "feat(mobile): full-screen Menu page from the bottom bar

On phones the sidebar opens full-screen above the bar, without the links
the bar already has, with larger rows and large Settings, Trash, Dark
mode and E-reader buttons instead of small text links.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Quick add sheet

**Files:**
- Create: `src/components/layout/QuickTaskModal.jsx`, `src/components/layout/QuickAdd.jsx`
- Modify: `src/components/calendar/EventModal.jsx` (`emptyForm`), `src/components/board/TaskModal.jsx` (export `TaskForm`), `src/pages/Dashboard.jsx`

**Interfaces:**
- Consumes: `useCalendar().addItem`, `useDashboard().addDeadline / addQuickCapture({ text, createdAt })`, `useReadingList().papers / collections / addPaper`, `useBoards(boardId).addTask(task)`, `EventModal({ isOpen, onClose, entry, defaults, sections, papers, onSave({ type, data }) })`, `AddPaperModal({ onClose, onSave, collections })` (calls `onClose` itself after saving), `TaskForm({ columnId, onSave, onClose })` (calls `onClose` itself).
- Produces: `QuickAdd({ open, onClose, sections, onCreateNote, onCreateBoard })`, `QuickTaskModal({ boards, onClose })`.

- [ ] **Step 1: Deadline preset and `TaskForm` export**

`EventModal.jsx` `emptyForm`: change `type: 'event',` to `type: d.type === 'deadline' ? 'deadline' : 'event',`.
`TaskModal.jsx`: change `function TaskForm(` to `export function TaskForm(`.

- [ ] **Step 2: Create `src/components/layout/QuickTaskModal.jsx`**

```jsx
import { useId, useState } from 'react';
import Modal from '../common/Modal';
import { TaskForm } from '../board/TaskModal';
import { useBoards } from '../../hooks/useBoards';

const LAST_BOARD_KEY = 'quick-add-board';

function readLastBoard() {
  try {
    return localStorage.getItem(LAST_BOARD_KEY);
  } catch {
    return null;
  }
}

function writeLastBoard(id) {
  try {
    localStorage.setItem(LAST_BOARD_KEY, id);
  } catch {
    /* storage unavailable: the choice isn't remembered */
  }
}

const firstColumnOf = (board) => [...(board?.columns || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];

// A new task from the phone's Add sheet: pick a board; the task goes into its first column
export default function QuickTaskModal({ boards, onClose }) {
  const id = useId();
  const [boardId, setBoardId] = useState(() => {
    const saved = readLastBoard();
    return boards.some((b) => b.id === saved) ? saved : boards[0]?.id;
  });
  const board = boards.find((b) => b.id === boardId);
  const { addTask } = useBoards(boardId);

  const handleSave = (task) => {
    writeLastBoard(boardId);
    addTask(task);
  };

  return (
    <Modal isOpen onClose={onClose} title="New task">
      <div className="mb-4">
        <label htmlFor={`${id}-board`} className="block mb-2 text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-widest font-medium">Board</label>
        <select
          id={`${id}-board`}
          value={boardId}
          onChange={(e) => setBoardId(e.target.value)}
          className="w-full px-3 py-2.5 text-base bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-neutral-300 dark:focus:border-neutral-600 text-neutral-900 dark:text-neutral-100"
        >
          {boards.map((b) => <option key={b.id} value={b.id}>{b.name || 'Untitled Board'}</option>)}
        </select>
      </div>
      <TaskForm key={boardId} columnId={firstColumnOf(board)?.id} onSave={handleSave} onClose={onClose} />
    </Modal>
  );
}
```

- [ ] **Step 3: Create `src/components/layout/QuickAdd.jsx`**

```jsx
import { useId, useState } from 'react';
import { BookOpen, CalendarDays, CheckSquare, ChevronRight, FileText, Flag, Lightbulb } from 'lucide-react';
import Modal from '../common/Modal';
import EventModal from '../calendar/EventModal';
import AddPaperModal from '../reading-list/AddPaperModal';
import QuickTaskModal from './QuickTaskModal';
import { useCalendar } from '../../hooks/useCalendar';
import { useDashboard } from '../../hooks/useDashboard';
import { useReadingList } from '../../hooks/useReadingList';
import { toDateKey } from '../../utils/date';

function AddTile({ icon: Icon, label, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start justify-between gap-3 min-h-24 p-3.5 text-left rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-900 dark:text-neutral-100 touch-manipulation"
    >
      <Icon size={24} className="text-neutral-600 dark:text-neutral-300" aria-hidden="true" />
      <span className="text-base font-medium">
        {label}
        <span className="block text-sm font-normal text-neutral-500 dark:text-neutral-400">{hint}</span>
      </span>
    </button>
  );
}

function AddRow({ icon: Icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} className="w-full min-h-[52px] flex items-center gap-3.5 px-4 text-left text-base text-neutral-900 dark:text-neutral-100 touch-manipulation">
      <Icon size={22} className="text-neutral-500 dark:text-neutral-400" aria-hidden="true" />
      <span className="flex-1">{label}</span>
      <ChevronRight size={18} className="text-neutral-300 dark:text-neutral-600" aria-hidden="true" />
    </button>
  );
}

function QuickAddFlow({ onClose, sections, onCreateNote, onCreateBoard }) {
  const ideaId = useId();
  const [step, setStep] = useState('sheet'); // sheet | idea | saved | event | deadline | task | paper
  const [idea, setIdea] = useState('');
  const { addItem } = useCalendar();
  const { addDeadline, addQuickCapture } = useDashboard();
  const { papers, collections, addPaper } = useReadingList();
  const boards = sections.filter((s) => s.type === 'board');
  const today = toDateKey(new Date());

  const saveIdea = async (e) => {
    e.preventDefault();
    const text = idea.trim();
    if (!text) return;
    await addQuickCapture({ text, createdAt: new Date().toISOString() });
    setStep('saved');
    setTimeout(onClose, 1200);
  };

  const saveEntry = async ({ type, data }) => {
    onClose();
    if (type === 'deadline') await addDeadline({ ...data, createdAt: new Date().toISOString() });
    else await addItem(data.recurrence ? { ...data, exdates: [] } : data);
  };

  if (step === 'event' || step === 'deadline') {
    return <EventModal isOpen onClose={onClose} entry={null} defaults={{ date: today, type: step }} sections={sections} papers={papers} onSave={saveEntry} />;
  }
  if (step === 'paper') return <AddPaperModal onClose={onClose} onSave={addPaper} collections={collections} />;
  if (step === 'task') return <QuickTaskModal boards={boards} onClose={onClose} />;

  return (
    <Modal isOpen onClose={onClose} title="Add">
      {step === 'saved' && (
        <p role="status" className="py-6 text-center text-base text-neutral-700 dark:text-neutral-200">Saved to Quick Capture</p>
      )}
      {step === 'idea' && (
        <form onSubmit={saveIdea} className="space-y-3">
          <label htmlFor={ideaId} className="sr-only">Idea</label>
          <input
            id={ideaId}
            autoFocus
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Capture an idea…"
            className="w-full px-3 py-3 text-base bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-neutral-300 dark:focus:border-neutral-600 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setStep('sheet')} className="px-4 py-2.5 text-base text-neutral-500 dark:text-neutral-400">Back</button>
            <button type="submit" disabled={!idea.trim()} className="px-4 py-2.5 text-base rounded-lg bg-accent text-accent-fg hover:bg-accent-hover disabled:opacity-50">Save</button>
          </div>
        </form>
      )}
      {step === 'sheet' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <AddTile icon={FileText} label="Note" hint="A blank note" onClick={() => { onClose(); onCreateNote(); }} />
            <AddTile
              icon={CheckSquare}
              label="Task"
              hint={boards.length ? 'To a board' : 'Create a board first'}
              onClick={() => {
                if (boards.length) setStep('task');
                else { onClose(); onCreateBoard(); }
              }}
            />
            <AddTile icon={CalendarDays} label="Event" hint="On your calendar" onClick={() => setStep('event')} />
            <AddTile icon={Lightbulb} label="Idea" hint="Quick capture" onClick={() => setStep('idea')} />
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-100 dark:divide-neutral-800 overflow-hidden">
            <AddRow icon={Flag} label="Deadline" onClick={() => setStep('deadline')} />
            <AddRow icon={BookOpen} label="Paper to read" onClick={() => setStep('paper')} />
          </div>
        </div>
      )}
    </Modal>
  );
}

// The phone's + button: things to add, each opening the existing form. Mounted
// only while in use, so its data hooks don't listen in the background.
export default function QuickAdd({ open, onClose, sections, onCreateNote, onCreateBoard }) {
  if (!open) return null;
  return <QuickAddFlow onClose={onClose} sections={sections} onCreateNote={onCreateNote} onCreateBoard={onCreateBoard} />;
}
```

- [ ] **Step 4: Render it from `pages/Dashboard.jsx`**

Add `import QuickAdd from '../components/layout/QuickAdd';` and, next to `<CommandPalette …/>`, add:

```jsx
      <QuickAdd
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        sections={sections}
        onCreateNote={() => handleCreateItem('note')}
        onCreateBoard={() => handleCreateItem('board')}
      />
```

- [ ] **Step 5: Lint, build and check**

`npm run lint`, `npm run build` → clean. Browser `375×812` (demo), tap + each time:
- Note → a new "Untitled Note" opens.
- Task → board picker (PhD Tasks) + task form; Create → the task is in PhD Tasks' first column; reopening Task preselects PhD Tasks.
- Event → event form, Event selected, today's date; Save → the event is on today in Calendar.
- Deadline → same form with Deadline selected; Save → shows in Dashboard Deadlines.
- Idea → one-line field; Save → "Saved to Quick Capture", sheet closes; it's in Quick Capture.
- Paper to read → Add paper form; Save → in Reading List.
- Escape or the close button closes the sheet at every step.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/QuickAdd.jsx src/components/layout/QuickTaskModal.jsx src/components/calendar/EventModal.jsx src/components/board/TaskModal.jsx src/pages/Dashboard.jsx
git commit -m "feat(mobile): quick add sheet from the + button

Note, Task (with a board picker that remembers the last board), Event,
Idea (saved straight to Quick Capture), Deadline and Paper to read, each
using the existing form.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Tap areas for small text controls

**Files (add `tap-area` at the start of the className of each element; none are absolutely positioned; check each before editing and skip any that is):**

| File (≈line) | Element |
| --- | --- |
| `src/components/layout/Header.jsx` (43) | breadcrumb buttons (`… truncate touch-manipulation py-1`) |
| `src/components/dashboard/widgets/TodoWidget.jsx` (152) | round checkbox button (`w-5 h-5 rounded-full border-2 …`) |
| `src/components/dashboard/widgets/TodoWidget.jsx` (190) | "+ Import from boards" (`text-sm ${linkButton}` → `tap-area text-sm ${linkButton}`) |
| `src/components/calendar/DayPanel.jsx` (161) | to-do round checkbox |
| `src/components/calendar/DayPanel.jsx` (314) | schedule "Add" button |
| `src/components/calendar/CalendarWidget.jsx` (36) | "Open calendar" |
| `src/components/calendar/CalendarView.jsx` (352, 368) | category filter chips; "Edit categories" |
| `src/components/reading-list/ReadingList.jsx` (288) | status filter tabs |
| `src/components/reading-list/PaperDetail.jsx` (646, 239, 771) | collection chips; Copy buttons; note tab buttons |
| `src/components/review/WeeklyReview.jsx` (367) | day heading buttons |
| `src/components/dashboard/widgets/PomodoroWidget.jsx` (37) | Start / Reset button class constant |

- [ ] **Step 1: Add `tap-area` to each element in the table** (template-literal classNames: put `tap-area ` at the start inside the backticks).

- [ ] **Step 2: Lint and check**

`npm run lint` → clean. Browser `375×812`, `__audit()` on Dashboard, Calendar (+ New event dialog), Reading List, a paper, a board, a note, Weekly Review, Tags, Trash, Settings, the Menu page and the Add sheet: `under32` lists only items inside the note editor's text, if any. Screenshots at 375 px of Dashboard, Calendar and a paper look the same as before apart from icon-button spacing.

- [ ] **Step 3: Commit**

```bash
git add -u src
git commit -m "fix(mobile): finger-sized tap areas for small text buttons and chips

Breadcrumbs, to-do tick boxes, category and status chips, Copy buttons,
note tabs, review day headings and the timer buttons get an invisible
44px tap area on phones; how they look is unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Full check, pull request and phone test

- [ ] **Step 1:** `npm run lint` and `npm run build` → clean.
- [ ] **Step 2:** `__audit()` on every screen at `360×780`, `375×812`, `390×844`: `overflowX` 0, `zoomFields` empty, `under32` empty (editor text excepted). Tab bar items and the + measure ≥ 44 px.
- [ ] **Step 3:** Tablet `834×1112` and desktop `1280×800`: no bottom bar, sidebar and header as before; board card ⋯ visible on touch (tablet) and on hover (desktop).
- [ ] **Step 4:** Mouse drags still work at desktop size (board card, calendar grip, sidebar item).
- [ ] **Step 5 (with the user's OK):** push `feature/mobile-ux`, open a pull request "Phone layout, stage 1: bottom bar, quick add, touch fixes" with the checks above and the 🤖 Generated with [Claude Code](https://claude.com/claude-code) line; wait for `build_and_preview` and `Deploy Preview`; give the user the preview link to try on the iPhone and Samsung (sideways drift in the add-event form, no zoom on fields, press-and-hold drag on the board, bar clears the home indicator).
- [ ] **Step 6 (when the user says so):** merge, confirm the deploy run on `main` succeeds, stop the dev server by port.
