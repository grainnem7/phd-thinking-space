import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Command } from 'cmdk';
import { FileText, Kanban, Folder, BookOpen, ArrowRight, CalendarDays, ClipboardList, Tag, Trash2, SquareCheck } from 'lucide-react';
import { useReadingList } from '../../hooks/useReadingList';
import { useOpenTagListener } from '../../hooks/useTags';
import { buildSearchIndex, highlight, normalizeText, queryWords, search } from '../../lib/search';
import { collectTaggables, countTags } from '../../lib/tags';

const groupClass =
  'px-2 pt-2 pb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-neutral-400 dark:[&_[cmdk-group-heading]]:text-neutral-500 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:font-medium';

const itemClass =
  'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer aria-selected:bg-neutral-100 dark:aria-selected:bg-neutral-800 text-neutral-700 dark:text-neutral-200';

const RESULT_LIMIT = 30;

const iconFor = (item) => {
  const type = item.kind || item.type;
  if (type === 'reading-list' || type === 'paper') return BookOpen;
  if (type === 'calendar') return CalendarDays;
  if (type === 'review') return ClipboardList;
  if (type === 'tags') return Tag;
  if (type === 'trash') return Trash2;
  if (type === 'note') return FileText;
  if (type === 'board') return Kanban;
  if (type === 'task') return SquareCheck;
  if (type === 'folder') return Folder;
  return FileText;
};

const KIND_LABEL = { note: 'Note', board: 'Board', folder: 'Folder', task: 'Task', paper: 'Paper' };

function Highlighted({ text, words }) {
  return highlight(text, words).map((part, i) => (
    part.match
      ? <mark key={i} className="bg-amber-100 dark:bg-amber-500/25 text-inherit rounded-sm px-px">{part.text}</mark>
      : <span key={i}>{part.text}</span>
  ));
}

export default function CommandPalette({ open, onNavigate, ...props }) {
  // Tag chips anywhere in the app ask for the Tags view through a window event;
  // the palette is always mounted and already navigates, so it listens here.
  useOpenTagListener(onNavigate);
  if (!open) return null;
  return <PaletteDialog onNavigate={onNavigate} {...props} />;
}

function PaletteDialog({ onOpenChange, sections = [], actions = [], onNavigate }) {
  // Remember what had focus so it can be restored when the palette closes
  const [returnFocusTo] = useState(() => document.activeElement);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const { papers } = useReadingList();

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

  const index = useMemo(() => buildSearchIndex(sections, papers), [sections, papers]);
  const tagCounts = useMemo(() => countTags(collectTaggables(sections, papers)), [sections, papers]);

  const trimmed = deferredQuery.trim();
  const words = useMemo(() => queryWords(trimmed), [trimmed]);
  const results = useMemo(() => (trimmed ? search(index, trimmed, { limit: RESULT_LIMIT }) : []), [index, trimmed]);

  const matchingActions = useMemo(() => {
    if (!words.length) return actions;
    return actions.filter((action) => {
      const haystack = normalizeText(`${action.label} ${action.keywords || ''}`);
      return words.every((w) => haystack.includes(w));
    });
  }, [actions, words]);

  // "#meth" lists matching tags
  const matchingTags = useMemo(() => {
    if (!trimmed.startsWith('#')) return [];
    const q = normalizeText(trimmed.slice(1));
    return tagCounts.filter((t) => t.tag.includes(q)).slice(0, 8);
  }, [tagCounts, trimmed]);

  const handleNavigate = (item) => {
    onNavigate?.(item);
    onOpenChange(false);
  };

  const hasResults = matchingActions.length > 0 || results.length > 0 || matchingTags.length > 0 || (!trimmed && sections.length > 0);

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
        <Command label="Command palette" shouldFilter={false} className="flex flex-col">
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Search everything — notes, tasks, papers — or type an action…"
            aria-label="Search notes, boards, tasks and papers, or type an action"
            className="w-full px-4 py-3 text-base bg-transparent border-b border-neutral-100 dark:border-neutral-800 focus:outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-neutral-900 dark:text-neutral-100"
          />
          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            {!hasResults && (
              <div className="py-8 text-center text-sm text-neutral-400 dark:text-neutral-500">
                No matches
              </div>
            )}

            {matchingTags.length > 0 && (
              <Command.Group heading="Tags" className={groupClass}>
                {matchingTags.map(({ tag, count }) => (
                  <Command.Item
                    key={tag}
                    value={`tag:${tag}`}
                    onSelect={() => handleNavigate({ id: 'tags', type: 'tags', name: 'Tags', tag })}
                    className={itemClass}
                  >
                    <Tag size={16} aria-hidden="true" className="text-neutral-400 dark:text-neutral-500" />
                    <span className="text-sm truncate">#{tag}</span>
                    <span className="ml-auto text-xs tabular-nums text-neutral-400 dark:text-neutral-500">{count}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {results.length > 0 && (
              <Command.Group heading="Results" className={groupClass}>
                {results.map((result) => {
                  const Icon = iconFor(result);
                  return (
                    <Command.Item
                      key={result.key}
                      value={`result:${result.key}`}
                      onSelect={() => handleNavigate(result.nav)}
                      className={`${itemClass} items-start`}
                    >
                      <Icon size={16} aria-label={KIND_LABEL[result.kind]} className="mt-0.5 flex-shrink-0 text-neutral-400 dark:text-neutral-500" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2 min-w-0">
                          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                            <Highlighted text={result.title} words={words} />
                          </span>
                          {result.location && (
                            <span className="text-xs text-neutral-400 dark:text-neutral-500 truncate flex-shrink min-w-0">
                              {result.location}
                            </span>
                          )}
                        </span>
                        {result.snippet && (
                          <span className="block text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-2 break-words">
                            <Highlighted text={result.snippet} words={words} />
                          </span>
                        )}
                      </span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}

            {matchingActions.length > 0 && (
              <Command.Group heading="Actions" className={groupClass}>
                {matchingActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Command.Item
                      key={action.id}
                      value={`action:${action.id}`}
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

            {!trimmed && sections.length > 0 && (
              <Command.Group heading="Navigate" className={groupClass}>
                {sections.map((section) => {
                  const Icon = iconFor(section);
                  return (
                    <Command.Item
                      key={section.id}
                      value={`section:${section.id}`}
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
            <span>↑↓ navigate · ↵ select · esc close · #tag</span>
            <span>Ctrl+K</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
