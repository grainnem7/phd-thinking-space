import { useMemo, useState } from 'react';
import { FileText, Kanban, BookOpen, SquareCheck, Search, Pencil, Trash2, X, Tag } from 'lucide-react';
import { useTags } from '../../hooks/useTags';
import { useConfirm } from '../common/ConfirmDialog';
import Modal from '../common/Modal';
import TagChip from './TagChip';
import { normalizeTag } from '../../lib/tags';
import { normalizeText } from '../../lib/search';

const LABEL = 'text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-widest font-medium';

const GROUPS = [
  { kind: 'note', label: 'Notes', icon: FileText },
  { kind: 'board', label: 'Boards', icon: Kanban },
  { kind: 'task', label: 'Tasks', icon: SquareCheck },
  { kind: 'paper', label: 'Papers', icon: BookOpen },
];

function RenameTagModal({ tag, onClose, onRename }) {
  const [name, setName] = useState(tag);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const target = normalizeTag(name);

  const submit = async (e) => {
    e.preventDefault();
    if (!target || target === tag) return;
    setBusy(true);
    setError(null);
    try {
      await onRename(tag, target);
      onClose(target);
    } catch (err) {
      setError(err.message || "Couldn't rename the tag.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <label htmlFor="rename-tag" className={`block mb-1.5 ${LABEL}`}>New name</label>
      <input
        id="rename-tag"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        onFocus={(e) => e.target.select()}
        className="w-full px-3 py-2.5 text-base bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-neutral-300 dark:focus:border-neutral-600 text-neutral-900 dark:text-neutral-100"
      />
      <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
        {target && target !== tag ? <>Will become <strong className="font-medium">#{target}</strong> everywhere. If that tag already exists, the two are merged.</> : ' '}
      </p>
      {error && <p role="alert" className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      <div className="flex justify-end gap-2 mt-5">
        <button type="button" onClick={() => onClose()} className="px-4 py-2 text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || !target || target === tag}
          className="px-4 py-2 text-sm bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white rounded-lg disabled:opacity-50"
        >
          {busy ? 'Renaming…' : 'Rename'}
        </button>
      </div>
    </form>
  );
}

export default function TagsView({ initialTag, onSelect }) {
  const confirm = useConfirm();
  const { taggables, tags, renameTag, deleteTag } = useTags();
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(() => (initialTag ? [normalizeTag(initialTag)] : []));
  const [renaming, setRenaming] = useState(null);
  const [error, setError] = useState(null);

  const visibleTags = useMemo(() => {
    const q = normalizeText(filter.trim().replace(/^#/, ''));
    return q ? tags.filter((t) => normalizeText(t.tag).includes(q)) : tags;
  }, [tags, filter]);

  const matches = useMemo(() => {
    if (!selected.length) return [];
    return taggables
      .filter((item) => selected.every((tag) => item.tags.includes(tag)))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [taggables, selected]);

  const toggle = (tag) => {
    setSelected((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handleDelete = async (tag) => {
    const count = tags.find((t) => t.tag === tag)?.count || 0;
    const ok = await confirm({
      title: `Delete #${tag}?`,
      body: `The tag will be removed from ${count} ${count === 1 ? 'item' : 'items'}. The items themselves are kept.`,
      confirmLabel: 'Delete tag',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await deleteTag(tag);
      setSelected((prev) => prev.filter((t) => t !== tag));
    } catch (err) {
      setError(err.message || "Couldn't delete the tag.");
    }
  };

  const single = selected.length === 1 ? selected[0] : null;

  return (
    <main className="flex-1 min-w-0 overflow-y-auto bg-[var(--bg-page)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
        <header className="mb-6">
          <h1 className="font-serif text-2xl sm:text-3xl font-medium text-neutral-900 dark:text-neutral-100 tracking-tight">Tags</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            {tags.length === 0
              ? 'Nothing is tagged yet.'
              : `${tags.length} ${tags.length === 1 ? 'tag' : 'tags'} across notes, boards, tasks and papers. Select several to narrow down.`}
          </p>
        </header>

        {error && (
          <p role="alert" className="mb-4 px-3 py-2 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg">
            {error}
          </p>
        )}

        {tags.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4">
              <Tag size={22} aria-hidden="true" className="text-neutral-400 dark:text-neutral-500" />
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm">
              Add tags under a note&apos;s title, in a board&apos;s header, on a task or on a paper. They&apos;ll show up here.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
            {/* Tag list */}
            <section aria-labelledby="all-tags-heading" className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 self-start">
              <h2 id="all-tags-heading" className={`${LABEL} mb-3`}>All tags</h2>
              <div className="relative mb-3">
                <Search size={14} aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="search"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter tags…"
                  aria-label="Filter tags"
                  className="w-full pl-8 pr-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-neutral-300 dark:focus:border-neutral-600 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400"
                />
              </div>
              {visibleTags.length === 0 ? (
                <p className="text-sm text-neutral-400 dark:text-neutral-500 py-2">No tags match.</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5 max-h-[50vh] overflow-y-auto">
                  {visibleTags.map(({ tag, count }) => (
                    <li key={tag}>
                      <TagChip tag={tag} count={count} active={selected.includes(tag)} onClick={toggle} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Matches */}
            <section aria-live="polite" className="min-w-0">
              {selected.length === 0 ? (
                <p className="text-sm text-neutral-400 dark:text-neutral-500 py-4">Select a tag to see everything tagged with it.</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 mb-5">
                    {selected.map((tag) => (
                      <TagChip key={tag} tag={tag} active onClick={toggle} />
                    ))}
                    <button
                      type="button"
                      onClick={() => setSelected([])}
                      className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200"
                    >
                      <X size={12} aria-hidden="true" /> Clear
                    </button>
                    {single && (
                      <span className="ml-auto flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setRenaming(single)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                          <Pencil size={12} aria-hidden="true" /> Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(single)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-neutral-500 hover:text-rose-600 dark:text-neutral-400 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 size={12} aria-hidden="true" /> Delete
                        </button>
                      </span>
                    )}
                  </div>

                  {matches.length === 0 ? (
                    <p className="text-sm text-neutral-400 dark:text-neutral-500 py-4">Nothing has all of these tags.</p>
                  ) : (
                    <div className="space-y-6">
                      {GROUPS.map(({ kind, label, icon }) => {
                        const Icon = icon;
                        const items = matches.filter((m) => m.kind === kind);
                        if (!items.length) return null;
                        return (
                          <div key={kind}>
                            <h2 className={`${LABEL} mb-2`}>{label} <span className="tabular-nums">· {items.length}</span></h2>
                            <ul className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl divide-y divide-neutral-100 dark:divide-neutral-800">
                              {items.map((item) => (
                                <li key={item.id}>
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => onSelect?.(item.nav)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        onSelect?.(item.nav);
                                      }
                                    }}
                                    className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-600 first:rounded-t-xl last:rounded-b-xl"
                                  >
                                    <Icon size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-neutral-400 dark:text-neutral-500" />
                                    <span className="min-w-0 flex-1">
                                      <span className="block text-sm text-neutral-900 dark:text-neutral-100 truncate">{item.title}</span>
                                      {item.location && (
                                        <span className="block text-xs text-neutral-400 dark:text-neutral-500 truncate mt-0.5">{item.location}</span>
                                      )}
                                    </span>
                                    <span className="hidden sm:flex flex-wrap justify-end gap-1 max-w-[50%]">
                                      {item.tags.filter((t) => !selected.includes(t)).slice(0, 4).map((t) => (
                                        <TagChip key={t} tag={t} size="xs" onClick={toggle} />
                                      ))}
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </div>

      <Modal isOpen={Boolean(renaming)} onClose={() => setRenaming(null)} title={renaming ? `Rename #${renaming}` : 'Rename tag'} size="sm">
        {renaming && (
          <RenameTagModal
            tag={renaming}
            onRename={renameTag}
            onClose={(newTag) => {
              if (newTag) setSelected((prev) => [...new Set(prev.map((t) => (t === renaming ? newTag : t)))]);
              setRenaming(null);
            }}
          />
        )}
      </Modal>
    </main>
  );
}
