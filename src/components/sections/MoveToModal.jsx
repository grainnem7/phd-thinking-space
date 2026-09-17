import { useMemo, useState } from 'react';
import { Folder, Home, Search } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { useFirestore } from '../../hooks/useFirestore';
import { childrenOf, isFolderSection, locationLabel, subtreeIds } from '../../lib/sectionTree';

const TOP_LEVEL = '__top__';

// Choose a destination folder for a note, board or folder.
// Props: { isOpen, item, onClose }
export default function MoveToModal({ isOpen, item, onClose }) {
  return (
    <Modal isOpen={isOpen && Boolean(item)} onClose={onClose} title="Move to" size="sm">
      {item && <MovePicker key={item.id} item={item} onClose={onClose} />}
    </Modal>
  );
}

function MovePicker({ item, onClose }) {
  const { sections, moveSection } = useFirestore();
  const [search, setSearch] = useState('');
  const currentParentId = sections.find((s) => s.id === item.id)?.parentId ?? item.parentId ?? null;
  const [destination, setDestination] = useState(currentParentId ?? TOP_LEVEL);
  const [status, setStatus] = useState({ busy: false, error: null });

  // Folders in tree order with depth, excluding the item and everything inside it
  const folders = useMemo(() => {
    const excluded = new Set(subtreeIds(sections, item.id));
    const list = [];
    const visit = (parentId, depth, seen) => {
      for (const s of childrenOf(sections, parentId)) {
        if (excluded.has(s.id) || seen.has(s.id)) continue;
        seen.add(s.id);
        if (isFolderSection(s, sections)) {
          list.push({ id: s.id, name: s.name || 'Untitled', depth, path: locationLabel(sections, s.id) });
        }
        visit(s.id, depth + 1, seen);
      }
    };
    visit(null, 0, new Set());
    return list;
  }, [sections, item.id]);

  const q = search.trim().toLowerCase();
  const visibleFolders = q ? folders.filter((f) => f.path.toLowerCase().includes(q)) : folders;
  const showTopLevel = !q || 'top level'.includes(q);
  const destinationParentId = destination === TOP_LEVEL ? null : destination;
  const unchanged = destinationParentId === currentParentId;

  const handleMove = async () => {
    if (unchanged) return;
    setStatus({ busy: true, error: null });
    try {
      const moved = await moveSection(item.id, destinationParentId);
      if (moved === false) {
        setStatus({ busy: false, error: "That folder can't hold this item." });
        return;
      }
      onClose();
    } catch (err) {
      console.error('Move failed:', err);
      setStatus({ busy: false, error: "Couldn't move the item. Check your connection and try again." });
    }
  };

  const option = (value, label, { icon, depth = 0, hint } = {}) => {
    const Icon = icon;
    const checked = destination === value;
    return (
      <li key={value}>
        <label
          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-neutral-300 dark:has-[:focus-visible]:ring-neutral-600 ${
            checked
              ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium'
              : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
          }`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          <input
            type="radio"
            name="move-destination"
            value={value}
            checked={checked}
            onChange={() => setDestination(value)}
            className="sr-only"
          />
          <Icon size={15} aria-hidden="true" className="flex-shrink-0 text-neutral-400 dark:text-neutral-500" />
          <span className="truncate">{label}</span>
          {hint && <span className="ml-auto text-xs text-neutral-400 dark:text-neutral-500 flex-shrink-0">{hint}</span>}
        </label>
      </li>
    );
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleMove(); }}>
      <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-1 truncate">
        Moving <span className="font-medium text-neutral-900 dark:text-neutral-100">“{item.name || 'Untitled'}”</span>
      </p>
      <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-4 truncate">
        Currently in: {locationLabel(sections, currentParentId)}
      </p>

      <div className="relative mb-3">
        <Search size={15} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search folders…"
          aria-label="Search folders"
          autoFocus
          className="w-full pl-9 pr-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
        />
      </div>

      <fieldset>
        <legend className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-widest font-medium mb-2">Destination</legend>
        <ul className="max-h-64 overflow-y-auto space-y-0.5 -mx-1 px-1">
          {showTopLevel && option(TOP_LEVEL, 'Top level', { icon: Home, hint: currentParentId === null ? 'Current' : undefined })}
          {visibleFolders.map((f) => option(f.id, f.name, {
            icon: Folder,
            depth: q ? 0 : f.depth + 1,
            hint: f.id === currentParentId ? 'Current' : (q && f.path !== f.name ? f.path : undefined),
          }))}
          {!showTopLevel && visibleFolders.length === 0 && (
            <li className="px-3 py-4 text-sm text-neutral-400 dark:text-neutral-500" role="status">No folders match “{search.trim()}”</li>
          )}
        </ul>
      </fieldset>

      {status.error && <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-400">{status.error}</p>}

      <div className="flex justify-end gap-2 mt-5">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={unchanged || status.busy}>{status.busy ? 'Moving…' : 'Move'}</Button>
      </div>
    </form>
  );
}
