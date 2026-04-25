import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNotes } from '../../hooks/useNotes';
import { Cloud, CloudOff, Clock, Download, FileText, Trash2, Maximize2, Minimize2, BookOpen } from 'lucide-react';
import BlockNoteEditor from '../editors/BlockNoteEditor';
import { DOCXExporter, docxDefaultSchemaMappings } from "@blocknote/xl-docx-exporter";
import { Packer } from "docx";
import { PDFExporter, pdfDefaultSchemaMappings } from "@blocknote/xl-pdf-exporter";
import { pdf } from "@react-pdf/renderer";
import { useConfirm } from '../common/ConfirmDialog';
import { useFocusMode } from '../../contexts/FocusModeContext';
import { useReadingList } from '../../hooks/useReadingList';
import { generateInTextCitation } from '../../utils/paperMetadata';
import Modal from '../common/Modal';

// Walk a BlockNote document tree and concatenate inline text. Returns "" for malformed input.
function extractTextFromBlocks(blocks) {
  if (!Array.isArray(blocks)) return '';
  let out = '';
  for (const block of blocks) {
    if (Array.isArray(block?.content)) {
      for (const inline of block.content) {
        if (typeof inline?.text === 'string') out += inline.text + ' ';
      }
    } else if (typeof block?.content === 'string') {
      out += block.content + ' ';
    }
    if (Array.isArray(block?.children) && block.children.length) {
      out += extractTextFromBlocks(block.children);
    }
  }
  return out;
}

function countWords(content) {
  if (!content) return { words: 0, chars: 0 };
  let parsed = content;
  if (typeof content === 'string') {
    try { parsed = JSON.parse(content); } catch { return { words: 0, chars: 0 }; }
  }
  const text = extractTextFromBlocks(parsed).trim();
  return {
    words: text ? text.split(/\s+/).length : 0,
    chars: text.length,
  };
}

export default function NoteEditor({ note, updateSection, onDelete }) {
  const confirm = useConfirm();
  const { focusMode, toggle: toggleFocusMode } = useFocusMode();
  const { papers } = useReadingList();
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [titleDraft, setTitleDraft] = useState(note?.name || '');
  const [wordStats, setWordStats] = useState(() => countWords(note?.content));
  const [citePickerOpen, setCitePickerOpen] = useState(false);
  const [citeQuery, setCiteQuery] = useState('');
  const wordCountTimeoutRef = useRef(null);
  const { isSaving, lastSaved, error, debouncedSave } = useNotes(note?.id, updateSection);
  const editorRef = useRef(null);

  const filteredPapers = useMemo(() => {
    if (!citeQuery.trim()) return papers;
    const q = citeQuery.toLowerCase();
    return papers.filter((p) =>
      (p.title || '').toLowerCase().includes(q) ||
      (p.authors || '').toLowerCase().includes(q) ||
      String(p.year || '').includes(q)
    );
  }, [papers, citeQuery]);

  const insertCitation = (paper) => {
    const citation = generateInTextCitation(paper);
    const editor = editorRef.current?.getEditor();
    if (editor) {
      try {
        editor.insertInlineContent([{ type: 'text', text: citation, styles: {} }]);
      } catch (e) {
        // Fallback: copy to clipboard if direct insert fails
        navigator.clipboard?.writeText(citation);
      }
    } else {
      navigator.clipboard?.writeText(citation);
    }
    setCitePickerOpen(false);
    setCiteQuery('');
  };

  // Sync local title draft when navigating to a different note or when name changes externally
  useEffect(() => {
    setTitleDraft(note?.name || '');
  }, [note?.id, note?.name]);

  // Reset word count when switching notes
  useEffect(() => {
    setWordStats(countWords(note?.content));
  }, [note?.id]);

  const handleChange = useCallback((newContent) => {
    debouncedSave(newContent);
    if (wordCountTimeoutRef.current) clearTimeout(wordCountTimeoutRef.current);
    wordCountTimeoutRef.current = setTimeout(() => {
      setWordStats(countWords(newContent));
    }, 500);
  }, [debouncedSave]);

  useEffect(() => {
    return () => {
      if (wordCountTimeoutRef.current) clearTimeout(wordCountTimeoutRef.current);
    };
  }, []);

  const saveTitle = async () => {
    if (!note || !updateSection) return;
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      setTitleDraft(note.name);
      return;
    }
    if (trimmed === note.name) return;
    await updateSection(note.id, { name: trimmed });
  };

  const formatLastSaved = () => {
    if (!lastSaved) return null;
    const now = new Date();
    const diff = Math.floor((now - lastSaved) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return lastSaved.toLocaleTimeString();
  };

  const handleExportDocx = async () => {
    if (!editorRef.current) {
      console.error('Editor ref not available');
      return;
    }

    setIsExportingDocx(true);
    try {
      const editor = editorRef.current.getEditor();
      if (!editor) {
        console.error('Editor not available');
        return;
      }

      const exporter = new DOCXExporter(editor.schema, docxDefaultSchemaMappings);
      const docxDocument = await exporter.toDocxJsDocument(editor.document);

      // Use toBlob for browser environments
      const blob = await Packer.toBlob(docxDocument);

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${note.name || 'document'}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please check the console for details.');
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleDelete = async () => {
    if (!note || !onDelete) return;
    const ok = await confirm({
      title: `Delete "${note.name}"?`,
      body: 'This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) onDelete(note.id);
  };

  const handleExportPdf = async () => {
    if (!editorRef.current) {
      console.error('Editor ref not available');
      return;
    }

    setIsExportingPdf(true);
    try {
      const editor = editorRef.current.getEditor();
      if (!editor) {
        console.error('Editor not available');
        return;
      }

      const exporter = new PDFExporter(editor.schema, pdfDefaultSchemaMappings);
      const pdfDocument = await exporter.toReactPDFDocument(editor.document);

      // Use pdf().toBlob() for browser environments
      const blob = await pdf(pdfDocument).toBlob();

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${note.name || 'document'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF Export failed:', error);
      alert('PDF Export failed. Please check the console for details.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#fafafa] dark:bg-neutral-950">
        <div className="text-center">
          <p className="text-sm text-neutral-400 dark:text-neutral-500">No note selected</p>
          <p className="text-xs text-neutral-300 dark:text-neutral-600 mt-1">Select a note from the sidebar to start editing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-neutral-900 relative">
      {/* Minimal status bar */}
      {!focusMode && (
        <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-100 dark:border-neutral-800">
          <span className="text-xs text-neutral-400 dark:text-neutral-500 tabular-nums">
            {wordStats.words.toLocaleString()} {wordStats.words === 1 ? 'word' : 'words'}
            <span className="text-neutral-300 dark:text-neutral-600"> · </span>
            {wordStats.chars.toLocaleString()} {wordStats.chars === 1 ? 'char' : 'chars'}
          </span>
          <div className="flex items-center gap-4">
            <button
              onClick={handleExportDocx}
              disabled={isExportingDocx || isExportingPdf}
              className="text-xs text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors disabled:opacity-50"
            >
              {isExportingDocx ? 'Exporting...' : 'DOCX'}
            </button>
            <button
              onClick={handleExportPdf}
              disabled={isExportingDocx || isExportingPdf}
              className="text-xs text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors disabled:opacity-50"
            >
              {isExportingPdf ? 'Exporting...' : 'PDF'}
            </button>
            <span className="text-xs text-neutral-300 dark:text-neutral-600">
              {isSaving ? 'Saving...' : lastSaved ? `Saved ${formatLastSaved()}` : ''}
            </span>
            {error && (
              <span className="text-xs text-red-500" title={error}>
                Save failed
              </span>
            )}
            <button
              onClick={() => setCitePickerOpen(true)}
              aria-label="Cite a paper"
              title="Cite a paper"
              className="text-neutral-300 hover:text-neutral-600 dark:text-neutral-600 dark:hover:text-neutral-300 transition-colors p-1"
            >
              <BookOpen size={16} />
            </button>
            <button
              onClick={toggleFocusMode}
              aria-label="Enter focus mode"
              title="Focus mode (Ctrl+Shift+F)"
              className="text-neutral-300 hover:text-neutral-600 dark:text-neutral-600 dark:hover:text-neutral-300 transition-colors p-1"
            >
              <Maximize2 size={16} />
            </button>
            {onDelete && (
              <button
                onClick={handleDelete}
                aria-label={`Delete ${note.name}`}
                title="Delete note"
                className="text-neutral-300 hover:text-red-500 dark:text-neutral-600 dark:hover:text-red-400 transition-colors p-1"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      )}
      {focusMode && (
        <button
          onClick={toggleFocusMode}
          aria-label="Exit focus mode"
          title="Exit focus mode (Esc or Ctrl+Shift+F)"
          className="fixed top-4 right-4 z-30 text-neutral-300 hover:text-neutral-600 dark:text-neutral-600 dark:hover:text-neutral-300 transition-colors p-2 bg-white/80 dark:bg-neutral-900/80 rounded-lg backdrop-blur-sm"
        >
          <Minimize2 size={16} />
        </button>
      )}

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-10 pt-10 pb-2">
          <input
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              }
              if (e.key === 'Escape') {
                setTitleDraft(note.name);
                e.currentTarget.blur();
              }
            }}
            placeholder="Untitled"
            aria-label="Note title"
            className="w-full font-serif text-3xl sm:text-4xl font-medium text-neutral-900 dark:text-neutral-100 tracking-tight bg-transparent focus:outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-600"
          />
        </div>
        <div className="max-w-3xl mx-auto px-10 pb-10">
          <BlockNoteEditor key={note?.id} ref={editorRef} content={note?.content} onChange={handleChange} />
        </div>
      </div>

      <Modal
        isOpen={citePickerOpen}
        onClose={() => { setCitePickerOpen(false); setCiteQuery(''); }}
        title="Cite a paper"
        size="md"
      >
        <input
          type="text"
          value={citeQuery}
          onChange={(e) => setCiteQuery(e.target.value)}
          placeholder="Search by title, author, or year…"
          autoFocus
          className="w-full px-3 py-2.5 mb-4 text-base bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-neutral-300 dark:focus:border-neutral-600 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-neutral-900 dark:text-neutral-100"
        />
        {filteredPapers.length === 0 ? (
          <p className="text-sm text-neutral-400 dark:text-neutral-500 py-6 text-center">
            {papers.length === 0 ? 'No papers in your reading list yet.' : 'No papers match your search.'}
          </p>
        ) : (
          <ul className="max-h-[50vh] overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
            {filteredPapers.slice(0, 50).map((paper) => (
              <li key={paper.id}>
                <button
                  onClick={() => insertCitation(paper)}
                  className="w-full text-left p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-lg transition-colors group"
                >
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{paper.title || 'Untitled'}</p>
                  {(paper.authors || paper.year) && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                      {paper.authors}{paper.authors && paper.year ? ` · ` : ''}{paper.year}
                    </p>
                  )}
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 font-mono">
                    Insert: {generateInTextCitation(paper)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
