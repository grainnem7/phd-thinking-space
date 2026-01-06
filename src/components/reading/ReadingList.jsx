import { useState, useMemo } from 'react';
import { Plus, ChevronRight, ExternalLink, MoreHorizontal, Trash2, Pencil } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useReadingList } from '../../hooks/useReadingList';
import AddPaperModal from './AddPaperModal';
import PaperDetail from './PaperDetail';
import Dropdown, { DropdownItem } from '../common/Dropdown';

const STATUS_TABS = [
  { id: 'to-read', label: 'To Read' },
  { id: 'reading', label: 'Reading' },
  { id: 'read', label: 'Read' },
  { id: 'archived', label: 'Archived' },
  { id: 'all', label: 'All' },
];

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2, null: 3 };

export default function ReadingList() {
  const {
    papers,
    tags,
    isLoading,
    addPaper,
    updatePaper,
    deletePaper,
    getCounts,
  } = useReadingList();

  const [activeTab, setActiveTab] = useState('to-read');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [editingPaper, setEditingPaper] = useState(null);

  const counts = getCounts();

  // Filter and sort papers
  const filteredPapers = useMemo(() => {
    let filtered = activeTab === 'all'
      ? papers
      : papers.filter(p => p.status === activeTab);

    // Sort by priority (high first), then by date
    return filtered.sort((a, b) => {
      const priorityDiff = (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
      if (priorityDiff !== 0) return priorityDiff;

      const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt) || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt) || new Date(0);
      return dateB - dateA;
    });
  }, [papers, activeTab]);

  // Group by priority for display
  const groupedPapers = useMemo(() => {
    const highPriority = filteredPapers.filter(p => p.priority === 'high');
    const other = filteredPapers.filter(p => p.priority !== 'high');
    return { highPriority, other };
  }, [filteredPapers]);

  const parseDate = (v) => {
    if (!v) return null;
    try { return v.toDate ? v.toDate() : new Date(v); } catch { return null; }
  };

  const timeAgo = (v) => {
    const d = parseDate(v);
    if (!d || isNaN(d.getTime())) return '';
    try { return formatDistanceToNow(d, { addSuffix: true }); } catch { return ''; }
  };

  const handleSavePaper = async (paperData) => {
    if (editingPaper) {
      await updatePaper(editingPaper.id, paperData);
      setEditingPaper(null);
    } else {
      await addPaper(paperData);
    }
    setShowAddModal(false);
  };

  const handleDeletePaper = async (paperId) => {
    if (window.confirm('Are you sure you want to delete this paper?')) {
      await deletePaper(paperId);
      if (selectedPaper?.id === paperId) {
        setSelectedPaper(null);
      }
    }
  };

  const handleEditPaper = (paper) => {
    setEditingPaper(paper);
    setShowAddModal(true);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#fafafa]">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-neutral-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show detail view if a paper is selected
  if (selectedPaper) {
    return (
      <PaperDetail
        paper={selectedPaper}
        onBack={() => setSelectedPaper(null)}
        onUpdate={(updates) => updatePaper(selectedPaper.id, updates)}
        onDelete={() => handleDeletePaper(selectedPaper.id)}
        allTags={tags}
      />
    );
  }

  return (
    <main className="flex-1 overflow-auto bg-[#fafafa]">
      <div className="max-w-4xl mx-auto px-8 py-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif text-3xl font-medium text-neutral-900 tracking-tight">
              Reading List
            </h1>
            <p className="text-sm text-neutral-400 mt-1">
              {counts['to-read']} papers to read
            </p>
          </div>
          <button
            onClick={() => { setEditingPaper(null); setShowAddModal(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <Plus size={16} />
            Add Paper
          </button>
        </header>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-neutral-200 pb-3">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-neutral-100 text-neutral-900 font-medium'
                  : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              {tab.label}
              <span className="ml-2 text-neutral-400">{counts[tab.id]}</span>
            </button>
          ))}
        </div>

        {/* Papers List */}
        {filteredPapers.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-neutral-400 mb-4">No papers in this list</p>
            <button
              onClick={() => { setEditingPaper(null); setShowAddModal(true); }}
              className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              + Add your first paper
            </button>
          </div>
        ) : (
          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            {/* High Priority Section */}
            {groupedPapers.highPriority.length > 0 && (
              <>
                <div className="px-6 py-3 bg-neutral-50 border-b border-neutral-100">
                  <span className="text-xs text-amber-600 uppercase tracking-widest font-medium">
                    High Priority
                  </span>
                </div>
                {groupedPapers.highPriority.map((paper) => (
                  <PaperCard
                    key={paper.id}
                    paper={paper}
                    timeAgo={timeAgo}
                    onClick={() => setSelectedPaper(paper)}
                    onEdit={() => handleEditPaper(paper)}
                    onDelete={() => handleDeletePaper(paper.id)}
                  />
                ))}
              </>
            )}

            {/* Other Papers Section */}
            {groupedPapers.other.length > 0 && (
              <>
                {groupedPapers.highPriority.length > 0 && (
                  <div className="px-6 py-3 bg-neutral-50 border-b border-neutral-100">
                    <span className="text-xs text-neutral-400 uppercase tracking-widest font-medium">
                      Other
                    </span>
                  </div>
                )}
                {groupedPapers.other.map((paper) => (
                  <PaperCard
                    key={paper.id}
                    paper={paper}
                    timeAgo={timeAgo}
                    onClick={() => setSelectedPaper(paper)}
                    onEdit={() => handleEditPaper(paper)}
                    onDelete={() => handleDeletePaper(paper.id)}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Paper Modal */}
      <AddPaperModal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setEditingPaper(null); }}
        onSave={handleSavePaper}
        paper={editingPaper}
        existingTags={tags}
      />
    </main>
  );
}

function PaperCard({ paper, timeAgo, onClick, onEdit, onDelete }) {
  return (
    <div
      className="px-6 py-5 border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50 transition-colors cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex items-start gap-2">
            <p className="text-base text-neutral-900 font-medium">{paper.title}</p>
            {paper.url && (
              <a
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-neutral-300 hover:text-neutral-500 transition-colors flex-shrink-0 mt-1"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>

          {/* Authors & Year */}
          {(paper.authors || paper.year) && (
            <p className="text-sm text-neutral-500 mt-1">
              {paper.authors}{paper.authors && paper.year && ' · '}{paper.year}
            </p>
          )}

          {/* Tags */}
          {paper.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {paper.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right side: time & actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-sm text-neutral-400">{timeAgo(paper.createdAt)}</span>

          <Dropdown
            align="right"
            trigger={
              <button
                onClick={(e) => e.stopPropagation()}
                className="opacity-0 group-hover:opacity-100 text-neutral-300 hover:text-neutral-500 transition-all p-1"
              >
                <MoreHorizontal size={16} />
              </button>
            }
          >
            {({ close }) => (
              <>
                <DropdownItem onClick={() => { onEdit(); close(); }}>
                  <Pencil size={14} /> Edit
                </DropdownItem>
                <DropdownItem danger onClick={() => { onDelete(); close(); }}>
                  <Trash2 size={14} /> Delete
                </DropdownItem>
              </>
            )}
          </Dropdown>
        </div>
      </div>
    </div>
  );
}
