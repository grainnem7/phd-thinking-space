import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { FileText, Kanban, Folder, BookOpen, ArrowRight, CalendarDays, ClipboardList, Tag, Trash2 } from 'lucide-react';

const groupClass =
  'px-2 pt-2 pb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-neutral-400 dark:[&_[cmdk-group-heading]]:text-neutral-500 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:font-medium';

const itemClass =
  'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer aria-selected:bg-neutral-100 dark:aria-selected:bg-neutral-800 text-neutral-700 dark:text-neutral-200';

const iconFor = (item) => {
  if (item.type === 'reading-list') return BookOpen;
  if (item.type === 'calendar') return CalendarDays;
  if (item.type === 'review') return ClipboardList;
  if (item.type === 'tags') return Tag;
  if (item.type === 'trash') return Trash2;
  if (item.type === 'note') return FileText;
  if (item.type === 'board') return Kanban;
  if (item.type === 'folder') return Folder;
  return FileText;
};

export default function CommandPalette({ open, ...props }) {
  if (!open) return null;
  return <PaletteDialog {...props} />;
}

function PaletteDialog({ onOpenChange, sections = [], actions = [], onNavigate }) {
  // Remember what had focus so it can be restored when the palette closes
  const [returnFocusTo] = useState(() => document.activeElement);

  // Esc to close (cmdk handles arrow nav + Enter natively)
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onOpenChange]);

  useEffect(() => () => {
    if (returnFocusTo && returnFocusTo !== document.body && returnFocusTo.isConnected) {
      // Deferred so actions that move focus (e.g. opening a note) win
      setTimeout(() => {
        if (document.activeElement === document.body && returnFocusTo.isConnected) {
          returnFocusTo.focus({ preventScroll: true });
        }
      }, 0);
    }
  }, [returnFocusTo]);

  const handleNavigate = (item) => {
    onNavigate?.(item);
    onOpenChange(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] sm:pt-[20vh] px-4 bg-neutral-900/30 dark:bg-black/60"
      onClick={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl dark:shadow-black/50 overflow-hidden"
      >
        <Command label="Command palette" className="flex flex-col">
          <Command.Input
            autoFocus
            placeholder="Search notes, boards and folders — or type an action…"
            aria-label="Search notes, boards and folders, or type an action"
            className="w-full px-4 py-3 text-base bg-transparent border-b border-neutral-100 dark:border-neutral-800 focus:outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-neutral-900 dark:text-neutral-100"
          />
          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-neutral-400 dark:text-neutral-500">
              No matches
            </Command.Empty>

            {actions.length > 0 && (
              <Command.Group heading="Actions" className={groupClass}>
                {actions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Command.Item
                      key={action.id}
                      value={`${action.id} ${action.label} ${action.keywords || ''}`}
                      onSelect={() => {
                        action.run?.();
                        onOpenChange(false);
                      }}
                      className={itemClass}
                    >
                      {Icon && <Icon size={16} aria-hidden="true" className="text-neutral-400 dark:text-neutral-500" />}
                      <span className="text-sm">{action.label}</span>
                      {action.shortcut && (
                        <kbd className="ml-auto text-xs font-sans text-neutral-400 dark:text-neutral-500 tabular-nums">
                          {action.shortcut}
                        </kbd>
                      )}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}

            {sections.length > 0 && (
              <Command.Group heading="Navigate" className={groupClass}>
                {sections.map((section) => {
                  const Icon = iconFor(section);
                  return (
                    <Command.Item
                      key={section.id}
                      value={`${section.id} ${section.name} ${section.type || ''}`}
                      onSelect={() => handleNavigate(section)}
                      className={itemClass}
                    >
                      <Icon size={16} aria-hidden="true" className="text-neutral-400 dark:text-neutral-500" />
                      <span className="text-sm truncate">{section.name}</span>
                      <ArrowRight size={12} aria-hidden="true" className="ml-auto text-neutral-300 dark:text-neutral-600" />
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}
          </Command.List>
          <div aria-hidden="true" className="px-4 py-2 border-t border-neutral-100 dark:border-neutral-800 text-xs text-neutral-400 dark:text-neutral-500 flex items-center justify-between">
            <span>↑↓ navigate · ↵ select · esc close</span>
            <span>Ctrl+K</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
