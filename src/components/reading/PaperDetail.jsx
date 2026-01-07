import { useState, useRef } from 'react';
import { ArrowLeft, ExternalLink, Trash2, X, FileText, Download, Upload, Loader2 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useStorage } from '../../hooks/useStorage';
import { useAuth } from '../../hooks/useAuth';

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

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
  const { user } = useAuth();
  const { uploadFile, deleteFile, uploading, uploadProgress } = useStorage();
  const fileInputRef = useRef(null);

  const [notes, setNotes] = useState(paper.notes || '');
  const [tagInput, setTagInput] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [fileError, setFileError] = useState(null);

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

  // File handling
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setFileError('Please upload a PDF, Word document, or text file');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setFileError('File size must be less than 50MB');
      return;
    }

    setPendingFile(file);
  };

  const handleUploadFile = async () => {
    if (!pendingFile) return;

    try {
      const uploadPath = `users/${user.uid}/papers`;
      const fileData = await uploadFile(pendingFile, uploadPath);
      await onUpdate({ file: fileData });
      setPendingFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setFileError('Failed to upload file. Please try again.');
    }
  };

  const handleRemoveFile = async () => {
    if (paper.file?.path) {
      await deleteFile(paper.file.path);
    }
    await onUpdate({ file: null });
    setPendingFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCancelPendingFile = () => {
    setPendingFile(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <main className="flex-1 overflow-auto bg-[#fafafa]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm sm:text-base text-neutral-400 hover:text-neutral-600 transition-colors mb-6 sm:mb-8"
        >
          <ArrowLeft size={18} />
          Back to Reading List
        </button>

        {/* Title */}
        <h1 className="font-serif text-2xl sm:text-3xl font-medium text-neutral-900 tracking-tight">
          {paper.title}
        </h1>

        {/* Authors & Year */}
        {(paper.authors || paper.year) && (
          <p className="text-lg sm:text-xl text-neutral-500 mt-2">
            {paper.authors}{paper.authors && paper.year && ' · '}{paper.year}
          </p>
        )}

        {/* Venue */}
        {paper.venue && (
          <p className="text-base sm:text-lg text-neutral-400 mt-1">{paper.venue}</p>
        )}

        {/* URL & DOI */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-4">
          {paper.url && (
            <a
              href={paper.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm sm:text-base text-blue-600 hover:text-blue-700 transition-colors"
            >
              <ExternalLink size={16} />
              Open paper
            </a>
          )}
          {paper.doi && (
            <a
              href={`https://doi.org/${paper.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm sm:text-base text-neutral-500 hover:text-neutral-700 transition-colors truncate max-w-[200px] sm:max-w-none"
            >
              DOI: {paper.doi}
            </a>
          )}
        </div>

        {/* Status & Priority */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-6 sm:gap-8 mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-neutral-200">
          <div>
            <label className="block text-xs sm:text-sm text-neutral-400 uppercase tracking-wider mb-2">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleStatusChange(opt.id)}
                  className={`px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg transition-colors ${
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
            <label className="block text-xs sm:text-sm text-neutral-400 uppercase tracking-wider mb-2">
              Priority
            </label>
            <div className="flex flex-wrap gap-2">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.id ?? 'none'}
                  onClick={() => handlePriorityChange(opt.id)}
                  className={`px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg transition-colors ${
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
        <div className="mt-6 sm:mt-8">
          <label className="block text-xs sm:text-sm text-neutral-400 uppercase tracking-wider mb-2">
            Tags
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {paper.tags?.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-neutral-100 text-neutral-600 text-sm sm:text-base rounded-full"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <X size={16} />
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
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base bg-transparent border-none focus:outline-none placeholder:text-neutral-400 w-24 sm:w-28"
            />
          </div>
          {suggestedTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="text-xs sm:text-sm text-neutral-400">Suggestions:</span>
              {suggestedTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => addTag(tag)}
                  className="text-xs sm:text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
                >
                  +{tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="mt-6 sm:mt-8">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs sm:text-sm text-neutral-400 uppercase tracking-wider">
              Notes
            </label>
            {isSavingNotes && (
              <span className="text-xs sm:text-sm text-neutral-400">Saving...</span>
            )}
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Add your notes about this paper..."
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-base sm:text-lg bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-300 placeholder:text-neutral-400 min-h-[150px] sm:min-h-[200px] resize-y leading-relaxed"
          />
        </div>

        {/* File Attachment */}
        <div className="mt-6 sm:mt-8">
          <label className="block text-xs sm:text-sm text-neutral-400 uppercase tracking-wider mb-2">
            Attachment
          </label>

          {/* Existing file display */}
          {paper.file && !pendingFile && (
            <div className="flex items-center gap-3 p-3 sm:p-4 bg-white border border-neutral-200 rounded-xl">
              <FileText size={24} className="text-neutral-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm sm:text-base text-neutral-700 font-medium truncate">
                  {paper.file.name}
                </p>
                <p className="text-xs sm:text-sm text-neutral-400">
                  {formatFileSize(paper.file.size || 0)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={paper.file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                  title="Download file"
                >
                  <Download size={18} />
                </a>
                <button
                  onClick={handleRemoveFile}
                  className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Remove file"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          )}

          {/* Pending file to upload */}
          {pendingFile && (
            <div className="p-3 sm:p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-3">
                <FileText size={24} className="text-amber-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm sm:text-base text-neutral-700 font-medium truncate">
                    {pendingFile.name}
                  </p>
                  <p className="text-xs sm:text-sm text-amber-600">
                    {formatFileSize(pendingFile.size)} · Ready to upload
                  </p>
                </div>
                <button
                  onClick={handleCancelPendingFile}
                  className="p-2 text-neutral-400 hover:text-neutral-600 transition-colors"
                  title="Cancel"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Upload progress */}
              {uploading && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Loader2 size={14} className="animate-spin text-amber-600" />
                    <span className="text-sm text-amber-700">Uploading...</span>
                  </div>
                  <div className="w-full bg-amber-200 rounded-full h-1.5">
                    <div
                      className="bg-amber-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Upload button */}
              {!uploading && (
                <button
                  onClick={handleUploadFile}
                  className="mt-3 px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2"
                >
                  <Upload size={16} />
                  Upload File
                </button>
              )}
            </div>
          )}

          {/* Upload area when no file */}
          {!paper.file && !pendingFile && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 p-6 sm:p-8 border-2 border-dashed border-neutral-200 rounded-xl cursor-pointer hover:border-neutral-300 hover:bg-neutral-50 transition-colors"
            >
              <Upload size={28} className="text-neutral-400" />
              <p className="text-sm sm:text-base text-neutral-500 text-center">
                Click to upload PDF or document
              </p>
              <p className="text-xs text-neutral-400">
                PDF, Word, or text files up to 50MB
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
        </div>

        {/* Metadata */}
        <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-neutral-200">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-sm sm:text-base text-neutral-400">
            <span>Added {timeAgo(paper.createdAt)}</span>
            {paper.readAt && (
              <span>Read on {formatDate(paper.readAt)}</span>
            )}
          </div>
        </div>

        {/* Delete button */}
        <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-neutral-200">
          <button
            onClick={onDelete}
            className="flex items-center gap-2 text-sm sm:text-base text-neutral-400 hover:text-red-600 transition-colors"
          >
            <Trash2 size={16} />
            Delete paper
          </button>
        </div>
      </div>
    </main>
  );
}
