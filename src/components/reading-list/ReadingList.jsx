import { useState, useMemo } from 'react';
import { Search as SearchIcon, X, Plus, Settings, Download, CheckSquare, Trash2, BookOpen } from 'lucide-react';
import { useReadingList } from '../../hooks/useReadingList';
import { useConfirm } from '../common/ConfirmDialog';
import { generateBibTeX } from '../../utils/paperMetadata';
import PaperDetail from './PaperDetail';
import AddPaperModal from './AddPaperModal';
import InlineError from './InlineError';

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

const STATUS_CONFIG = {
  'reading': { label: 'READING', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  'to-read': { label: 'TO READ', color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300' },
  'read': { label: 'READ', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'to-read', label: 'To Read' },
  { id: 'reading', label: 'Reading' },
  { id: 'read', label: 'Read' },
];

const PRIMARY_BUTTON = 'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white';
const INPUT = 'border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-200 dark:focus:ring-neutral-700';

function iconButtonClass(active) {
  return `p-2 rounded-lg transition-colors ${active
    ? 'bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
    : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300'}`;
}

// Papers still waiting for a server timestamp sort as newest
function createdMillis(value) {
  if (!value) return Date.now();
  if (typeof value.toMillis === 'function') return value.toMillis();
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

export default function ReadingList({ initialPaperId = null, onOpenNote }) {
  const {
    papers,
    collections,
    isLoading,
    error: loadError,
    addPaper,
    updatePaper,
    setPaperCollection,
    deletePaper,
    addCollection,
    deleteCollection,
    addTab,
    renameTab,
    deleteTab,
    updateTabContent,
    appendToTab,
    getCounts,
  } = useReadingList();

  const confirm = useConfirm();
  const [selectedPaperId, setSelectedPaperId] = useState(initialPaperId);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeCollection, setActiveCollection] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showCollections, setShowCollections] = useState(false);
  const [showAddPaper, setShowAddPaper] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (action, message) => {
    try {
      await action();
      return true;
    } catch (e) {
      console.error(message, e);
      setActionError(message);
      return false;
    }
  };

  const handleExportBibliography = (papersToExport) => {
    if (!papersToExport.length) return;
    const bib = papersToExport.map(generateBibTeX).join('\n\n');
    const blob = new Blob([bib], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const date = new Date().toISOString().slice(0, 10);
    link.download = `bibliography-${date}.bib`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Selection helpers
  const toggleSelection = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const enterSelectionMode = () => {
    setSelectionMode(true);
    setSelectedPaperId(null);
  };

  const selectedPapers = papers.filter((p) => selectedIds.has(p.id));

  // Filter papers by status, collection, and search
  const filteredPapers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = papers.filter((p) => (
      (activeFilter === 'all' || (p.status || 'to-read') === activeFilter)
      && (activeCollection === 'all' || p.collections?.includes(activeCollection))
      && (!query
        || p.title?.toLowerCase().includes(query)
        || p.authors?.toLowerCase().includes(query)
        || p.summary?.toLowerCase().includes(query))
    ));

    // Sort a copy: starred first, then by priority, then newest
    return [...filtered].sort((a, b) => {
      if (a.starred && !b.starred) return -1;
      if (!a.starred && b.starred) return 1;
      const priorityDiff = (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
      if (priorityDiff !== 0) return priorityDiff;
      return createdMillis(b.createdAt) - createdMillis(a.createdAt);
    });
  }, [papers, activeFilter, activeCollection, searchQuery]);

  const selectAllVisible = () => {
    setSelectedIds(new Set(filteredPapers.map((p) => p.id)));
  };

  // Bulk operations
  const runBulk = async (action, message) => {
    setBusy(true);
    const ok = await run(action, message);
    setBusy(false);
    if (ok) exitSelectionMode();
  };

  const handleBulkSetStatus = (status) => runBulk(
    () => Promise.all(selectedPapers.map((paper) => updatePaper(paper.id, { status }))),
    "Couldn't update every selected paper.",
  );

  const handleBulkAddToCollection = (collId) => runBulk(
    () => Promise.all(selectedPapers
      .filter((paper) => !(paper.collections || []).includes(collId))
      .map((paper) => setPaperCollection(paper.id, collId, true))),
    "Couldn't add every selected paper to the collection.",
  );

  const handleBulkDelete = async () => {
    const count = selectedPapers.length;
    const ok = await confirm({
      title: `Move ${count} ${count === 1 ? 'paper' : 'papers'} to Trash?`,
      body: `You can restore ${count === 1 ? 'it' : 'them'} from Trash for 30 days. Attached files are kept until ${count === 1 ? 'it is' : 'they are'} deleted forever.`,
      confirmLabel: 'Move to Trash',
      danger: false,
    });
    if (!ok) return;
    await runBulk(
      () => Promise.all(selectedPapers.map((paper) => deletePaper(paper.id))),
      "Couldn't delete every selected paper.",
    );
  };

  const handleDeleteCollection = async (col) => {
    const paperCount = papers.filter(p => p.collections?.includes(col.id)).length;
    const ok = await confirm({
      title: `Delete collection "${col.name}"?`,
      body: paperCount > 0
        ? `${paperCount} ${paperCount === 1 ? 'paper has' : 'papers have'} this collection label. The papers will not be deleted, but they will lose this label. This cannot be undone.`
        : 'This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) {
      if (activeCollection === col.id) setActiveCollection('all');
      run(() => deleteCollection(col.id), `Couldn't delete the collection "${col.name}".`);
    }
  };

  const counts = getCounts();

  const handleAddCollection = async () => {
    const name = newCollectionName.trim();
    if (!name) return;
    if (await run(() => addCollection(name), "Couldn't create the collection.")) {
      setNewCollectionName('');
    }
  };

  const clearFilters = () => {
    setActiveFilter('all');
    setActiveCollection('all');
    setSearchQuery('');
  };

  // Get collection name by ID
  const getCollectionName = (collectionId) => {
    const col = collections.find(c => c.id === collectionId);
    return col?.name || null;
  };

  const selectedPaper = papers.find(p => p.id === selectedPaperId);

  if (isLoading) {
    return (
      <div className="flex-1 bg-[#fafafa] dark:bg-neutral-950 min-h-0" role="status" aria-label="Loading reading list">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
          <div className="h-10 w-56 rounded-lg bg-neutral-200/70 dark:bg-neutral-800 animate-pulse mb-8" />
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show paper detail view
  if (selectedPaper) {
    const id = selectedPaper.id;
    return (
      <PaperDetail
        key={id}
        paper={selectedPaper}
        collections={collections}
        onBack={() => setSelectedPaperId(null)}
        onUpdate={(updates) => updatePaper(id, updates)}
        onSetCollection={(collectionId, included) => setPaperCollection(id, collectionId, included)}
        onAddTab={(tabId, name) => addTab(id, name, tabId)}
        onRenameTab={(tabId, name) => renameTab(id, tabId, name)}
        onDeleteTab={(tabId) => deleteTab(id, tabId)}
        onUpdateTabContent={(tabId, content) => updateTabContent(id, tabId, content)}
        onAppendToTab={(tabName, blocks) => appendToTab(id, tabName, blocks)}
        onOpenNote={onOpenNote}
        onDelete={() => {
          setSelectedPaperId(null);
          run(() => deletePaper(id), "Couldn't delete the paper.");
        }}
      />
    );
  }

  const hasFilters = activeFilter !== 'all' || activeCollection !== 'all' || searchQuery.trim() !== '';

  // List view
  return (
    <div className="flex-1 bg-[#fafafa] dark:bg-neutral-950 min-h-0 min-w-0 overflow-x-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {/* Header */}
        <header className="mb-6 sm:mb-8">
          <h1 className="font-serif text-4xl sm:text-5xl tracking-tight text-neutral-900 dark:text-neutral-100 mb-6">
            Reading List
          </h1>

          {/* Filter tabs: scroll sideways on narrow screens instead of wrapping */}
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-5 sm:gap-6 text-base pb-3 sm:pb-4 w-max" role="group" aria-label="Filter by status">
              {FILTERS.map((filter) => {
                const active = activeFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setActiveFilter(filter.id)}
                    aria-pressed={active}
                    className={`font-medium whitespace-nowrap transition-colors ${active
                      ? 'text-neutral-900 dark:text-neutral-100'
                      : 'text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300'}`}
                  >
                    {filter.label}
                    <span className="text-neutral-400 dark:text-neutral-500 ml-1.5 tabular-nums">{counts[filter.id]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        <InlineError
          message={actionError || (loadError && 'Couldn’t load your reading list. Check your connection and reload the page.')}
          onDismiss={actionError ? () => setActionError(null) : undefined}
          className="mb-6"
        />

        {/* Action bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setShowAddPaper(true)}
              className={PRIMARY_BUTTON}
            >
              <Plus size={16} aria-hidden="true" />
              Add Paper
            </button>

            <button
              type="button"
              onClick={() => { setShowSearch(!showSearch); setShowCollections(false); }}
              className={iconButtonClass(showSearch)}
              aria-label="Search papers"
              aria-expanded={showSearch}
              title="Search"
            >
              <SearchIcon size={18} />
            </button>

            <button
              type="button"
              onClick={() => { setShowCollections(!showCollections); setShowSearch(false); }}
              className={iconButtonClass(showCollections)}
              aria-label="Manage collections"
              aria-expanded={showCollections}
              title="Manage Collections"
            >
              <Settings size={18} />
            </button>

            <button
              type="button"
              onClick={() => handleExportBibliography(filteredPapers)}
              disabled={filteredPapers.length === 0}
              className={`${iconButtonClass(false)} disabled:opacity-40 disabled:cursor-not-allowed`}
              aria-label={`Export ${filteredPapers.length} papers as BibTeX`}
              title={`Export ${filteredPapers.length} papers as BibTeX (.bib)`}
            >
              <Download size={18} />
            </button>

            <button
              type="button"
              onClick={() => (selectionMode ? exitSelectionMode() : enterSelectionMode())}
              className={iconButtonClass(selectionMode)}
              aria-label={selectionMode ? 'Exit selection mode' : 'Select multiple papers'}
              aria-pressed={selectionMode}
              title={selectionMode ? 'Exit selection mode' : 'Select multiple'}
            >
              <CheckSquare size={18} />
            </button>
          </div>

          {/* Collection filter dropdown */}
          {collections.length > 0 && (
            <label className="flex items-center gap-2 min-w-0">
              <span className="text-sm text-neutral-400 dark:text-neutral-500">Collection</span>
              <select
                value={activeCollection}
                onChange={(e) => setActiveCollection(e.target.value)}
                className={`text-sm px-3 py-1.5 max-w-[12rem] ${INPUT}`}
              >
                <option value="all">All</option>
                {collections.map(col => (
                  <option key={col.id} value={col.id}>{col.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {/* Search input */}
        {showSearch && (
          <div className="mb-6 relative">
            <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setSearchQuery(''); setShowSearch(false); }
              }}
              placeholder="Search by title, author, or summary..."
              aria-label="Search papers by title, author, or summary"
              autoFocus
              className={`w-full pl-11 pr-10 py-3 text-base ${INPUT}`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        {/* Collections manager */}
        {showCollections && (
          <div className="mb-6 p-4 sm:p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
            <h2 className="text-xs uppercase tracking-widest text-neutral-400 dark:text-neutral-500 mb-4">Manage Collections</h2>
            <div className="flex items-center gap-2 sm:gap-3 mb-4">
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="New collection name..."
                aria-label="New collection name"
                className={`flex-1 min-w-0 px-4 py-2 text-sm ${INPUT}`}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCollection()}
              />
              <button
                type="button"
                onClick={handleAddCollection}
                disabled={!newCollectionName.trim()}
                className={`${PRIMARY_BUTTON} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Add
              </button>
            </div>
            {collections.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {collections.map(col => (
                  <li key={col.id} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-full text-sm max-w-full">
                    <span className="text-neutral-700 dark:text-neutral-200 truncate">{col.name}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteCollection(col)}
                      aria-label={`Delete ${col.name} collection`}
                      title={`Delete "${col.name}"`}
                      className="p-0.5 rounded-full text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-400 dark:text-neutral-500">No collections yet. Create one to organize your papers.</p>
            )}
          </div>
        )}

        {/* Bulk actions toolbar */}
        {selectionMode && (
          <div className="sticky top-0 z-10 mb-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap shadow-sm" aria-busy={busy}>
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200" aria-live="polite">
              {selectedIds.size} selected
            </span>
            {selectedIds.size === 0 ? (
              <button
                type="button"
                onClick={selectAllVisible}
                disabled={filteredPapers.length === 0}
                className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition-colors disabled:opacity-50"
              >
                Select all ({filteredPapers.length})
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition-colors"
                >
                  Clear
                </button>
                <span className="text-neutral-300 dark:text-neutral-600" aria-hidden="true">|</span>
                <button
                  type="button"
                  onClick={() => handleExportBibliography(selectedPapers)}
                  className="text-sm text-neutral-700 hover:text-neutral-900 dark:text-neutral-200 dark:hover:text-neutral-100 transition-colors flex items-center gap-1"
                >
                  <Download size={14} aria-hidden="true" /> Export .bib
                </button>
                <select
                  onChange={(e) => { if (e.target.value) handleBulkSetStatus(e.target.value); e.target.value = ''; }}
                  defaultValue=""
                  disabled={busy}
                  aria-label="Set status for selected papers"
                  className="text-sm bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1 cursor-pointer focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500"
                >
                  <option value="" disabled>Set status…</option>
                  <option value="to-read">To read</option>
                  <option value="reading">Reading</option>
                  <option value="read">Read</option>
                </select>
                {collections.length > 0 && (
                  <select
                    onChange={(e) => { if (e.target.value) handleBulkAddToCollection(e.target.value); e.target.value = ''; }}
                    defaultValue=""
                    disabled={busy}
                    aria-label="Add selected papers to a collection"
                    className="text-sm max-w-[12rem] bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1 cursor-pointer focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500"
                  >
                    <option value="" disabled>Add to collection…</option>
                    {collections.map((col) => (
                      <option key={col.id} value={col.id}>{col.name}</option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={busy}
                  className="text-sm text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 transition-colors flex items-center gap-1 ml-auto disabled:opacity-50"
                >
                  <Trash2 size={14} aria-hidden="true" /> Delete
                </button>
              </>
            )}
          </div>
        )}

        {/* Papers list */}
        {filteredPapers.length > 0 && (
          <ul className="space-y-3 sm:space-y-4">
            {filteredPapers.map(paper => (
              <li key={paper.id}>
                <PaperCard
                  paper={paper}
                  getCollectionName={getCollectionName}
                  selectionMode={selectionMode}
                  isSelected={selectedIds.has(paper.id)}
                  onClick={() => {
                    if (selectionMode) toggleSelection(paper.id);
                    else setSelectedPaperId(paper.id);
                  }}
                />
              </li>
            ))}
          </ul>
        )}

        {/* Empty states */}
        {filteredPapers.length === 0 && papers.length > 0 && (
          <div className="text-center py-16 px-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
            <p className="text-neutral-500 dark:text-neutral-400 text-lg">No papers match your filters</p>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100 underline underline-offset-2 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {papers.length === 0 && !loadError && (
          <div className="text-center py-16 px-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
            <BookOpen size={28} className="mx-auto mb-4 text-neutral-300 dark:text-neutral-600" aria-hidden="true" />
            <p className="font-serif text-2xl text-neutral-900 dark:text-neutral-100 mb-2">No papers yet</p>
            <p className="text-neutral-500 dark:text-neutral-400 mb-6">Add a paper by DOI, from a PDF, or by hand.</p>
            <button
              type="button"
              onClick={() => setShowAddPaper(true)}
              className={`${PRIMARY_BUTTON} mx-auto px-6 py-3`}
            >
              <Plus size={16} aria-hidden="true" />
              Add your first paper
            </button>
          </div>
        )}
      </div>

      {showAddPaper && (
        <AddPaperModal
          isOpen
          onClose={() => setShowAddPaper(false)}
          onSave={addPaper}
          collections={collections}
        />
      )}
    </div>
  );
}

// Paper card component
function PaperCard({ paper, getCollectionName, onClick, selectionMode = false, isSelected = false }) {
  const status = STATUS_CONFIG[paper.status] ? paper.status : 'to-read';
  const statusConfig = STATUS_CONFIG[status];
  const collectionNames = (paper.collections || []).map(getCollectionName).filter(Boolean);

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      aria-pressed={selectionMode ? isSelected : undefined}
      className={`reading-list-paper-row bg-white dark:bg-neutral-900 border rounded-xl p-4 sm:p-6 cursor-pointer shadow-sm hover:shadow transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 ${
        selectionMode && isSelected
          ? 'border-neutral-900 dark:border-neutral-100 ring-2 ring-neutral-900 dark:ring-neutral-100'
          : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-5">
        <div className="flex items-center gap-3 sm:mt-1 shrink-0">
          {/* Selection checkbox */}
          {selectionMode && (
            <div
              aria-hidden="true"
              className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                isSelected
                  ? 'bg-neutral-900 dark:bg-neutral-100 border-neutral-900 dark:border-neutral-100'
                  : 'border-neutral-300 dark:border-neutral-600'
              }`}
            >
              {isSelected && (
                <svg viewBox="0 0 16 16" className="w-3 h-3 text-white dark:text-neutral-900" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M3 8l3 3 7-7" />
                </svg>
              )}
            </div>
          )}

          {/* Status badge */}
          <span className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded text-xs font-bold tracking-wide whitespace-nowrap ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-serif text-xl sm:text-2xl text-neutral-900 dark:text-neutral-100 leading-snug mb-2 break-words">
            {paper.starred && (
              <span className="text-amber-600 dark:text-amber-400 mr-2" aria-label="Starred">★</span>
            )}
            {paper.title}
          </h3>

          {(paper.authors || paper.year) && (
            <p className="text-sm sm:text-base text-neutral-500 dark:text-neutral-400 mb-3 break-words">
              {paper.authors}
              {paper.authors && paper.year && ` (${paper.year})`}
              {!paper.authors && paper.year && paper.year}
            </p>
          )}

          {paper.summary && (
            <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-300 italic mb-3 line-clamp-2 break-words">
              &ldquo;{paper.summary}&rdquo;
            </p>
          )}

          {collectionNames.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {collectionNames.map((name, i) => (
                <span key={`${name}-${i}`} className="text-sm text-neutral-400 dark:text-neutral-500">
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
