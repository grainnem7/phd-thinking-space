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
