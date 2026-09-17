import { useState, useCallback } from 'react';
import { X, Upload, Search, Loader2, FileText, Lock } from 'lucide-react';
import { extractMetadataFromFile, fetchCrossRefMetadata } from '../../utils/paperMetadata';
import { useStorage } from '../../hooks/useStorage';
import { useAuth } from '../../hooks/useAuth';
import Modal from '../common/Modal';
import InlineError from './InlineError';

// File size limit: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const LABEL = 'block text-xs uppercase tracking-widest text-neutral-400 dark:text-neutral-500 mb-2';
const FIELD = 'w-full px-0 py-2 bg-transparent border-b border-neutral-200 dark:border-neutral-700 focus:border-neutral-400 dark:focus:border-neutral-500 outline-none text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 disabled:opacity-60';

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function initialForm(paper) {
  return {
    title: paper?.title || '',
    authors: paper?.authors || '',
    year: paper?.year || '',
    url: paper?.url || '',
    doi: paper?.doi || '',
    collections: paper?.collections || [],
    journal: paper?.journal || '',
    publisher: paper?.publisher || '',
    volume: paper?.volume || '',
    issue: paper?.issue || '',
    pages: paper?.pages || '',
  };
}

// Mount this only while open: the form starts fresh each time.
export default function AddPaperModal({ isOpen = true, onClose, onSave, collections, paper }) {
  const { user } = useAuth();
  const { uploadFile, canUpload, uploading, uploadProgress } = useStorage();

  const [formData, setFormData] = useState(() => initialForm(paper));
  const [pendingFile, setPendingFile] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [fileError, setFileError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const setField = (field) => (e) => setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  // Handle file upload for PDF/EPUB
  const handleFileUpload = useCallback(async (e) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setFileError('File too large. Maximum size is 50MB.');
      input.value = '';
      return;
    }

    setFileError('');
    setIsExtracting(true);
    setExtractionStatus('Reading file...');
    setLookupError('');

    try {
      const metadata = await extractMetadataFromFile(file);

      // Keep the file for upload on save (not possible in demo mode)
      if (canUpload) setPendingFile(file);

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

        setTimeout(() => setExtractionStatus(''), 2000);
      } else {
        setExtractionStatus(canUpload
          ? 'File attached. Could not extract metadata - please enter manually.'
          : 'Could not extract metadata - please enter manually.');
        setTimeout(() => setExtractionStatus(''), 3000);
      }
    } catch (error) {
      console.error('Extraction error:', error);
      // Still keep the file even if metadata extraction fails
      if (canUpload) setPendingFile(file);
      setExtractionStatus(canUpload ? 'File attached. Error reading metadata.' : 'Error reading metadata.');
      setTimeout(() => setExtractionStatus(''), 3000);
    } finally {
      setIsExtracting(false);
      // Reset input so same file can be selected again
      input.value = '';
    }
  }, [canUpload]);

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
    } catch {
      setLookupError('Lookup failed. Check the DOI and your connection.');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setIsSaving(true);
    setSaveError('');

    let fileData = null;
    if (pendingFile && user && canUpload) {
      try {
        fileData = await uploadFile(pendingFile, `users/${user.uid}/papers`);
      } catch (uploadErr) {
        console.error('File upload error:', uploadErr);
        setFileError('Failed to upload the file. Try again, or remove it to save without an attachment.');
        setIsSaving(false);
        return;
      }
    }

    try {
      await onSave({
        ...formData,
        year: formData.year ? parseInt(formData.year, 10) : null,
        ...(fileData && { file: fileData }),
      });
      onClose();
    } catch (err) {
      console.error('Save error:', err);
      setSaveError("Couldn't save the paper. Check your connection and try again.");
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
  const handleClose = () => {
    if (!isSubmitting) onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={paper ? 'Edit Paper' : 'Add Paper'} size="md">
      <form onSubmit={handleSubmit} className="reading-list-modal space-y-5">
        {/* File Upload Section */}
        {!paper && (
          <div className="pb-5 border-b border-neutral-200 dark:border-neutral-800">
            <span className={LABEL}>Import from file</span>

            {pendingFile ? (
              <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                <FileText size={20} className="text-neutral-400 shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-900 dark:text-neutral-100 truncate">{pendingFile.name}</p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">{formatFileSize(pendingFile.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setPendingFile(null); setFileError(''); }}
                  disabled={isSubmitting}
                  aria-label={`Remove ${pendingFile.name}`}
                  className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors disabled:opacity-40"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <label className={`inline-flex items-center gap-2 text-sm rounded focus-within:ring-2 focus-within:ring-neutral-300 dark:focus-within:ring-neutral-600 transition-colors ${
                  isExtracting || isSubmitting
                    ? 'text-neutral-400 cursor-default'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100 cursor-pointer'
                }`}>
                  {isExtracting ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Upload size={16} aria-hidden="true" />
                  )}
                  <span>
                    {isExtracting
                      ? 'Extracting...'
                      : canUpload ? 'Upload PDF or EPUB to auto-fill & attach' : 'Auto-fill from a PDF or EPUB'}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.epub"
                    onChange={handleFileUpload}
                    className="sr-only"
                    disabled={isExtracting || isSubmitting}
                  />
                </label>
                {!canUpload && (
                  <p className="flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500 mt-2">
                    <Lock size={12} aria-hidden="true" />
                    Sign in to attach PDFs
                  </p>
                )}
              </>
            )}

            {extractionStatus && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2" role="status">{extractionStatus}</p>
            )}
            <InlineError message={fileError} onDismiss={() => setFileError('')} className="mt-3" />
          </div>
        )}

        {/* DOI with Lookup */}
        <div>
          <label htmlFor="paper-doi" className={LABEL}>DOI</label>
          <div className="flex items-center gap-2">
            <input
              id="paper-doi"
              type="text"
              value={formData.doi}
              onChange={setField('doi')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && formData.doi.trim() && !isLookingUp) {
                  e.preventDefault();
                  handleDoiLookup();
                }
              }}
              className={`flex-1 min-w-0 ${FIELD}`}
              placeholder="10.xxxx/..."
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={handleDoiLookup}
              disabled={isLookingUp || !formData.doi.trim() || isSubmitting}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:text-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isLookingUp ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <Search size={14} aria-hidden="true" />
              )}
              <span>Lookup</span>
            </button>
          </div>
          {lookupError && (
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-1" role="alert">{lookupError}</p>
          )}
        </div>

        {/* Title */}
        <div>
          <label htmlFor="paper-title" className={LABEL}>Title *</label>
          <input
            id="paper-title"
            type="text"
            value={formData.title}
            onChange={setField('title')}
            className={FIELD}
            placeholder="Paper title"
            autoFocus
            required
            disabled={isSubmitting}
          />
        </div>

        {/* Authors */}
        <div>
          <label htmlFor="paper-authors" className={LABEL}>Authors</label>
          <input
            id="paper-authors"
            type="text"
            value={formData.authors}
            onChange={setField('authors')}
            className={FIELD}
            placeholder="Author names"
            disabled={isSubmitting}
          />
        </div>

        {/* Year and Journal */}
        <div className="grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <label htmlFor="paper-year" className={LABEL}>Year</label>
            <input
              id="paper-year"
              type="number"
              inputMode="numeric"
              value={formData.year}
              onChange={setField('year')}
              className={FIELD}
              placeholder="2024"
              min="1900"
              max="2100"
              disabled={isSubmitting}
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="paper-journal" className={LABEL}>Journal</label>
            <input
              id="paper-journal"
              type="text"
              value={formData.journal}
              onChange={setField('journal')}
              className={FIELD}
              placeholder="Journal name"
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Volume, Issue, Pages */}
        <div className="grid grid-cols-3 gap-4">
          {[
            ['volume', 'Volume', '12'],
            ['issue', 'Issue', '3'],
            ['pages', 'Pages', '1-15'],
          ].map(([field, label, placeholder]) => (
            <div key={field} className="min-w-0">
              <label htmlFor={`paper-${field}`} className={LABEL}>{label}</label>
              <input
                id={`paper-${field}`}
                type="text"
                value={formData[field]}
                onChange={setField(field)}
                className={FIELD}
                placeholder={placeholder}
                disabled={isSubmitting}
              />
            </div>
          ))}
        </div>

        {/* URL */}
        <div>
          <label htmlFor="paper-url" className={LABEL}>URL</label>
          <input
            id="paper-url"
            type="url"
            value={formData.url}
            onChange={setField('url')}
            className={FIELD}
            placeholder="https://..."
            disabled={isSubmitting}
          />
        </div>

        {/* Publisher (for books) */}
        <div>
          <label htmlFor="paper-publisher" className={LABEL}>Publisher</label>
          <input
            id="paper-publisher"
            type="text"
            value={formData.publisher}
            onChange={setField('publisher')}
            className={FIELD}
            placeholder="Publisher name (for books)"
            disabled={isSubmitting}
          />
        </div>

        {/* Collections */}
        {collections.length > 0 && (
          <div role="group" aria-labelledby="paper-collections-heading">
            <span id="paper-collections-heading" className={`${LABEL} mb-3`}>Collections</span>
            <div className="flex flex-wrap gap-2">
              {collections.map(col => {
                const active = formData.collections.includes(col.id);
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => toggleCollection(col.id)}
                    disabled={isSubmitting}
                    aria-pressed={active}
                    className={`px-3 py-1.5 text-sm rounded-full transition-colors ${active
                      ? 'bg-accent text-accent-fg'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'}`}
                  >
                    {col.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div className="pt-2" role="status">
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              <span>Uploading file...</span>
              <span className="tabular-nums">{Math.round(uploadProgress)}%</span>
            </div>
            <div className="h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <InlineError message={saveError} onDismiss={() => setSaveError('')} />

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !formData.title.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-accent text-accent-fg hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {paper ? 'Save' : 'Add Paper'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
