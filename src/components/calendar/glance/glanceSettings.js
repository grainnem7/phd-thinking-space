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
