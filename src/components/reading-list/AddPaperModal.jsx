import { useState, useEffect, useCallback } from 'react';
import { X, Upload, Search, Loader2 } from 'lucide-react';
import { extractMetadataFromFile, fetchCrossRefMetadata } from '../../utils/paperMetadata';

export default function AddPaperModal({ isOpen, onClose, onSave, collections, paper }) {
  const [formData, setFormData] = useState({
    title: '',
    authors: '',
    year: '',
    url: '',
    doi: '',
    collections: [],
    journal: '',
    publisher: '',
    volume: '',
    issue: '',
    pages: '',
  });
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState('');

  // Reset form when modal opens/closes or paper changes
  useEffect(() => {
    if (isOpen) {
      if (paper) {
        setFormData({
          title: paper.title || '',
          authors: paper.authors || '',
          year: paper.year || '',
          url: paper.url || '',
          doi: paper.doi || '',
          collections: paper.collections || [],
          journal: paper.journal || '',
          publisher: paper.publisher || '',
          volume: paper.volume || '',
          issue: paper.issue || '',
          pages: paper.pages || '',
        });
      } else {
        setFormData({
          title: '',
          authors: '',
          year: '',
          url: '',
          doi: '',
          collections: [],
          journal: '',
          publisher: '',
          volume: '',
          issue: '',
          pages: '',
        });
      }
      setExtractionStatus('');
      setLookupError('');
    }
  }, [isOpen, paper]);

  // Handle file upload for PDF/EPUB
  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setExtractionStatus('Reading file...');
    setLookupError('');

    try {
      const metadata = await extractMetadataFromFile(file);

      if (metadata) {
        setExtractionStatus('Found metadata!');

        setFormData(prev => ({
          ...prev,
          title: metadata.title || prev.title,
          authors: metadata.authors || prev.authors,
          year: metadata.year?.toString() || prev.year,
          doi: metadata.doi || prev.doi,
          url: metadata.url || (metadata.doi ? `https://doi.org/${metadata.doi}` : prev.url),
          journal: metadata.journal || prev.journal,
          publisher: metadata.publisher || prev.publisher,
          volume: metadata.volume || prev.volume,
          issue: metadata.issue || prev.issue,
          pages: metadata.pages || prev.pages,
        }));

        // Clear status after a moment
        setTimeout(() => setExtractionStatus(''), 2000);
      } else {
        setExtractionStatus('Could not extract metadata. Please enter manually.');
        setTimeout(() => setExtractionStatus(''), 3000);
      }
    } catch (error) {
      console.error('Extraction error:', error);
      setExtractionStatus('Error reading file');
      setTimeout(() => setExtractionStatus(''), 3000);
    } finally {
      setIsExtracting(false);
      // Reset input so same file can be selected again
      e.target.value = '';
    }
  }, []);

  // Handle DOI lookup
  const handleDoiLookup = async () => {
    if (!formData.doi.trim()) return;

    setIsLookingUp(true);
    setLookupError('');

    try {
      const metadata = await fetchCrossRefMetadata(formData.doi.trim());
      if (metadata) {
        setFormData(prev => ({
          ...prev,
          title: metadata.title || prev.title,
          authors: metadata.authors || prev.authors,
          year: metadata.year?.toString() || prev.year,
          url: metadata.url || prev.url,
          journal: metadata.journal || prev.journal,
          publisher: metadata.publisher || prev.publisher,
          volume: metadata.volume || prev.volume,
          issue: metadata.issue || prev.issue,
          pages: metadata.pages || prev.pages,
        }));
      } else {
        setLookupError('DOI not found');
      }
    } catch (e) {
      setLookupError('Lookup failed');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    await onSave({
      ...formData,
      year: formData.year ? parseInt(formData.year, 10) : null,
    });
    onClose();
  };

  const toggleCollection = (collectionId) => {
    setFormData(prev => ({
      ...prev,
      collections: prev.collections.includes(collectionId)
        ? prev.collections.filter(id => id !== collectionId)
        : [...prev.collections, collectionId]
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white w-full max-w-lg mx-4 rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/5 sticky top-0 bg-white z-10">
          <h2 className="font-serif text-xl text-black">
            {paper ? 'Edit Paper' : 'Add Paper'}
          </h2>
          <button
            onClick={onClose}
            className="text-black/30 hover:text-black/60 transition-opacity"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* File Upload Section */}
          {!paper && (
            <div className="pb-5 border-b border-black/5">
              <label className="block text-xs uppercase tracking-widest text-black/50 mb-3">
                Import from file
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className={`flex items-center gap-2 text-sm transition-colors ${
                  isExtracting
                    ? 'text-black/40'
                    : 'text-black/60 hover:text-black'
                }`}>
                  {isExtracting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Upload size={16} />
                  )}
                  <span>
                    {isExtracting ? 'Extracting...' : 'Upload PDF or EPUB to auto-fill'}
                  </span>
                </div>
                <input
                  type="file"
                  accept=".pdf,.epub"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isExtracting}
                />
              </label>
              {extractionStatus && (
                <p className="text-xs text-black/40 mt-2">{extractionStatus}</p>
              )}
            </div>
          )}

          {/* DOI with Lookup */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-black/50 mb-2">
              DOI
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={formData.doi}
                onChange={(e) => setFormData(prev => ({ ...prev, doi: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && formData.doi.trim() && !isLookingUp) {
                    e.preventDefault();
                    handleDoiLookup();
                  }
                }}
                className="flex-1 px-0 py-2 border-b border-black/10 focus:border-black/30 outline-none text-black placeholder:text-black/30"
                placeholder="10.xxxx/..."
              />
              <button
                type="button"
                onClick={handleDoiLookup}
                disabled={isLookingUp || !formData.doi.trim()}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-black/60 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
              >
                {isLookingUp ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Search size={14} />
                )}
                <span>Lookup</span>
              </button>
            </div>
            {lookupError && (
              <p className="text-xs text-red-500 mt-1">{lookupError}</p>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-black/50 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-0 py-2 border-b border-black/10 focus:border-black/30 outline-none text-black placeholder:text-black/30"
              placeholder="Paper title"
              autoFocus
              required
            />
          </div>

          {/* Authors */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-black/50 mb-2">
              Authors
            </label>
            <input
              type="text"
              value={formData.authors}
              onChange={(e) => setFormData(prev => ({ ...prev, authors: e.target.value }))}
              className="w-full px-0 py-2 border-b border-black/10 focus:border-black/30 outline-none text-black placeholder:text-black/30"
              placeholder="Author names"
            />
          </div>

          {/* Year and Journal on same row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-black/50 mb-2">
                Year
              </label>
              <input
                type="number"
                value={formData.year}
                onChange={(e) => setFormData(prev => ({ ...prev, year: e.target.value }))}
                className="w-full px-0 py-2 border-b border-black/10 focus:border-black/30 outline-none text-black placeholder:text-black/30"
                placeholder="2024"
                min="1900"
                max="2100"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-black/50 mb-2">
                Journal
              </label>
              <input
                type="text"
                value={formData.journal}
                onChange={(e) => setFormData(prev => ({ ...prev, journal: e.target.value }))}
                className="w-full px-0 py-2 border-b border-black/10 focus:border-black/30 outline-none text-black placeholder:text-black/30"
                placeholder="Journal name"
              />
            </div>
          </div>

          {/* Volume, Issue, Pages */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-black/50 mb-2">
                Volume
              </label>
              <input
                type="text"
                value={formData.volume}
                onChange={(e) => setFormData(prev => ({ ...prev, volume: e.target.value }))}
                className="w-full px-0 py-2 border-b border-black/10 focus:border-black/30 outline-none text-black placeholder:text-black/30"
                placeholder="12"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-black/50 mb-2">
                Issue
              </label>
              <input
                type="text"
                value={formData.issue}
                onChange={(e) => setFormData(prev => ({ ...prev, issue: e.target.value }))}
                className="w-full px-0 py-2 border-b border-black/10 focus:border-black/30 outline-none text-black placeholder:text-black/30"
                placeholder="3"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-black/50 mb-2">
                Pages
              </label>
              <input
                type="text"
                value={formData.pages}
                onChange={(e) => setFormData(prev => ({ ...prev, pages: e.target.value }))}
                className="w-full px-0 py-2 border-b border-black/10 focus:border-black/30 outline-none text-black placeholder:text-black/30"
                placeholder="1-15"
              />
            </div>
          </div>

          {/* URL */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-black/50 mb-2">
              URL
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
              className="w-full px-0 py-2 border-b border-black/10 focus:border-black/30 outline-none text-black placeholder:text-black/30"
              placeholder="https://..."
            />
          </div>

          {/* Publisher (for books) */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-black/50 mb-2">
              Publisher
            </label>
            <input
              type="text"
              value={formData.publisher}
              onChange={(e) => setFormData(prev => ({ ...prev, publisher: e.target.value }))}
              className="w-full px-0 py-2 border-b border-black/10 focus:border-black/30 outline-none text-black placeholder:text-black/30"
              placeholder="Publisher name (for books)"
            />
          </div>

          {/* Collections */}
          {collections.length > 0 && (
            <div>
              <label className="block text-xs uppercase tracking-widest text-black/50 mb-3">
                Collections
              </label>
              <div className="flex flex-wrap gap-2">
                {collections.map(col => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => toggleCollection(col.id)}
                    className={`px-3 py-1.5 text-sm rounded transition-colors ${
                      formData.collections.includes(col.id)
                        ? 'bg-black text-white'
                        : 'bg-black/5 text-black/60 hover:bg-black/10'
                    }`}
                  >
                    {col.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-black/40 hover:text-black transition-opacity"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-black text-white rounded hover:bg-black/80 transition-colors"
            >
              {paper ? 'Save' : 'Add Paper'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
