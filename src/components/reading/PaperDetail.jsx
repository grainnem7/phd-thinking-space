import { useState } from 'react';
import { ArrowLeft, ExternalLink, Trash2, X } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

const STATUS_OPTIONS = [
  { id: 'to-read', label: 'To Read' },
  { id: 'reading', label: 'Reading' },
  { id: 'read', label: 'Read' },
  { id: 'archived', label: 'Archived' },
];

const PRIORITY_OPTIONS = [
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
  { id: null, label: 'None' },
];

export default function PaperDetail({ paper, onBack, onUpdate, onDelete, allTags = [] }) {
  const [notes, setNotes] = useState(paper.notes || '');
  const [tagInput, setTagInput] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const parseDate = (v) => {
    if (!v) return null;
    try { return v.toDate ? v.toDate() : new Date(v); } catch { return null; }
  };

  const timeAgo = (v) => {
    const d = parseDate(v);
    if (!d || isNaN(d.getTime())) return '';
    try { return formatDistanceToNow(d, { addSuffix: true }); } catch { return ''; }
  };

  const formatDate = (v) => {
    const d = parseDate(v);
    if (!d || isNaN(d.getTime())) return '';
    try { return format(d, 'MMM d, yyyy'); } catch { return ''; }
  };

  const handleStatusChange = (newStatus) => {
    onUpdate({ status: newStatus });
  };

  const handlePriorityChange = (newPriority) => {
    onUpdate({ priority: newPriority });
  };

  const handleNotesBlur = async () => {
    if (notes !== (paper.notes || '')) {
      setIsSavingNotes(true);
      await onUpdate({ notes });
      setIsSavingNotes(false);
    }
  };

  const addTag = (tag) => {
    const trimmed = tag.trim();
    if (trimmed && !paper.tags?.includes(trimmed)) {
      onUpdate({ tags: [...(paper.tags || []), trimmed] });
    }
    setTagInput('');
  };

  const removeTag = (tagToRemove) => {
    onUpdate({ tags: paper.tags.filter(t => t !== tagToRemove) });
  };

  const handleTagInputKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  // Suggested tags not already on this paper
  const suggestedTags = allTags
    .map(t => t.name)
    .filter(t => !paper.tags?.includes(t))
    .slice(0, 5);

  return (
    <main className="flex-1 overflow-auto bg-[#fafafa]">
      <div className="max-w-3xl mx-auto px-8 py-8">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-600 transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          Back to Reading List
        </button>

        {/* Title */}
        <h1 className="font-serif text-3xl font-medium text-neutral-900 tracking-tight">
          {paper.title}
        </h1>

        {/* Authors & Year */}
        {(paper.authors || paper.year) && (
          <p className="text-lg text-neutral-500 mt-2">
            {paper.authors}{paper.authors && paper.year && ' · '}{paper.year}
          </p>
        )}

        {/* Venue */}
        {paper.venue && (
          <p className="text-base text-neutral-400 mt-1">{paper.venue}</p>
        )}

        {/* URL & DOI */}
        <div className="flex items-center gap-4 mt-4">
          {paper.url && (
            <a
              href={paper.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 transition-colors"
            >
              <ExternalLink size={14} />
              Open paper
            </a>
          )}
          {paper.doi && (
            <a
              href={`https://doi.org/${paper.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              DOI: {paper.doi}
            </a>
          )}
        </div>

        {/* Status & Priority */}
        <div className="flex items-start gap-8 mt-8 pt-8 border-t border-neutral-200">
          <div>
            <label className="block text-xs text-neutral-400 uppercase tracking-wider mb-2">
              Status
            </label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleStatusChange(opt.id)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    paper.status === opt.id
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-neutral-400 uppercase tracking-wider mb-2">
              Priority
            </label>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.id ?? 'none'}
                  onClick={() => handlePriorityChange(opt.id)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    paper.priority === opt.id
                      ? opt.id === 'high'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="mt-8">
          <label className="block text-xs text-neutral-400 uppercase tracking-wider mb-2">
            Tags
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {paper.tags?.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 text-neutral-600 text-sm rounded-full"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagInputKeyDown}
              onBlur={() => tagInput && addTag(tagInput)}
              placeholder="+ Add tag"
              className="px-3 py-1.5 text-sm bg-transparent border-none focus:outline-none placeholder:text-neutral-400 w-24"
            />
          </div>
          {suggestedTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="text-xs text-neutral-400">Suggestions:</span>
              {suggestedTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => addTag(tag)}
                  className="text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
                >
                  +{tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-neutral-400 uppercase tracking-wider">
              Notes
            </label>
            {isSavingNotes && (
              <span className="text-xs text-neutral-400">Saving...</span>
            )}
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Add your notes about this paper..."
            className="w-full px-4 py-3 text-base bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-300 placeholder:text-neutral-300 min-h-[200px] resize-y"
          />
        </div>

        {/* Metadata */}
        <div className="mt-8 pt-8 border-t border-neutral-200">
          <div className="flex items-center gap-6 text-sm text-neutral-400">
            <span>Added {timeAgo(paper.createdAt)}</span>
            {paper.readAt && (
              <span>Read on {formatDate(paper.readAt)}</span>
            )}
          </div>
        </div>

        {/* Delete button */}
        <div className="mt-8 pt-8 border-t border-neutral-200">
          <button
            onClick={onDelete}
            className="flex items-center gap-2 text-sm text-neutral-400 hover:text-red-600 transition-colors"
          >
            <Trash2 size={14} />
            Delete paper
          </button>
        </div>
      </div>
    </main>
  );
}
