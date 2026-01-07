import { useState, useEffect, useCallback } from 'react';
import { X, Upload, Search, Loader2, FileText } from 'lucide-react';
import { extractMetadataFromFile, fetchCrossRefMetadata } from '../../utils/paperMetadata';
import { useStorage } from '../../hooks/useStorage';
import { useAuth } from '../../hooks/useAuth';

// File size limit: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function AddPaperModal({ isOpen, onClose, onSave, collections, paper }) {
  const { user } = useAuth();
  const { uploadFile, uploading, uploadProgress } = useStorage();

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
  const [pendingFile, setPendingFile] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [fileError, setFileError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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
      setPendingFile(null);
      setExtractionStatus('');
      setLookupError('');
      setFileError('');
    }
  }, [isOpen, paper]);

  // Handle file upload for PDF/EPUB
  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setFileError('File too large. Maximum size is 50MB.');
      e.target.value = '';
      return;
    }

    setFileError('');
    setIsExtracting(true);
    setExtractionStatus('Reading file...');
    setLookupError('');

    try {
      const metadata = await extractMetadataFromFile(file);

      // Store the file for later upload
      setPendingFile(file);

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
        setExtractionStatus('File attached. Could not extract metadata - please enter manually.');
        setTimeout(() => setExtractionStatus(''), 3000);
      }
    } catch (error) {
      console.error('Extraction error:', error);
      // Still keep the file even if metadata extraction fails
      setPendingFile(file);
      setExtractionStatus('File attached. Error reading metadata.');
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

    setIsSaving(true);

    try {
      let fileData = null;

      // Upload file if there's a pending file
      if (pendingFile && user) {
        try {
          fileData = await uploadFile(pendingFile, `users/${user.uid}/papers`);
        } catch (uploadErr) {
          console.error('File upload error:', uploadErr);
          setFileError('Failed to upload file. Paper will be saved without attachment.');
        }
      }

      await onSave({
        ...formData,
        year: formData.year ? parseInt(formData.year, 10) : null,
        ...(fileData && { file: fileData }),
      });
      onClose();
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCollection = (collectionId) => {
    setFormData(prev => ({
      ...prev,
      collections: prev.collections.includes(collectionId)
        ? prev.collections.filter(id => id !== collectionId)
        : [...prev.collections, collectionId]
    }));
  };

  const isSubmitting = isSaving || uploading;

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
            disabled={isSubmitting}
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

              {pendingFile ? (
                // Show pending file
                <div className="flex items-center gap-3 p-3 bg-black/5 rounded-lg">
                  <FileText size={20} className="text-black/40 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-black truncate">{pendingFile.name}</p>
                    <p className="text-xs text-black/40">{formatFileSize(pendingFile.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingFile(null)}
                    className="text-black/30 hover:text-black/60 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                // Show upload button
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
                      {isExtracting ? 'Extracting...' : 'Upload PDF or EPUB to auto-fill & attach'}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.epub"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isExtracting || isSubmitting}
                  />
                </label>
              )}

              {extractionStatus && (
                <p className="text-xs text-black/40 mt-2">{extractionStatus}</p>
              )}
              {fileError && (
                <p className="text-xs text-red-500 mt-2">{fileError}</p>
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
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={handleDoiLookup}
                disabled={isLookingUp || !formData.doi.trim() || isSubmitting}
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
              disabled={isSubmitting}
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
              disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
              disabled={isSubmitting}
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
              disabled={isSubmitting}
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
                    disabled={isSubmitting}
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

          {/* Upload Progress */}
          {uploading && (
            <div className="pt-2">
              <div className="flex items-center justify-between text-xs text-black/50 mb-1">
                <span>Uploading file...</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <div className="h-1 bg-black/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-black transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm text-black/40 hover:text-black transition-opacity disabled:opacity-30"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.title.trim()}
              className="px-4 py-2 text-sm bg-black text-white rounded hover:bg-black/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              {paper ? 'Save' : 'Add Paper'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
