import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import Modal from '../common/Modal';

const PRIORITIES = [
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
];

export default function AddPaperModal({ isOpen, onClose, onSave, paper, existingTags = [] }) {
  const [formData, setFormData] = useState({
    title: '',
    url: '',
    authors: '',
    year: '',
    venue: '',
    doi: '',
    priority: null,
    tags: [],
    notes: '',
  });
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (paper) {
      setFormData({
        title: paper.title || '',
        url: paper.url || '',
        authors: paper.authors || '',
        year: paper.year || '',
        venue: paper.venue || '',
        doi: paper.doi || '',
        priority: paper.priority || null,
        tags: paper.tags || [],
        notes: paper.notes || '',
      });
    } else {
      setFormData({
        title: '',
        url: '',
        authors: '',
        year: '',
        venue: '',
        doi: '',
        priority: null,
        tags: [],
        notes: '',
      });
    }
    setTagInput('');
  }, [paper, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    onSave({
      ...formData,
      title: formData.title.trim(),
      status: paper?.status || 'to-read',
    });
  };

  const addTag = (tag) => {
    const trimmed = tag.trim();
    if (trimmed && !formData.tags.includes(trimmed)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, trimmed],
      }));
    }
    setTagInput('');
  };

  const removeTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tagToRemove),
    }));
  };

  const handleTagInputKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  // Get suggested tags (existing tags not already added)
  const suggestedTags = existingTags
    .map(t => t.name)
    .filter(t => !formData.tags.includes(t))
    .slice(0, 5);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={paper ? 'Edit Paper' : 'Add Paper'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div>
          <label className="block text-xs text-neutral-400 uppercase tracking-wider mb-1.5">
            Title *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Paper title"
            required
            autoFocus
            className="w-full px-4 py-2.5 text-base bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300 placeholder:text-neutral-300"
          />
        </div>

        {/* URL */}
        <div>
          <label className="block text-xs text-neutral-400 uppercase tracking-wider mb-1.5">
            URL
          </label>
          <input
            type="url"
            value={formData.url}
            onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
            placeholder="https://..."
            className="w-full px-4 py-2.5 text-base bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300 placeholder:text-neutral-300"
          />
        </div>

        {/* Authors & Year */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-xs text-neutral-400 uppercase tracking-wider mb-1.5">
              Authors
            </label>
            <input
              type="text"
              value={formData.authors}
              onChange={(e) => setFormData(prev => ({ ...prev, authors: e.target.value }))}
              placeholder="Smith, Johnson & Lee"
              className="w-full px-4 py-2.5 text-base bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300 placeholder:text-neutral-300"
            />
          </div>
          <div className="w-28">
            <label className="block text-xs text-neutral-400 uppercase tracking-wider mb-1.5">
              Year
            </label>
            <input
              type="text"
              value={formData.year}
              onChange={(e) => setFormData(prev => ({ ...prev, year: e.target.value }))}
              placeholder="2023"
              className="w-full px-4 py-2.5 text-base bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300 placeholder:text-neutral-300"
            />
          </div>
        </div>

        {/* Venue & DOI */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-xs text-neutral-400 uppercase tracking-wider mb-1.5">
              Journal / Venue
            </label>
            <input
              type="text"
              value={formData.venue}
              onChange={(e) => setFormData(prev => ({ ...prev, venue: e.target.value }))}
              placeholder="Nature, ICIS, etc."
              className="w-full px-4 py-2.5 text-base bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300 placeholder:text-neutral-300"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-neutral-400 uppercase tracking-wider mb-1.5">
              DOI
            </label>
            <input
              type="text"
              value={formData.doi}
              onChange={(e) => setFormData(prev => ({ ...prev, doi: e.target.value }))}
              placeholder="10.1000/xyz123"
              className="w-full px-4 py-2.5 text-base bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300 placeholder:text-neutral-300"
            />
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs text-neutral-400 uppercase tracking-wider mb-1.5">
            Tags
          </label>
          {formData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-100 text-neutral-600 text-sm rounded-full"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-neutral-400 hover:text-neutral-600 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagInputKeyDown}
            onBlur={() => tagInput && addTag(tagInput)}
            placeholder="Add tags (press Enter or comma)"
            className="w-full px-4 py-2.5 text-base bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300 placeholder:text-neutral-300"
          />
          {suggestedTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="text-xs text-neutral-400">Suggestions:</span>
              {suggestedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addTag(tag)}
                  className="text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
                >
                  +{tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Priority */}
        <div>
          <label className="block text-xs text-neutral-400 uppercase tracking-wider mb-2">
            Priority
          </label>
          <div className="flex gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  priority: prev.priority === p.id ? null : p.id,
                }))}
                className={`px-4 py-2 text-sm border rounded-lg transition-colors ${
                  formData.priority === p.id
                    ? p.id === 'high'
                      ? 'border-amber-300 bg-amber-50 text-amber-700'
                      : 'border-neutral-300 bg-neutral-100 text-neutral-700'
                    : 'border-neutral-200 text-neutral-500 hover:bg-neutral-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4 pt-4 border-t border-neutral-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!formData.title.trim()}
            className="px-4 py-2 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {paper ? 'Save Changes' : 'Add Paper'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
