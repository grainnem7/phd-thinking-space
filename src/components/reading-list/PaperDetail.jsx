import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ArrowLeft, ExternalLink, Star, Trash2, Copy, Check, FileText, Download, Upload, X, BookOpen, Pencil, Plus, Lock } from 'lucide-react';
import TabEditor from './TabEditor';
import PdfViewer from './PdfViewer';
import InlineError from './InlineError';
import { generateInTextCitation, CITATION_STYLES } from '../../utils/paperMetadata';
import { useStorage } from '../../hooks/useStorage';
import { useAuth } from '../../hooks/useAuth';
import { useFirestore } from '../../hooks/useFirestore';
import { createId } from '../../hooks/useReadingList';
import { useConfirm } from '../common/ConfirmDialog';

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

const FALLBACK_TABS = [{ id: 'notes', name: 'Notes' }];
const SAVE_DELAY = 500;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const LABEL = 'block text-xs uppercase tracking-widest text-neutral-400 dark:text-neutral-500';
const MUTED_BUTTON = 'text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-100 transition-colors';
const SELECT = 'bg-transparent dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 focus:border-neutral-400 dark:focus:border-neutral-500 outline-none text-neutral-900 dark:text-neutral-100 py-1';

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// File Section Component
function FileSection({ paper, onUpdate, onOpenViewer }) {
  const { user } = useAuth();
  const { uploadFile, deleteFile, canUpload, uploading, uploadProgress } = useStorage();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    // Reset input so the same file can be picked again
    e.target.value = '';
    if (!file || !user) return;
    setError(null);

    const allowedTypes = ['application/pdf', 'application/epub+zip'];
    const allowedExtension = /\.(pdf|epub)$/i.test(file.name);
    if (!allowedTypes.includes(file.type) && !allowedExtension) {
      setError('Please choose a PDF or EPUB file.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('File size must be less than 50MB.');
      return;
    }

    try {
      const fileData = await uploadFile(file, `users/${user.uid}/papers`);
      await onUpdate({ file: fileData });
    } catch (err) {
      console.error('Error uploading file:', err);
      setError(err?.message?.startsWith('Sign in') ? err.message : 'Failed to upload the file. Please try again.');
    }
  };

  const handleDeleteFile = async () => {
    if (!paper.file?.path) return;
    setError(null);
    try {
      await deleteFile(paper.file.path);
      await onUpdate({ file: null });
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Error deleting file:', err);
      setError('Failed to remove the file. Please try again.');
    }
  };

  const isPdf = paper.file?.name?.toLowerCase().endsWith('.pdf') || paper.file?.type === 'application/pdf';

  return (
    <section className="mb-8">
      <h2 className={`${LABEL} mb-3`}>Attached File</h2>

      {paper.file ? (
        <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 rounded-xl">
          <FileText size={20} className="text-neutral-400 shrink-0" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-neutral-900 dark:text-neutral-100 truncate">{paper.file.name}</p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">{formatFileSize(paper.file.size)}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onOpenViewer && isPdf && (
              <button
                type="button"
                onClick={onOpenViewer}
                className={`p-2 rounded-lg ${MUTED_BUTTON}`}
                aria-label="Open PDF in viewer"
                title="Open in viewer"
              >
                <BookOpen size={16} />
              </button>
            )}
            <a
              href={paper.file.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`p-2 rounded-lg ${MUTED_BUTTON}`}
              title="Download file"
              aria-label="Download file"
            >
              <Download size={16} />
            </a>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleDeleteFile}
                  className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 px-2 py-1"
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className={`text-xs px-2 py-1 ${MUTED_BUTTON}`}
                >
                  Cancel
                </button>
              </div>
            ) : canUpload && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 rounded-lg text-neutral-400 hover:text-rose-600 dark:text-neutral-500 dark:hover:text-rose-400 transition-colors"
                aria-label="Remove attached file"
                title="Remove file"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      ) : !canUpload ? (
        <div className="flex items-center gap-3 p-3 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-500 dark:text-neutral-400">
          <Lock size={16} className="text-neutral-400 shrink-0" aria-hidden="true" />
          <span>Sign in to attach PDFs</span>
        </div>
      ) : uploading ? (
        <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 rounded-xl" role="status">
          <div className="flex items-center justify-between gap-3 mb-2 text-sm text-neutral-600 dark:text-neutral-300">
            <span className="flex items-center gap-2">
              <Upload size={16} className="text-neutral-400 animate-pulse" aria-hidden="true" />
              Uploading…
            </span>
            <span className="tabular-nums text-xs text-neutral-400">{Math.round(uploadProgress)}%</span>
          </div>
          <div className="w-full h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-neutral-500 dark:bg-neutral-300 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      ) : (
        <label className="flex items-center gap-3 p-3 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl cursor-pointer hover:border-neutral-400 dark:hover:border-neutral-500 focus-within:ring-2 focus-within:ring-neutral-300 dark:focus-within:ring-neutral-600 transition-colors">
          <Upload size={16} className="text-neutral-400" aria-hidden="true" />
          <span className="text-sm text-neutral-600 dark:text-neutral-300">Upload PDF or EPUB</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.epub,application/pdf,application/epub+zip"
            onChange={handleFileSelect}
            className="sr-only"
          />
        </label>
      )}

      <InlineError message={error} onDismiss={() => setError(null)} className="mt-3" />
    </section>
  );
}

function readCitationStyle() {
  try {
    return localStorage.getItem('citation-style') || 'harvard';
  } catch {
    return 'harvard';
  }
}

// Reference Section Component
function ReferenceSection({ paper }) {
  const [copied, setCopied] = useState(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const [styleId, setStyleId] = useState(readCitationStyle);

  useEffect(() => {
    try {
      localStorage.setItem('citation-style', styleId);
    } catch {
      // Storage unavailable (private mode): the choice lasts for this visit
    }
  }, [styleId]);

  const style = CITATION_STYLES.find((s) => s.id === styleId) || CITATION_STYLES[0];
  const reference = style.generate(paper);
  const inTextCite = generateInTextCitation(paper);
  const isCode = styleId === 'bibtex';

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFailed(false);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopyFailed(true);
    }
  };

  const copyButton = (text, type, label) => (
    <button
      type="button"
      onClick={() => copyToClipboard(text, type)}
      aria-label={label}
      className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-100 shrink-0 transition-colors"
    >
      {copied === type ? <Check size={12} /> : <Copy size={12} />}
      <span aria-live="polite">{copied === type ? 'Copied!' : 'Copy'}</span>
    </button>
  );

  return (
    <section className="mt-8 pt-8 border-t border-neutral-200 dark:border-neutral-800">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className={LABEL}>Reference</h2>
        <select
          value={styleId}
          onChange={(e) => setStyleId(e.target.value)}
          aria-label="Citation style"
          className="text-xs bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 cursor-pointer"
        >
          {CITATION_STYLES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          {isCode ? (
            <pre className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed flex-1 min-w-0 bg-neutral-50 dark:bg-neutral-800 px-3 py-2 rounded-lg font-mono whitespace-pre-wrap break-all">
              {reference}
            </pre>
          ) : (
            <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed flex-1 min-w-0 break-words">
              {reference}
            </p>
          )}
          {copyButton(reference, 'reference', 'Copy reference')}
        </div>
      </div>

      <div>
        <span className="text-xs text-neutral-400 dark:text-neutral-500 block mb-2">In-text</span>
        <div className="flex items-center justify-between gap-4">
          <code className="text-sm text-neutral-700 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-800 px-2 py-1 rounded min-w-0 break-words">{inTextCite}</code>
          {copyButton(inTextCite, 'intext', 'Copy in-text citation')}
        </div>
      </div>

      {copyFailed && (
        <InlineError
          message="Couldn't copy to the clipboard. Select the text and copy it manually."
          onDismiss={() => setCopyFailed(false)}
          className="mt-4"
        />
      )}
    </section>
  );
}

function optionClass(active) {
  return `block text-sm text-left transition-colors ${active
    ? 'text-neutral-900 dark:text-neutral-100'
    : 'text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-300'}`;
}

export default function PaperDetail({
  paper,
  collections,
  onBack,
  onUpdate,
  onDelete,
  onSetCollection,
  onAddTab,
  onRenameTab,
  onDeleteTab,
  onUpdateTabContent,
  onAppendToTab,
  onOpenNote,
}) {
  const confirm = useConfirm();
  const { sections } = useFirestore();
  const tabs = paper.tabs?.length ? paper.tabs : FALLBACK_TABS;

  const [activeTabId, setActiveTabId] = useState(tabs[0].id);
  const [addedTabId, setAddedTabId] = useState(null);
  const [editingTabId, setEditingTabId] = useState(null);
  const [editingTabName, setEditingTabName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [error, setError] = useState(null);
  const [pendingQuote, setPendingQuote] = useState(null); // { tabId, marker }
  const [editorRevision, setEditorRevision] = useState(0);

  const editorRef = useRef(null);
  const cancelRenameRef = useRef(false);
  const deletedTabIdsRef = useRef(new Set());

  // Latest callbacks for timers and unmount flushes
  const onUpdateRef = useRef(onUpdate);
  const onUpdateTabContentRef = useRef(onUpdateTabContent);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onUpdateTabContentRef.current = onUpdateTabContent;
  }, [onUpdate, onUpdateTabContent]);

  // Runs a save and turns a failure into an inline message
  const run = useCallback(async (action, message) => {
    try {
      return await action();
    } catch (e) {
      console.error(message, e);
      setError(message);
      return undefined;
    }
  }, []);

  // A tab removed elsewhere falls back to the first tab. A tab just added here
  // may not be in the list until the write reaches this snapshot.
  const currentTabId = tabs.some((t) => t.id === activeTabId) || activeTabId === addedTabId
    ? activeTabId
    : tabs[0].id;

  // ---- Summary: local draft, debounced save, flushed on blur and unmount ----
  const storedSummary = paper.summary || '';
  const [summary, setSummary] = useState(storedSummary);
  const [syncedSummary, setSyncedSummary] = useState(storedSummary);
  const [summaryDirty, setSummaryDirty] = useState(false);
  const summaryTimeoutRef = useRef(null);
  const pendingSummaryRef = useRef(null);

  // Pick up changes made elsewhere unless there are unsaved local edits
  if (storedSummary !== syncedSummary) {
    setSyncedSummary(storedSummary);
    if (!summaryDirty) setSummary(storedSummary);
  }

  const flushSummary = useCallback(() => {
    clearTimeout(summaryTimeoutRef.current);
    summaryTimeoutRef.current = null;
    const value = pendingSummaryRef.current;
    if (value === null) return;
    pendingSummaryRef.current = null;
    setSummaryDirty(false);
    run(() => onUpdateRef.current({ summary: value }), "Couldn't save the summary.");
  }, [run]);

  const handleSummaryChange = (value) => {
    setSummary(value);
    setSummaryDirty(true);
    pendingSummaryRef.current = value;
    clearTimeout(summaryTimeoutRef.current);
    summaryTimeoutRef.current = setTimeout(flushSummary, SAVE_DELAY);
  };

  useEffect(() => () => flushSummary(), [flushSummary]);

  // ---- Tabs ----
  const selectTab = (tabId) => {
    setActiveTabId(tabId);
    setEditingTabId(null);
  };

  const startRename = (tab) => {
    cancelRenameRef.current = false;
    setEditingTabId(tab.id);
    setEditingTabName(tab.name);
  };

  const handleAddTab = () => {
    const newTabId = createId('tab');
    setAddedTabId(newTabId);
    setActiveTabId(newTabId);
    cancelRenameRef.current = false;
    setEditingTabId(newTabId);
    setEditingTabName('New Tab');
    run(() => onAddTab(newTabId, 'New Tab'), "Couldn't add the tab.");
  };

  const handleRenameTab = (tabId, newName) => {
    setEditingTabId(null);
    if (cancelRenameRef.current) {
      cancelRenameRef.current = false;
      return;
    }
    const name = newName.trim();
    const tab = tabs.find((t) => t.id === tabId);
    if (!name || (tab && tab.name === name)) return;
    run(() => onRenameTab(tabId, name), "Couldn't rename the tab. Check your connection and try again.");
  };

  const handleDeleteTab = async (tabId) => {
    if (tabs.length <= 1) return;

    const tab = tabs.find((t) => t.id === tabId);
    const hasContent = !!(paper.tabContent?.[tabId]);
    const ok = await confirm({
      title: tab ? `Delete tab "${tab.name}"?` : 'Delete tab?',
      body: hasContent
        ? 'The notes in this tab will be permanently deleted. This cannot be undone.'
        : 'This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    // Pending edits in the closing editor must not recreate the tab's notes
    deletedTabIdsRef.current.add(tabId);
    if (currentTabId === tabId) {
      setActiveTabId(tabs.find((t) => t.id !== tabId)?.id);
    }
    run(() => onDeleteTab(tabId), "Couldn't delete the tab. Check your connection and try again.");
  };

  const handleTabContentChange = useCallback((tabId, content) => {
    if (deletedTabIdsRef.current.has(tabId)) return undefined;
    return run(() => onUpdateTabContentRef.current(tabId, content), "Couldn't save your notes.");
  }, [run]);

  const handleEditorChange = useCallback(
    (content) => handleTabContentChange(currentTabId, content),
    [handleTabContentChange, currentTabId],
  );

  // Append a quoted passage to the paper's "Quotes" tab (created if missing):
  // the quote in italics and a "— page N" attribution.
  const handleAddQuoteFromViewer = useCallback(async ({ text, page }) => {
    if (!text) return false;
    // Save pending edits first so the append builds on them
    await editorRef.current?.flush();

    const baseProps = { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' };
    const quoteId = createId('quote');
    const blocks = [
      {
        id: quoteId,
        type: 'paragraph',
        props: baseProps,
        content: [{ type: 'text', text: `"${text}"`, styles: { italic: true } }],
        children: [],
      },
      {
        id: createId('cite'),
        type: 'paragraph',
        props: baseProps,
        content: [{ type: 'text', text: `— page ${page}`, styles: {} }],
        children: [],
      },
    ];

    try {
      const tabId = await onAppendToTab('Quotes', blocks);
      setActiveTabId(tabId);
      setEditingTabId(null);
      // Reload the editor once the stored content includes the quote
      setPendingQuote({ tabId, marker: quoteId });
      return true;
    } catch (e) {
      console.error('Could not add quote:', e);
      setError("Couldn't add the quote. Check your connection and try again.");
      return false;
    }
  }, [onAppendToTab]);

  if (pendingQuote && (paper.tabContent?.[pendingQuote.tabId] || '').includes(pendingQuote.marker)) {
    setPendingQuote(null);
    setEditorRevision((r) => r + 1);
  }

  const toggleCollection = (collectionId) => {
    const included = !(paper.collections || []).includes(collectionId);
    run(() => onSetCollection(collectionId, included), "Couldn't update the collection.");
  };

  const update = (updates) => run(() => onUpdate(updates), "Couldn't save the change.");

  // Notes whose content mentions this paper's title (case-insensitive substring
  // of the stored BlockNote JSON). Cheap and index-free; misses DOI-only mentions.
  const mentioningNotes = useMemo(() => {
    const title = (paper.title || '').toLowerCase().trim();
    if (!title || title.length < 4) return [];
    return sections.filter((s) => {
      if (s.type !== 'note' || !s.content) return false;
      return s.content.toLowerCase().includes(title);
    });
  }, [sections, paper.title]);

  const deleteControls = (compact) => (
    showDeleteConfirm ? (
      <div className={compact ? 'flex items-center gap-3' : 'space-y-3'}>
        {!compact && <p className="text-sm text-neutral-600 dark:text-neutral-300">Delete this paper?</p>}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onDelete}
            className="text-sm text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 transition-colors"
          >
            {compact ? 'Confirm delete' : 'Delete'}
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(false)}
            className={`text-sm ${MUTED_BUTTON}`}
          >
            Cancel
          </button>
        </div>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setShowDeleteConfirm(true)}
        className="text-sm text-neutral-400 hover:text-rose-600 dark:text-neutral-500 dark:hover:text-rose-400 transition-colors flex items-center gap-1.5"
        aria-label="Delete paper"
      >
        <Trash2 size={14} aria-hidden="true" />
        <span className={compact ? 'sr-only' : ''}>Delete paper</span>
      </button>
    )
  );

  return (
    <div className="flex-1 bg-white dark:bg-neutral-900 min-h-0 min-w-0 flex flex-col">
      {/* Nav bar */}
      <nav className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 z-10 shrink-0" aria-label="Paper">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className={`text-sm flex items-center gap-1 p-1 -m-1 rounded ${MUTED_BUTTON}`}
            aria-label="Back to reading list"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="flex items-center gap-4 sm:gap-6 text-sm">
            <button
              type="button"
              onClick={() => update({ starred: !paper.starred })}
              aria-pressed={Boolean(paper.starred)}
              aria-label={paper.starred ? 'Unstar paper' : 'Star paper'}
              className={`flex items-center gap-1 p-1 -m-1 rounded transition-colors ${paper.starred
                ? 'text-amber-600 dark:text-amber-400'
                : MUTED_BUTTON}`}
            >
              <Star size={16} fill={paper.starred ? 'currentColor' : 'none'} aria-hidden="true" />
              <span className="hidden sm:inline">{paper.starred ? 'Starred' : 'Star'}</span>
            </button>
            {paper.url && (
              <a
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open paper link in a new tab"
                className={`flex items-center gap-1 p-1 -m-1 rounded ${MUTED_BUTTON}`}
              >
                <ExternalLink size={16} aria-hidden="true" />
                <span className="hidden sm:inline">Open</span>
              </a>
            )}
          </div>
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <InlineError message={error} onDismiss={() => setError(null)} className="mb-6" />

          {/* Mobile/Tablet: Compact metadata bar at top */}
          <div className="reading-list-sidebar lg:hidden mb-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm border-b border-neutral-200 dark:border-neutral-800 pb-6">
            <label className="flex items-center gap-2">
              <span className="text-neutral-400 dark:text-neutral-500">Status</span>
              <select
                value={paper.status || 'to-read'}
                onChange={(e) => update({ status: e.target.value })}
                className={SELECT}
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2">
              <span className="text-neutral-400 dark:text-neutral-500">Priority</span>
              <select
                value={paper.priority || ''}
                onChange={(e) => update({ priority: e.target.value || null })}
                className={SELECT}
              >
                {PRIORITY_OPTIONS.map(opt => (
                  <option key={opt.id || 'none'} value={opt.id || ''}>{opt.label}</option>
                ))}
              </select>
            </label>

            {collections.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap min-w-0" role="group" aria-label="Collections">
                <span className="text-neutral-400 dark:text-neutral-500">Collections</span>
                <div className="flex flex-wrap gap-1">
                  {collections.map(col => {
                    const active = (paper.collections || []).includes(col.id);
                    return (
                      <button
                        type="button"
                        key={col.id}
                        onClick={() => toggleCollection(col.id)}
                        aria-pressed={active}
                        className={`px-2 py-0.5 rounded-full text-xs transition-colors ${active
                          ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'}`}
                      >
                        {col.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="ml-auto">{deleteControls(true)}</div>
          </div>

          <div className="flex gap-12">
            {/* Main content */}
            <main className="flex-1 min-w-0">
              <h1 className="font-serif text-2xl sm:text-4xl tracking-tight text-neutral-900 dark:text-neutral-100 mb-2 break-words">
                {paper.title}
              </h1>

              {(paper.authors || paper.year) && (
                <p className="text-base sm:text-lg text-neutral-500 dark:text-neutral-400 mb-8 break-words">
                  {paper.authors}{paper.authors && paper.year && ' · '}{paper.year}
                </p>
              )}

              <FileSection paper={paper} onUpdate={onUpdate} onOpenViewer={() => setViewerOpen(true)} />

              {/* Summary */}
              <div className="mb-8">
                <label htmlFor={`summary-${paper.id}`} className={`${LABEL} mb-3`}>
                  Summary
                </label>
                <textarea
                  id={`summary-${paper.id}`}
                  value={summary}
                  onChange={(e) => handleSummaryChange(e.target.value)}
                  onBlur={flushSummary}
                  placeholder="Add a summary..."
                  className="w-full min-h-[100px] px-0 py-2 bg-transparent border-b border-neutral-200 dark:border-neutral-700 focus:border-neutral-400 dark:focus:border-neutral-500 outline-none text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 resize-none"
                />
              </div>

              <ReferenceSection paper={paper} />

              {/* Mentioned in N notes */}
              {mentioningNotes.length > 0 && (
                <section className="mt-8 pt-8 border-t border-neutral-200 dark:border-neutral-800">
                  <h2 className={`${LABEL} mb-3`}>
                    Mentioned in {mentioningNotes.length} {mentioningNotes.length === 1 ? 'note' : 'notes'}
                  </h2>
                  <ul className="space-y-1">
                    {mentioningNotes.slice(0, 10).map((note) => (
                      <li key={note.id}>
                        {onOpenNote ? (
                          <button
                            type="button"
                            onClick={() => onOpenNote(note.id)}
                            className="flex items-center gap-2 max-w-full py-1 text-sm text-left text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100 hover:underline underline-offset-2 rounded transition-colors"
                          >
                            <FileText size={14} className="text-neutral-400 shrink-0" aria-hidden="true" />
                            <span className="truncate">{note.name || 'Untitled'}</span>
                          </button>
                        ) : (
                          <span className="flex items-center gap-2 py-1 text-sm text-neutral-600 dark:text-neutral-300">
                            <FileText size={14} className="text-neutral-400 shrink-0" aria-hidden="true" />
                            <span className="truncate">{note.name || 'Untitled'}</span>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {mentioningNotes.length > 10 && (
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">+{mentioningNotes.length - 10} more</p>
                  )}
                </section>
              )}

              <div className="border-t border-neutral-200 dark:border-neutral-800 my-8" />

              {/* Tabs */}
              <div className="mb-6">
                <div className="reading-list-tabs flex items-center gap-x-4 sm:gap-x-6 gap-y-2 text-sm flex-wrap" role="tablist" aria-label="Paper notes">
                  {tabs.map(tab => {
                    const isActive = currentTabId === tab.id;
                    return (
                      <div key={tab.id} className="flex items-center gap-1">
                        {editingTabId === tab.id ? (
                          <input
                            value={editingTabName}
                            onChange={(e) => setEditingTabName(e.target.value)}
                            onBlur={() => handleRenameTab(tab.id, editingTabName)}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.currentTarget.blur();
                              if (e.key === 'Escape') {
                                cancelRenameRef.current = true;
                                e.currentTarget.blur();
                              }
                            }}
                            aria-label="Tab name"
                            className="border-b border-neutral-400 dark:border-neutral-500 focus:outline-none bg-transparent text-neutral-900 dark:text-neutral-100 w-28"
                            autoFocus
                          />
                        ) : (
                          <button
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            data-active={isActive}
                            onClick={() => selectTab(tab.id)}
                            onDoubleClick={() => startRename(tab)}
                            onKeyDown={(e) => {
                              if (e.key === 'F2') startRename(tab);
                            }}
                            className={`py-1 transition-colors ${isActive
                              ? 'text-neutral-900 dark:text-neutral-100 font-medium'
                              : 'text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-300'}`}
                          >
                            {tab.name}
                          </button>
                        )}

                        {isActive && editingTabId !== tab.id && (
                          <>
                            <button
                              type="button"
                              onClick={() => startRename(tab)}
                              aria-label={`Rename tab ${tab.name}`}
                              title="Rename tab"
                              className="p-1 rounded text-neutral-300 hover:text-neutral-700 dark:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                            >
                              <Pencil size={12} />
                            </button>
                            {tabs.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteTab(tab.id)}
                                aria-label={`Delete tab ${tab.name}`}
                                title="Delete tab"
                                className="p-1 rounded text-neutral-300 hover:text-rose-600 dark:text-neutral-600 dark:hover:text-rose-400 transition-colors"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={handleAddTab}
                    aria-label="Add tab"
                    title="Add tab"
                    className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">Double-click a tab (or press F2) to rename it</p>
              </div>

              {/* Tab content - BlockNote editor */}
              <div className="min-h-[300px]" role="tabpanel" aria-label={tabs.find((t) => t.id === currentTabId)?.name || 'Notes'}>
                <TabEditor
                  key={`${currentTabId}:${editorRevision}`}
                  ref={editorRef}
                  content={paper.tabContent?.[currentTabId] || ''}
                  onChange={handleEditorChange}
                />
              </div>
            </main>

            {/* Sidebar - Desktop only */}
            <aside className="reading-list-sidebar hidden lg:block w-56 shrink-0 space-y-8">
              <div role="group" aria-labelledby="paper-status-label">
                <h2 id="paper-status-label" className={`${LABEL} mb-3`}>Status</h2>
                <div className="space-y-2">
                  {STATUS_OPTIONS.map(option => {
                    const active = (paper.status || 'to-read') === option.id;
                    return (
                      <button
                        type="button"
                        key={option.id}
                        onClick={() => update({ status: option.id })}
                        aria-pressed={active}
                        className={optionClass(active)}
                      >
                        {active && <span className="mr-2" aria-hidden="true">•</span>}
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div role="group" aria-labelledby="paper-priority-label">
                <h2 id="paper-priority-label" className={`${LABEL} mb-3`}>Priority</h2>
                <div className="space-y-2">
                  {PRIORITY_OPTIONS.map(option => {
                    const active = (paper.priority || null) === option.id;
                    return (
                      <button
                        type="button"
                        key={option.id || 'none'}
                        onClick={() => update({ priority: option.id })}
                        aria-pressed={active}
                        className={optionClass(active)}
                      >
                        {active && <span className="mr-2" aria-hidden="true">•</span>}
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {collections.length > 0 && (
                <div role="group" aria-labelledby="paper-collections-label">
                  <h2 id="paper-collections-label" className={`${LABEL} mb-3`}>Collections</h2>
                  <div className="space-y-2">
                    {collections.map(col => {
                      const active = (paper.collections || []).includes(col.id);
                      return (
                        <button
                          type="button"
                          key={col.id}
                          onClick={() => toggleCollection(col.id)}
                          aria-pressed={active}
                          className={optionClass(active)}
                        >
                          {active && <span className="mr-2" aria-hidden="true">•</span>}
                          {col.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
                {deleteControls(false)}
              </div>
            </aside>
          </div>
        </div>
      </div>

      {viewerOpen && paper.file?.url && (
        <PdfViewer
          url={paper.file.url}
          onClose={() => setViewerOpen(false)}
          onAddQuote={handleAddQuoteFromViewer}
        />
      )}
    </div>
  );
}
