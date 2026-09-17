import { useState } from 'react';
import { Check, Plus, Trash2, Sparkles } from 'lucide-react';
import Modal from '../common/Modal';
import { useConfirm } from '../common/ConfirmDialog';
import { useCalendarCategories } from '../../hooks/useCalendarCategories';
import { CATEGORY_COLORS, SUGGESTED_CATEGORIES, colorVars, resolveColorId } from './categoryColors';

const INPUT_CLASS = 'w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-neutral-300 dark:focus:border-neutral-600 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-neutral-900 dark:text-neutral-100';

// Round colour swatches rendered with the theme-aware category shades
export function ColorSwatches({ value, onChange, label = 'Colour', size = 'md' }) {
  const current = resolveColorId(value);
  const dim = size === 'sm' ? 'w-6 h-6' : 'w-7 h-7';
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {CATEGORY_COLORS.map((color) => {
        const checked = current === color.id;
        return (
          <button
            key={color.id}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={color.label}
            title={color.label}
            onClick={() => onChange(color.id)}
            style={colorVars(color.id)}
            className={`cat-dot ${dim} rounded-full flex items-center justify-center transition-transform motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-900 ${checked
              ? 'ring-2 ring-offset-2 ring-neutral-700 dark:ring-neutral-300 ring-offset-white dark:ring-offset-neutral-900'
              : 'hover:scale-110 motion-reduce:hover:scale-100'}`}
          >
            {checked && <Check size={size === 'sm' ? 12 : 14} strokeWidth={3} className="text-white drop-shadow" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

// Category chips for choosing an event's category ("None" first)
export function CategoryPicker({ value, onChange, onManage }) {
  const { categories } = useCalendarCategories();
  const chip = (checked) => `inline-flex items-center gap-1.5 px-2.5 py-1 text-sm rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring ${checked
    ? 'border-neutral-400 dark:border-neutral-500 ring-1 ring-neutral-400 dark:ring-neutral-500'
    : 'border-transparent hover:border-neutral-300 dark:hover:border-neutral-600'}`;

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Category">
      <button type="button" role="radio" aria-checked={!value} onClick={() => onChange(null)} className={`${chip(!value)} text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800`}>
        None
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          role="radio"
          aria-checked={value === category.id}
          onClick={() => onChange(category.id)}
          style={colorVars(category.color)}
          className={`cat-chip ${chip(value === category.id)}`}
        >
          <span className="cat-dot w-2 h-2 rounded-full" style={colorVars(category.color)} aria-hidden="true" />
          {category.name}
        </button>
      ))}
      {onManage && (
        <button type="button" onClick={onManage} className="px-2 py-1 text-sm text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 underline-offset-2 hover:underline">
          {categories.length ? 'Edit categories…' : 'Add categories…'}
        </button>
      )}
    </div>
  );
}

function CategoryRow({ category, onUpdate, onDelete }) {
  const [name, setName] = useState(category.name);
  const [showColors, setShowColors] = useState(false);

  const commitName = () => {
    const trimmed = name.trim();
    if (!trimmed) setName(category.name);
    else if (trimmed !== category.name) onUpdate(category.id, { name: trimmed });
  };

  return (
    <li className="py-2.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowColors((v) => !v)}
          aria-expanded={showColors}
          aria-label={`Change colour of ${category.name}`}
          title="Change colour"
          style={colorVars(category.color)}
          className="cat-dot w-6 h-6 rounded-full flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-900"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
          aria-label="Category name"
          className={INPUT_CLASS}
        />
        <span className="cat-chip hidden sm:inline-block px-2 py-0.5 text-xs rounded flex-shrink-0" style={colorVars(category.color)} aria-hidden="true">
          Preview
        </span>
        <button
          type="button"
          onClick={() => onDelete(category)}
          aria-label={`Delete ${category.name}`}
          className="p-2 text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
      {showColors && (
        <div className="mt-2.5 ml-8">
          <ColorSwatches
            size="sm"
            label={`Colour for ${category.name}`}
            value={category.color}
            onChange={(color) => { onUpdate(category.id, { color }); setShowColors(false); }}
          />
        </div>
      )}
    </li>
  );
}

export function CategoryManager({ isOpen, onClose }) {
  const { categories, addCategories, updateCategory, deleteCategory } = useCalendarCategories();
  const confirm = useConfirm();
  const [draft, setDraft] = useState({ name: '', color: 'sky' });

  const existingNames = new Set(categories.map((c) => c.name.toLowerCase()));
  const missingSuggestions = SUGGESTED_CATEGORIES.filter((c) => !existingNames.has(c.name.toLowerCase()));

  const handleAdd = (e) => {
    e.preventDefault();
    const name = draft.name.trim();
    if (!name) return;
    addCategories([{ name, color: draft.color }]);
    // Next suggestion gets a different colour
    const used = new Set([...categories.map((c) => c.color), draft.color]);
    setDraft({ name: '', color: CATEGORY_COLORS.find((c) => !used.has(c.id))?.id || 'sky' });
  };

  const handleDelete = async (category) => {
    const ok = await confirm({
      title: `Delete "${category.name}"?`,
      body: 'Events in this category keep their details but lose the category colour.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) deleteCategory(category.id);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Calendar categories" size="md">
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">
        Colours adapt to your colour scheme and softness, so they always sit well together.
      </p>

      {categories.length > 0 ? (
        <ul className="divide-y divide-neutral-100 dark:divide-neutral-800 -mt-1">
          {categories.map((category) => (
            <CategoryRow key={category.id} category={category} onUpdate={updateCategory} onDelete={handleDelete} />
          ))}
        </ul>
      ) : (
        <p className="py-4 text-sm text-neutral-400 dark:text-neutral-500">No categories yet.</p>
      )}

      {missingSuggestions.length > 0 && (
        <button
          type="button"
          onClick={() => addCategories(missingSuggestions)}
          className="mt-2 inline-flex items-center gap-1.5 text-sm text-accent-ink hover:underline underline-offset-2"
        >
          <Sparkles size={14} aria-hidden="true" />
          Add suggested: {missingSuggestions.map((c) => c.name).join(', ')}
        </button>
      )}

      <form onSubmit={handleAdd} className="mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
        <label htmlFor="new-category" className="block text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">New category</label>
        <div className="flex gap-2">
          <input
            id="new-category"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="e.g. Fieldwork"
            className={INPUT_CLASS}
          />
          <button
            type="submit"
            disabled={!draft.name.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-accent text-accent-fg hover:bg-accent-hover disabled:opacity-40 flex-shrink-0"
          >
            <Plus size={16} aria-hidden="true" /> Add
          </button>
        </div>
        <ColorSwatches size="sm" label="New category colour" value={draft.color} onChange={(color) => setDraft((d) => ({ ...d, color }))} />
      </form>
    </Modal>
  );
}
