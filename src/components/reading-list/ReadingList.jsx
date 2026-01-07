import { useState, useMemo } from 'react';
import { Search as SearchIcon, X, Plus, Settings } from 'lucide-react';
import { useReadingList } from '../../hooks/useReadingList';
import PaperDetail from './PaperDetail';
import AddPaperModal from './AddPaperModal';

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2, null: 3 };

const STATUS_CONFIG = {
  'reading': { label: 'READING', color: 'bg-amber-900/10 text-amber-800' },
  'to-read': { label: 'TO READ', color: 'bg-slate-100 text-slate-600' },
  'read': { label: 'READ', color: 'bg-emerald-900/10 text-emerald-800' },
};

export default function ReadingList() {
  const {
    papers,
    collections,
    isLoading,
    addPaper,
    updatePaper,
    deletePaper,
    addCollection,
    deleteCollection,
    getCounts,
  } = useReadingList();

  const [selectedPaperId, setSelectedPaperId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeCollection, setActiveCollection] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showCollections, setShowCollections] = useState(false);
  const [showAddPaper, setShowAddPaper] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  const counts = getCounts();

  // Filter papers by status, collection, and search
  const filteredPapers = useMemo(() => {
    let filtered = papers;

    // Filter by status
    if (activeFilter !== 'all') {
      filtered = filtered.filter(p => p.status === activeFilter);
    }

    // Filter by collection
    if (activeCollection !== 'all') {
      filtered = filtered.filter(p => p.collections?.includes(activeCollection));
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.title?.toLowerCase().includes(query) ||
        p.authors?.toLowerCase().includes(query) ||
        p.summary?.toLowerCase().includes(query)
      );
    }

    // Sort: starred first, then by priority, then by date
    filtered.sort((a, b) => {
      if (a.starred && !b.starred) return -1;
      if (!a.starred && b.starred) return 1;
      const priorityDiff = (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
      if (priorityDiff !== 0) return priorityDiff;
      const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt) || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt) || new Date(0);
      return dateB - dateA;
    });

    return filtered;
  }, [papers, activeFilter, activeCollection, searchQuery]);

  const handleAddCollection = async () => {
    if (newCollectionName.trim()) {
      await addCollection(newCollectionName.trim());
      setNewCollectionName('');
    }
  };

  // Get collection name by ID
  const getCollectionName = (collectionId) => {
    const col = collections.find(c => c.id === collectionId);
    return col?.name || collectionId;
  };

  const selectedPaper = papers.find(p => p.id === selectedPaperId);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#fafafa]">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  // Show paper detail view
  if (selectedPaper) {
    return (
      <PaperDetail
        paper={selectedPaper}
        collections={collections}
        onBack={() => setSelectedPaperId(null)}
        onUpdate={(updates) => updatePaper(selectedPaper.id, updates)}
        onDelete={() => {
          deletePaper(selectedPaper.id);
          setSelectedPaperId(null);
        }}
      />
    );
  }

  // List view
  return (
    <div className="flex-1 bg-[#fafafa] overflow-auto">
      <div className="max-w-4xl mx-auto px-6 sm:px-8 py-8 sm:py-12">
        {/* Header */}
        <header className="mb-8">
          <h1 className="font-serif text-4xl sm:text-5xl tracking-tight text-neutral-900 mb-6">
            Reading List
          </h1>

          {/* Filter tabs */}
          <div className="flex items-center gap-6 text-base border-b border-neutral-200 pb-4">
            <button
              onClick={() => setActiveFilter('all')}
              className={`font-medium transition-colors ${
                activeFilter === 'all'
                  ? 'text-neutral-900'
                  : 'text-neutral-400 hover:text-neutral-600'
              }`}
            >
              All <span className="text-neutral-400 ml-1">{counts.all}</span>
            </button>
            <button
              onClick={() => setActiveFilter('to-read')}
              className={`font-medium transition-colors ${
                activeFilter === 'to-read'
                  ? 'text-neutral-900'
                  : 'text-neutral-400 hover:text-neutral-600'
              }`}
            >
              To Read <span className="text-neutral-400 ml-1">{counts['to-read']}</span>
            </button>
            <button
              onClick={() => setActiveFilter('reading')}
              className={`font-medium transition-colors ${
                activeFilter === 'reading'
                  ? 'text-neutral-900'
                  : 'text-neutral-400 hover:text-neutral-600'
              }`}
            >
              Reading <span className="text-neutral-400 ml-1">{counts.reading}</span>
            </button>
            <button
              onClick={() => setActiveFilter('read')}
              className={`font-medium transition-colors ${
                activeFilter === 'read'
                  ? 'text-neutral-900'
                  : 'text-neutral-400 hover:text-neutral-600'
              }`}
            >
              Read <span className="text-neutral-400 ml-1">{counts.read}</span>
            </button>
          </div>
        </header>

        {/* Action bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowAddPaper(true)}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700 transition-colors text-sm font-medium"
            >
              <Plus size={16} />
              Add Paper
            </button>

            <button
              onClick={() => { setShowSearch(!showSearch); setShowCollections(false); }}
              className={`p-2 rounded-lg transition-colors ${
                showSearch ? 'bg-neutral-200 text-neutral-900' : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600'
              }`}
              title="Search"
            >
              <SearchIcon size={18} />
            </button>

            <button
              onClick={() => { setShowCollections(!showCollections); setShowSearch(false); }}
              className={`p-2 rounded-lg transition-colors ${
                showCollections ? 'bg-neutral-200 text-neutral-900' : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600'
              }`}
              title="Manage Collections"
            >
              <Settings size={18} />
            </button>
          </div>

          {/* Collection filter dropdown */}
          {collections.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-400">Collection:</span>
              <select
                value={activeCollection}
                onChange={(e) => setActiveCollection(e.target.value)}
                className="text-sm border border-neutral-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-neutral-200"
              >
                <option value="all">All</option>
                {collections.map(col => (
                  <option key={col.id} value={col.id}>{col.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Search input */}
        {showSearch && (
          <div className="mb-6 relative">
            <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, author, or notes..."
              autoFocus
              className="w-full pl-11 pr-10 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-200 text-base bg-white placeholder:text-neutral-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        {/* Collections manager */}
        {showCollections && (
          <div className="mb-6 p-5 bg-white border border-neutral-200 rounded-xl">
            <h3 className="text-sm font-semibold text-neutral-900 mb-4">Manage Collections</h3>
            <div className="flex items-center gap-3 mb-4">
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="New collection name..."
                className="flex-1 px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-200 text-sm bg-white placeholder:text-neutral-400"
                onKeyDown={(e) => e.key === 'Enter' && handleAddCollection()}
              />
              <button
                onClick={handleAddCollection}
                className="px-4 py-2 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700 transition-colors text-sm font-medium"
              >
                Add
              </button>
            </div>
            {collections.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {collections.map(col => (
                  <div key={col.id} className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 rounded-full text-sm">
                    <span className="text-neutral-700">{col.name}</span>
                    <button
                      onClick={() => deleteCollection(col.id)}
                      className="text-neutral-400 hover:text-neutral-600 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-400">No collections yet. Create one to organize your papers.</p>
            )}
          </div>
        )}

        {/* Papers list */}
        <div className="space-y-4">
          {filteredPapers.map(paper => (
            <PaperCard
              key={paper.id}
              paper={paper}
              collections={collections}
              getCollectionName={getCollectionName}
              onClick={() => setSelectedPaperId(paper.id)}
            />
          ))}
        </div>

        {/* Empty states */}
        {filteredPapers.length === 0 && papers.length > 0 && (
          <div className="text-center py-16">
            <p className="text-neutral-500 text-lg">No papers match your filters</p>
            <button
              onClick={() => { setActiveFilter('all'); setActiveCollection('all'); setSearchQuery(''); }}
              className="mt-4 text-neutral-600 hover:text-neutral-900 underline transition-colors"
            >
              Clear filters
            </button>
          </div>
        )}

        {papers.length === 0 && (
          <div className="text-center py-16">
            <p className="text-neutral-500 text-lg mb-4">No papers yet</p>
            <button
              onClick={() => setShowAddPaper(true)}
              className="px-6 py-3 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700 transition-colors font-medium"
            >
              Add your first paper
            </button>
          </div>
        )}
      </div>

      {/* Add Paper Modal */}
      <AddPaperModal
        isOpen={showAddPaper}
        onClose={() => setShowAddPaper(false)}
        onSave={addPaper}
        collections={collections}
      />
    </div>
  );
}

// Paper card component - matches the reference design
function PaperCard({ paper, collections, getCollectionName, onClick }) {
  const status = paper.status || 'to-read';
  const statusConfig = STATUS_CONFIG[status];

  return (
    <div
      onClick={onClick}
      className="bg-white border border-neutral-100 rounded-xl p-6 cursor-pointer hover:border-neutral-200 shadow-sm hover:shadow transition-all"
    >
      <div className="flex items-start gap-5">
        {/* Status badge */}
        <div className={`px-3 py-1.5 rounded text-xs font-bold tracking-wide ${statusConfig.color} flex-shrink-0`}>
          {statusConfig.label}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="font-serif text-xl sm:text-2xl text-neutral-900 leading-snug mb-2">
            {paper.starred && <span className="text-amber-700 mr-2">★</span>}
            {paper.title}
          </h3>

          {/* Authors & Year */}
          {(paper.authors || paper.year) && (
            <p className="text-base text-neutral-500 mb-3">
              {paper.authors}
              {paper.authors && paper.year && ` (${paper.year})`}
              {!paper.authors && paper.year && paper.year}
            </p>
          )}

          {/* Summary/Notes preview */}
          {paper.summary && (
            <p className="text-base text-neutral-600 italic mb-3 line-clamp-2">
              "{paper.summary}"
            </p>
          )}

          {/* Collections tags */}
          {paper.collections && paper.collections.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {paper.collections.map(colId => (
                <span
                  key={colId}
                  className="text-sm text-neutral-400"
                >
                  {getCollectionName(colId)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
