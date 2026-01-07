import { useState, useCallback, useRef, useEffect } from 'react';
import { ArrowLeft, ExternalLink, Star, Trash2, Copy, Check, FileText, Download, Upload, X } from 'lucide-react';
import TabEditor from './TabEditor';
import { generateHarvardReference, generateInTextCitation } from '../../utils/paperMetadata';
import { useStorage } from '../../hooks/useStorage';
import { useAuth } from '../../hooks/useAuth';

const STATUS_OPTIONS = [
  { id: 'to-read', label: 'To Read' },
  { id: 'reading', label: 'Reading' },
  { id: 'read', label: 'Completed' },
];

const PRIORITY_OPTIONS = [
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
  { id: null, label: 'None' },
];

// File Section Component
function FileSection({ paper, onUpdate }) {
  const { user } = useAuth();
  const { uploadFile, deleteFile, uploading, uploadProgress } = useStorage();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/epub+zip'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a PDF or EPUB file');
      return;
    }

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      alert('File size must be less than 50MB');
      return;
    }

    try {
      const fileData = await uploadFile(file, `users/${user.uid}/papers`);
      await onUpdate({ file: fileData });
    } catch (err) {
      console.error('Error uploading file:', err);
      alert('Failed to upload file. Please try again.');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async () => {
    if (!paper.file?.path) return;

    try {
      await deleteFile(paper.file.path);
      await onUpdate({ file: null });
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Error deleting file:', err);
      alert('Failed to delete file. Please try again.');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <section className="mb-8">
      <label className="block text-xs uppercase tracking-widest text-black/50 mb-3">
        Attached File
      </label>

      {paper.file ? (
        // File exists - show download and delete options
        <div className="flex items-center gap-3 p-3 bg-black/[0.02] rounded-lg">
          <FileText size={20} className="text-black/40 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-black truncate">{paper.file.name}</p>
            <p className="text-xs text-black/40">{formatFileSize(paper.file.size)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={paper.file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-black/40 hover:text-black transition-colors"
              title="Download file"
            >
              <Download size={16} />
            </a>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleDeleteFile}
                  className="text-xs text-red-600 hover:text-red-700 px-2 py-1"
                >
                  Remove
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-xs text-black/40 hover:text-black px-2 py-1"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 text-black/30 hover:text-red-600 transition-colors"
                title="Remove file"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      ) : (
        // No file - show upload option
        <div>
          {uploading ? (
            <div className="p-3 bg-black/[0.02] rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <Upload size={16} className="text-black/40 animate-pulse" />
                <span className="text-sm text-black/60">Uploading...</span>
              </div>
              <div className="w-full h-1 bg-black/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-black/40 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <label className="flex items-center gap-3 p-3 border border-dashed border-black/20 rounded-lg cursor-pointer hover:border-black/40 transition-colors">
              <Upload size={16} className="text-black/40" />
              <span className="text-sm text-black/60">Upload PDF or EPUB</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.epub,application/pdf,application/epub+zip"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          )}
        </div>
      )}
    </section>
  );
}

// Reference Section Component
function ReferenceSection({ paper }) {
  const [copied, setCopied] = useState(null);

  const harvardRef = generateHarvardReference(paper);
  const inTextCite = generateInTextCitation(paper);

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <section className="mt-8 pt-8 border-t border-black/5">
      <label className="block text-xs uppercase tracking-widest text-black/50 mb-4">
        Reference
      </label>

      {/* Harvard Reference */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm text-black/70 leading-relaxed flex-1">
            {harvardRef}
          </p>
          <button
            onClick={() => copyToClipboard(harvardRef, 'harvard')}
            className="flex items-center gap-1 text-xs text-black/30 hover:text-black shrink-0 transition-colors"
          >
            {copied === 'harvard' ? (
              <>
                <Check size={12} />
                Copied!
              </>
            ) : (
              <>
                <Copy size={12} />
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* In-text Citation */}
      <div>
        <label className="text-xs text-black/30 block mb-2">In-text</label>
        <div className="flex items-center justify-between gap-4">
          <code className="text-sm text-black/70 bg-black/5 px-2 py-1 rounded">{inTextCite}</code>
          <button
            onClick={() => copyToClipboard(inTextCite, 'intext')}
            className="flex items-center gap-1 text-xs text-black/30 hover:text-black shrink-0 transition-colors"
          >
            {copied === 'intext' ? (
              <>
                <Check size={12} />
                Copied!
              </>
            ) : (
              <>
                <Copy size={12} />
                Copy
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}

export default function PaperDetail({ paper, collections, onBack, onUpdate, onDelete }) {
  const [activeTabId, setActiveTabId] = useState(paper.tabs?.[0]?.id || 'notes');
  const [editingTabId, setEditingTabId] = useState(null);
  const [editingTabName, setEditingTabName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [localSummary, setLocalSummary] = useState(paper.summary || '');
  const summaryTimeoutRef = useRef(null);

  // Update local summary when paper changes
  useEffect(() => {
    setLocalSummary(paper.summary || '');
  }, [paper.id, paper.summary]);

  // Debounced summary update
  const handleSummaryChange = (value) => {
    setLocalSummary(value);
    if (summaryTimeoutRef.current) {
      clearTimeout(summaryTimeoutRef.current);
    }
    summaryTimeoutRef.current = setTimeout(() => {
      onUpdate({ summary: value });
    }, 500);
  };

  // Tab management
  const handleAddTab = async () => {
    const newTabId = `tab-${Date.now()}`;
    const newTab = { id: newTabId, name: 'New Tab' };
    const updatedTabs = [...(paper.tabs || []), newTab];
    await onUpdate({
      tabs: updatedTabs,
      tabContent: { ...(paper.tabContent || {}), [newTabId]: '' }
    });
    setActiveTabId(newTabId);
    setEditingTabId(newTabId);
    setEditingTabName('New Tab');
  };

  const handleRenameTab = async (tabId, newName) => {
    if (!newName.trim()) {
      setEditingTabId(null);
      return;
    }
    const updatedTabs = (paper.tabs || []).map(tab =>
      tab.id === tabId ? { ...tab, name: newName.trim() } : tab
    );
    await onUpdate({ tabs: updatedTabs });
    setEditingTabId(null);
  };

  const handleDeleteTab = async (tabId) => {
    if ((paper.tabs || []).length <= 1) return;

    const updatedTabs = (paper.tabs || []).filter(tab => tab.id !== tabId);
    const updatedContent = { ...(paper.tabContent || {}) };
    delete updatedContent[tabId];

    await onUpdate({ tabs: updatedTabs, tabContent: updatedContent });

    // Switch to another tab if we deleted the active one
    if (activeTabId === tabId) {
      setActiveTabId(updatedTabs[0]?.id);
    }
  };

  const handleTabContentChange = useCallback((tabId, content) => {
    onUpdate({
      tabContent: { ...(paper.tabContent || {}), [tabId]: content }
    });
  }, [paper.tabContent, onUpdate]);

  const toggleCollection = (collectionId) => {
    const currentCollections = paper.collections || [];
    const newCollections = currentCollections.includes(collectionId)
      ? currentCollections.filter(id => id !== collectionId)
      : [...currentCollections, collectionId];
    onUpdate({ collections: newCollections });
  };

  const tabs = paper.tabs || [{ id: 'notes', name: 'Notes' }];

  return (
    <div className="flex-1 bg-white min-h-0 flex flex-col">
      {/* Nav bar */}
      <nav className="border-b border-black/5 bg-white z-10 shrink-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-sm text-black/40 hover:text-black transition-opacity flex items-center gap-1"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="flex items-center gap-4 sm:gap-6 text-sm">
            <button
              onClick={() => onUpdate({ starred: !paper.starred })}
              className={`flex items-center gap-1 transition-opacity ${paper.starred ? 'text-black' : 'text-black/40 hover:text-black'}`}
            >
              <Star size={16} fill={paper.starred ? 'currentColor' : 'none'} />
              <span className="hidden sm:inline">{paper.starred ? 'Starred' : 'Star'}</span>
            </button>
            {paper.url && (
              <a
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-black/40 hover:text-black transition-opacity flex items-center gap-1"
              >
                <ExternalLink size={16} />
                <span className="hidden sm:inline">Open</span>
              </a>
            )}
          </div>
        </div>
      </nav>

      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {/* Mobile/Tablet: Compact metadata bar at top */}
          <div className="lg:hidden mb-8 flex flex-wrap items-center gap-4 text-sm border-b border-black/5 pb-6">
            {/* Status dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-black/40">Status:</span>
              <select
                value={paper.status || 'to-read'}
                onChange={(e) => onUpdate({ status: e.target.value })}
                className="bg-transparent border-b border-black/20 focus:border-black/40 outline-none text-black py-1"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Priority dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-black/40">Priority:</span>
              <select
                value={paper.priority || ''}
                onChange={(e) => onUpdate({ priority: e.target.value || null })}
                className="bg-transparent border-b border-black/20 focus:border-black/40 outline-none text-black py-1"
              >
                {PRIORITY_OPTIONS.map(opt => (
                  <option key={opt.id || 'none'} value={opt.id || ''}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Collections (if any) */}
            {collections.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-black/40">Collections:</span>
                <div className="flex flex-wrap gap-1">
                  {collections.map(col => (
                    <button
                      key={col.id}
                      onClick={() => toggleCollection(col.id)}
                      className={`px-2 py-0.5 rounded text-xs transition-colors ${
                        (paper.collections || []).includes(col.id)
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

            {/* Delete - mobile */}
            <div className="ml-auto">
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={onDelete}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="text-xs text-black/40 hover:text-black"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-black/30 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-12">
            {/* Main content */}
            <main className="flex-1 min-w-0">
              {/* Title */}
            <h1 className="font-serif text-2xl sm:text-4xl tracking-tight text-black mb-2">
              {paper.title}
            </h1>

            {/* Authors & Year */}
            {(paper.authors || paper.year) && (
              <p className="text-base sm:text-lg text-black/40 mb-8">
                {paper.authors}{paper.authors && paper.year && ' · '}{paper.year}
              </p>
            )}

            {/* Attached File */}
            <FileSection paper={paper} onUpdate={onUpdate} />

            {/* Summary */}
            <div className="mb-8">
              <label className="block text-xs uppercase tracking-widest text-black/50 mb-3">
                Summary
              </label>
              <textarea
                value={localSummary}
                onChange={(e) => handleSummaryChange(e.target.value)}
                placeholder="Add a summary..."
                className="w-full min-h-[100px] px-0 py-2 border-b border-black/10 focus:border-black/30 outline-none text-black placeholder:text-black/30 resize-none"
              />
            </div>

            {/* Reference Section */}
            <ReferenceSection paper={paper} />

            {/* Divider */}
            <div className="border-t border-black/5 my-8" />

            {/* Tabs */}
            <div className="mb-6">
              <div className="flex items-center gap-4 sm:gap-6 text-sm flex-wrap">
                {tabs.map(tab => (
                  <div key={tab.id} className="relative group">
                    {editingTabId === tab.id ? (
                      <input
                        value={editingTabName}
                        onChange={(e) => setEditingTabName(e.target.value)}
                        onBlur={() => handleRenameTab(tab.id, editingTabName)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameTab(tab.id, editingTabName);
                          if (e.key === 'Escape') setEditingTabId(null);
                        }}
                        className="border-b border-black/30 focus:outline-none bg-transparent w-24"
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => setActiveTabId(tab.id)}
                        onDoubleClick={() => {
                          setEditingTabId(tab.id);
                          setEditingTabName(tab.name);
                        }}
                        className={`transition-opacity ${activeTabId === tab.id ? 'text-black' : 'text-black/30 hover:text-black/60'}`}
                      >
                        {tab.name}
                      </button>
                    )}

                    {tabs.length > 1 && activeTabId === tab.id && !editingTabId && (
                      <button
                        onClick={() => handleDeleteTab(tab.id)}
                        className="absolute -right-4 top-0 text-black/20 hover:text-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}

                <button
                  onClick={handleAddTab}
                  className="text-black/20 hover:text-black/40 transition-opacity"
                >
                  +
                </button>
              </div>
              <p className="text-xs text-black/20 mt-2">Double-click tab name to rename</p>
            </div>

            {/* Tab content - BlockNote editor */}
            <div className="min-h-[300px]">
              <TabEditor
                key={activeTabId}
                content={paper.tabContent?.[activeTabId] || ''}
                onChange={(content) => handleTabContentChange(activeTabId, content)}
              />
            </div>
          </main>

          {/* Sidebar - Desktop only */}
          <aside className="hidden lg:block w-56 shrink-0 space-y-8">
            {/* Status */}
            <div>
              <label className="block text-xs uppercase tracking-widest text-black/50 mb-3">
                Status
              </label>
              <div className="space-y-2">
                {STATUS_OPTIONS.map(option => (
                  <button
                    key={option.id}
                    onClick={() => onUpdate({ status: option.id })}
                    className={`block text-sm transition-opacity ${paper.status === option.id ? 'text-black' : 'text-black/30 hover:text-black/60'}`}
                  >
                    {paper.status === option.id && <span className="mr-2">•</span>}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs uppercase tracking-widest text-black/50 mb-3">
                Priority
              </label>
              <div className="space-y-2">
                {PRIORITY_OPTIONS.map(option => (
                  <button
                    key={option.id || 'none'}
                    onClick={() => onUpdate({ priority: option.id })}
                    className={`block text-sm transition-opacity ${paper.priority === option.id ? 'text-black' : 'text-black/30 hover:text-black/60'}`}
                  >
                    {paper.priority === option.id && <span className="mr-2">•</span>}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Collections */}
            {collections.length > 0 && (
              <div>
                <label className="block text-xs uppercase tracking-widest text-black/50 mb-3">
                  Collections
                </label>
                <div className="space-y-2">
                  {collections.map(col => (
                    <button
                      key={col.id}
                      onClick={() => toggleCollection(col.id)}
                      className={`block text-sm transition-opacity ${(paper.collections || []).includes(col.id) ? 'text-black' : 'text-black/30 hover:text-black/60'}`}
                    >
                      {(paper.collections || []).includes(col.id) && <span className="mr-2">•</span>}
                      {col.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Delete */}
            <div className="pt-4 border-t border-black/5">
              {showDeleteConfirm ? (
                <div className="space-y-3">
                  <p className="text-sm text-black/60">Delete this paper?</p>
                  <div className="flex gap-3">
                    <button
                      onClick={onDelete}
                      className="text-sm text-red-600 hover:text-red-700 transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="text-sm text-black/40 hover:text-black transition-opacity"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-sm text-black/30 hover:text-red-600 transition-colors flex items-center gap-1"
                >
                  <Trash2 size={14} />
                  Delete paper
                </button>
              )}
            </div>
          </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
