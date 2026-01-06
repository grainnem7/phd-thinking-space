import { useState, useEffect, useCallback, useRef } from 'react';
import { useNotes } from '../../hooks/useNotes';
import { Cloud, CloudOff, Clock, Download, FileText } from 'lucide-react';
import BlockNoteEditor from '../editors/BlockNoteEditor';
import { DOCXExporter, docxDefaultSchemaMappings } from "@blocknote/xl-docx-exporter";
import { Packer } from "docx";
import { PDFExporter, pdfDefaultSchemaMappings } from "@blocknote/xl-pdf-exporter";
import { pdf } from "@react-pdf/renderer";

export default function NoteEditor({ note }) {
  const [content, setContent] = useState('');
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const { isSaving, lastSaved, debouncedSave } = useNotes(note?.id);
  const editorRef = useRef(null);

  useEffect(() => {
    if (note?.content !== undefined) {
      setContent(note.content);
    }
  }, [note?.id, note?.content]);

  const handleChange = useCallback((newContent) => {
    setContent(newContent);
    debouncedSave(newContent);
  }, [debouncedSave]);

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
      <div className="flex-1 flex items-center justify-center bg-[#fafafa]">
        <div className="text-center">
          <p className="text-sm text-neutral-400">No note selected</p>
          <p className="text-xs text-neutral-300 mt-1">Select a note from the sidebar to start editing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Minimal status bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-100">
        <span className="text-sm text-neutral-400">{note.name}</span>
        <div className="flex items-center gap-4">
          <button
            onClick={handleExportDocx}
            disabled={isExportingDocx || isExportingPdf}
            className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors disabled:opacity-50"
          >
            {isExportingDocx ? 'Exporting...' : 'DOCX'}
          </button>
          <button
            onClick={handleExportPdf}
            disabled={isExportingDocx || isExportingPdf}
            className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors disabled:opacity-50"
          >
            {isExportingPdf ? 'Exporting...' : 'PDF'}
          </button>
          <span className="text-xs text-neutral-300">
            {isSaving ? 'Saving...' : lastSaved ? `Saved ${formatLastSaved()}` : ''}
          </span>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-10 py-10">
          <BlockNoteEditor ref={editorRef} content={content} onChange={handleChange} />
        </div>
      </div>
    </div>
  );
}
