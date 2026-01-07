import { useState, useEffect, useRef } from 'react';
import { X, Upload, FileText, Trash2, Loader2 } from 'lucide-react';
import Modal from '../common/Modal';
import { useStorage } from '../../hooks/useStorage';
import { useAuth } from '../../hooks/useAuth';

const PRIORITIES = [
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
];

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function AddPaperModal({ isOpen, onClose, onSave, paper, existingTags = [] }) {
  const { user } = useAuth();
  const { uploadFile, deleteFile, uploading, uploadProgress } = useStorage();
  const fileInputRef = useRef(null);

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
    file: null, // { url, path, name, size, type }
  });
  const [tagInput, setTagInput] = useState('');
  const [pendingFile, setPendingFile] = useState(null); // File object waiting to be uploaded
  const [fileError, setFileError] = useState(null);

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
        file: paper.file || null,
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
        file: null,
      });
    }
    setTagInput('');
    setPendingFile(null);
    setFileError(null);
  }, [paper, isOpen]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setFileError('Please upload a PDF, Word document, or text file');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setFileError('File size must be less than 50MB');
      return;
    }

    setPendingFile(file);
  };

  const handleRemoveFile = async () => {
    // If there's an existing file in the database, mark it for deletion
    if (formData.file?.path) {
      await deleteFile(formData.file.path);
    }
    setFormData(prev => ({ ...prev, file: null }));
    setPendingFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    let fileData = formData.file;

    // Upload pending file if exists
    if (pendingFile) {
      try {
        const uploadPath = `users/${user.uid}/papers`;
        fileData = await uploadFile(pendingFile, uploadPath);
      } catch (err) {
        setFileError('Failed to upload file. Please try again.');
        return;
      }
    }

    onSave({
      ...formData,
      file: fileData,
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
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
        {/* Title */}
        <div>
          <label className="block text-xs sm:text-sm text-neutral-400 uppercase tracking-wider mb-1.5">
            Title *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Paper title"
            required
            autoFocus
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-base bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300 placeholder:text-neutral-400"
          />
        </div>

        {/* URL */}
        <div>
          <label className="block text-xs sm:text-sm text-neutral-400 uppercase tracking-wider mb-1.5">
            URL
          </label>
          <input
            type="url"
            value={formData.url}
            onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
            placeholder="https://..."
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-base bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300 placeholder:text-neutral-400"
          />
        </div>

        {/* Authors & Year */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1">
            <label className="block text-xs sm:text-sm text-neutral-400 uppercase tracking-wider mb-1.5">
              Authors
            </label>
            <input
              type="text"
              value={formData.authors}
              onChange={(e) => setFormData(prev => ({ ...prev, authors: e.target.value }))}
              placeholder="Smith, Johnson & Lee"
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-base bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300 placeholder:text-neutral-400"
            />
          </div>
          <div className="w-full sm:w-28">
            <label className="block text-xs sm:text-sm text-neutral-400 uppercase tracking-wider mb-1.5">
              Year
            </label>
            <input
              type="text"
              value={formData.year}
              onChange={(e) => setFormData(prev => ({ ...prev, year: e.target.value }))}
              placeholder="2023"
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-base bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300 placeholder:text-neutral-400"
            />
          </div>
        </div>

        {/* Venue & DOI */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1">
            <label className="block text-xs sm:text-sm text-neutral-400 uppercase tracking-wider mb-1.5">
              Journal / Venue
            </label>
            <input
              type="text"
              value={formData.venue}
              onChange={(e) => setFormData(prev => ({ ...prev, venue: e.target.value }))}
              placeholder="Nature, ICIS, etc."
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-base bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300 placeholder:text-neutral-400"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs sm:text-sm text-neutral-400 uppercase tracking-wider mb-1.5">
              DOI
            </label>
            <input
              type="text"
              value={formData.doi}
              onChange={(e) => setFormData(prev => ({ ...prev, doi: e.target.value }))}
              placeholder="10.1000/xyz123"
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-base bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300 placeholder:text-neutral-400"
            />
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs sm:text-sm text-neutral-400 uppercase tracking-wider mb-1.5">
            Tags
          </label>
          {formData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-neutral-100 text-neutral-600 text-sm sm:text-base rounded-full"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-neutral-400 hover:text-neutral-600 transition-colors"
                  >
                    <X size={16} />
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
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-base bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300 placeholder:text-neutral-400"
          />
          {suggestedTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="text-xs sm:text-sm text-neutral-400">Suggestions:</span>
              {suggestedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addTag(tag)}
                  className="text-xs sm:text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
                >
                  +{tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Priority */}
        <div>
          <label className="block text-xs sm:text-sm text-neutral-400 uppercase tracking-wider mb-2">
            Priority
          </label>
          <div className="flex flex-wrap gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  priority: prev.priority === p.id ? null : p.id,
                }))}
                className={`px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border rounded-lg transition-colors ${
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

        {/* File Upload */}
        <div>
          <label className="block text-xs sm:text-sm text-neutral-400 uppercase tracking-wider mb-1.5">
            Attachment
          </label>

          {/* Show existing file or pending file */}
          {(formData.file || pendingFile) ? (
            <div className="flex items-center gap-3 p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
              <FileText size={20} className="text-neutral-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm sm:text-base text-neutral-700 truncate">
                  {pendingFile?.name || formData.file?.name}
                </p>
                <p className="text-xs sm:text-sm text-neutral-400">
                  {formatFileSize(pendingFile?.size || formData.file?.size || 0)}
                  {pendingFile && <span className="ml-2 text-amber-600">(pending upload)</span>}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-neutral-200 rounded-lg cursor-pointer hover:border-neutral-300 hover:bg-neutral-50 transition-colors"
            >
              <Upload size={24} className="text-neutral-400" />
              <p className="text-sm sm:text-base text-neutral-500 text-center">
                Click to upload PDF or document
              </p>
              <p className="text-xs text-neutral-400">
                Max 50MB
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />

          {fileError && (
            <p className="text-sm text-red-500 mt-2">{fileError}</p>
          )}

          {/* Upload progress */}
          {uploading && (
            <div className="mt-3">
              <div className="flex items-center gap-2 mb-1">
                <Loader2 size={14} className="animate-spin text-neutral-500" />
                <span className="text-sm text-neutral-500">Uploading...</span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-1.5">
                <div
                  className="bg-neutral-700 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4 pt-4 border-t border-neutral-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-base text-neutral-500 hover:text-neutral-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!formData.title.trim() || uploading}
            className="px-5 py-2.5 text-base bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading && <Loader2 size={16} className="animate-spin" />}
            {paper ? 'Save Changes' : 'Add Paper'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
