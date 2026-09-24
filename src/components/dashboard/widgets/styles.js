// Shared class strings for dashboard widgets (light + dark)

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-600';

const fieldBase =
  'px-3 py-2.5 text-base text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-neutral-300 dark:focus:border-neutral-600 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 dark:[color-scheme:dark]';

/** Input on a white card */
export const inputClass = `w-full ${fieldBase} bg-neutral-50 dark:bg-neutral-800/60`;

/** Input sharing a row with another (e.g. start/end time) */
export const inlineInputClass = `flex-1 min-w-0 ${fieldBase} bg-neutral-50 dark:bg-neutral-800/60`;

/** Input inside a tinted edit row */
export const editInputClass = `w-full ${fieldBase} bg-white dark:bg-neutral-900`;

/** Tinted background for a row in edit mode */
export const editRowClass = 'bg-neutral-50 dark:bg-neutral-800/40';

/** Row hover for clickable/hoverable list rows */
export const rowHoverClass = 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40';

/** "Add" / "Save" text buttons in inline forms */
export const primaryTextButton =
  `flex-1 py-2 text-base text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100 disabled:text-neutral-300 dark:disabled:text-neutral-600 rounded-lg transition-colors ${focusRing}`;

/** "Cancel" text buttons in inline forms */
export const secondaryTextButton =
  `flex-1 py-2 text-base text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg transition-colors ${focusRing}`;

/** Quiet link-style buttons (empty states, "import from boards") */
export const linkButton =
  `text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded transition-colors ${focusRing}`;

/** Small icon buttons in list rows */
export const iconButton =
  `p-1.5 text-neutral-300 hover:text-neutral-600 dark:text-neutral-600 dark:hover:text-neutral-300 rounded transition-colors ${focusRing}`;

export const dangerIconButton =
  'p-1.5 text-neutral-300 hover:text-rose-600 dark:text-neutral-600 dark:hover:text-rose-400 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 dark:focus-visible:ring-rose-800';

/** Row actions: always visible on touch screens; on devices that can hover, revealed on hover or focus */
export const revealOnHover =
  '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100 focus-within:opacity-100 transition-opacity';

/** Settings/number field label */
export const labelClass = 'text-xs text-neutral-400 dark:text-neutral-500 mb-1.5 block';
