import { useCallback, useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, Quote } from 'lucide-react';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import { useTheme } from '../../contexts/ThemeContext';

// Wire up the pdfjs worker. Using the Vite ?url import gives us a hashed
// asset URL that ships with the build, so the worker loads from the same
// origin (no CORS issues, works offline via the service worker).
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export default function PdfViewer({ url, onClose, onAddQuote }) {
  const { isDark } = useTheme();
  const containerRef = useRef(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selection, setSelection] = useState(null); // { text, rect, page }
  const [quoteAdded, setQuoteAdded] = useState(false);

  const onDocumentLoad = useCallback(({ numPages: n }) => {
    setNumPages(n);
    setLoading(false);
  }, []);

  const onDocumentError = useCallback((e) => {
    console.error('PDF load error:', e);
    setError(e?.message || 'Failed to load PDF');
    setLoading(false);
  }, []);

  // Track text selection inside the viewer container
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setSelection(null);
        return;
      }
      const text = sel.toString().trim();
      if (!text) {
        setSelection(null);
        return;
      }
      // Confirm the selection is inside our container
      const node = sel.anchorNode;
      if (!node || !containerRef.current?.contains(node)) {
        setSelection(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      setSelection({
        text,
        // Position the floating button just above the selection's top edge
        top: rect.top - containerRect.top + containerRef.current.scrollTop - 40,
        left: rect.left - containerRect.left + Math.max(0, rect.width / 2) - 60,
        page: pageNumber,
      });
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [pageNumber]);

  // Esc closes the viewer
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'ArrowLeft') setPageNumber((p) => Math.max(1, p - 1));
      if (e.key === 'ArrowRight') setPageNumber((p) => Math.min(numPages || p, p + 1));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, numPages]);

  const handleAddQuote = () => {
    if (!selection || !onAddQuote) return;
    onAddQuote({ text: selection.text, page: selection.page });
    setQuoteAdded(true);
    window.getSelection()?.removeAllRanges();
    setSelection(null);
    setTimeout(() => setQuoteAdded(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-40 bg-neutral-950/90 dark:bg-black/95 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            aria-label="Previous page"
            className="p-2 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm tabular-nums text-neutral-600 dark:text-neutral-300 min-w-[80px] text-center">
            {pageNumber} / {numPages || '–'}
          </span>
          <button
            onClick={() => setPageNumber((p) => Math.min(numPages || p, p + 1))}
            disabled={pageNumber >= numPages}
            aria-label="Next page"
            className="p-2 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
            aria-label="Zoom out"
            className="p-2 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition-colors"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-sm tabular-nums text-neutral-600 dark:text-neutral-300 min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(3, s + 0.2))}
            aria-label="Zoom in"
            className="p-2 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition-colors"
          >
            <ZoomIn size={18} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {quoteAdded && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">Quote added</span>
          )}
          <button
            onClick={onClose}
            aria-label="Close PDF viewer"
            title="Close (Esc)"
            className="p-2 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* PDF page */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto relative"
        // Disable native dark inversion of canvas content; we rely on parent bg
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-300">
            <div className="w-6 h-6 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-300">
            <div className="text-center">
              <p>Could not load PDF.</p>
              <p className="text-xs mt-1 opacity-70">{error}</p>
            </div>
          </div>
        )}
        <div className="flex justify-center py-6">
          <Document
            file={url}
            onLoadSuccess={onDocumentLoad}
            onLoadError={onDocumentError}
            loading={null}
            error={null}
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer
              renderAnnotationLayer
              className={isDark ? 'shadow-2xl' : 'shadow-2xl'}
            />
          </Document>
        </div>

        {/* Floating "Add to quotes" button when text is selected */}
        {selection && onAddQuote && (
          <button
            onClick={handleAddQuote}
            className="absolute z-10 flex items-center gap-1.5 px-3 py-1.5 text-sm bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg shadow-lg hover:opacity-90 transition-opacity"
            style={{ top: `${selection.top}px`, left: `${selection.left}px` }}
          >
            <Quote size={14} />
            Add to quotes
          </button>
        )}
      </div>
    </div>
  );
}
