import { useId, useRef, useState } from 'react';
import { Tag } from 'lucide-react';
import TagChip from './TagChip';
import { cleanTags, normalizeTag } from '../../lib/tags';

const MAX_SUGGESTIONS = 8;

// Chip input for tags: Enter or comma adds, Backspace on an empty input removes
// the last tag, arrow keys pick from autocomplete suggestions.
export default function TagInput({
  tags,
  onChange,
  suggestions = [],
  placeholder = 'Add tag…',
  label = 'Tags',
  inputId,
  className = '',
  showIcon = true,
  navigable = true,
}) {
  const generatedId = useId();
  const id = inputId || generatedId;
  const listId = `${id}-list`;
  const current = cleanTags(tags);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const inputRef = useRef(null);

  const query = normalizeTag(draft);
  const options = suggestions
    .filter((s) => !current.includes(s) && (!query || s.includes(query)))
    .sort((a, b) => (query ? Number(!a.startsWith(query)) - Number(!b.startsWith(query)) : 0))
    .slice(0, MAX_SUGGESTIONS);
  const showList = open && options.length > 0;
  const activeIndex = highlight < options.length ? highlight : -1;

  const commit = (values) => {
    const next = cleanTags([...current, ...values]);
    if (next.length !== current.length) onChange(next);
    setDraft('');
    setHighlight(-1);
  };

  const remove = (tag) => onChange(current.filter((t) => t !== tag));

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown' && options.length) {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h + 1) % options.length);
    } else if (e.key === 'ArrowUp' && options.length) {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h <= 0 ? options.length - 1 : h - 1));
    } else if (e.key === 'Enter' || e.key === ',' || (e.key === 'Tab' && draft.trim())) {
      if (e.key === 'Enter' || e.key === ',' || showList) e.preventDefault();
      if (showList && activeIndex >= 0) commit([options[activeIndex]]);
      else if (draft.trim()) commit([draft]);
      else if (e.key === 'Tab') return;
    } else if (e.key === 'Backspace' && !draft && current.length) {
      e.preventDefault();
      remove(current[current.length - 1]);
    } else if (e.key === 'Escape' && (showList || draft)) {
      // Close the list (or clear the draft) without closing a surrounding dialog
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation?.();
      if (showList) setOpen(false);
      else setDraft('');
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div
        className="flex flex-wrap items-center gap-1.5 min-h-[28px]"
        onClick={() => inputRef.current?.focus()}
      >
        {showIcon && <Tag size={13} aria-hidden="true" className="text-neutral-300 dark:text-neutral-600 flex-shrink-0" />}
        {current.map((tag) => (
          <TagChip key={tag} tag={tag} size="xs" onRemove={remove} navigable={navigable} />
        ))}
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={draft}
          role="combobox"
          aria-label={label}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          autoComplete="off"
          placeholder={current.length ? '' : placeholder}
          onChange={(e) => {
            const value = e.target.value;
            if (value.includes(',')) {
              const parts = value.split(',');
              const rest = parts.pop();
              commit(parts);
              setDraft(rest);
            } else {
              setDraft(value);
            }
            setOpen(true);
            setHighlight(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            if (draft.trim()) commit([draft]);
          }}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-[6rem] py-0.5 text-sm bg-transparent text-neutral-700 dark:text-neutral-200 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 focus:outline-none"
        />
      </div>
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Tag suggestions"
          className="absolute left-0 top-full mt-1 z-30 w-56 max-h-64 overflow-y-auto py-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg dark:shadow-black/40"
        >
          {options.map((option, index) => (
            <li
              key={option}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              // Keep focus in the input so blur doesn't commit the draft first
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit([option])}
              onMouseEnter={() => setHighlight(index)}
              className={`px-3 py-1.5 text-sm cursor-pointer ${index === activeIndex
                ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
                : 'text-neutral-600 dark:text-neutral-300'}`}
            >
              <span className="text-neutral-400 dark:text-neutral-500">#</span>{option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
