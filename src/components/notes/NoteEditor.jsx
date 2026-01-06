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
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-1">No note selected</h3>
          <p className="text-slate-500">Select a note from the sidebar to start editing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <span>{note.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleExportDocx}
            disabled={isExportingDocx || isExportingPdf}
            className="flex items-center gap-1.5 px-3 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isExportingDocx ? 'Exporting...' : 'DOCX'}</span>
          </button>
          <button
            onClick={handleExportPdf}
            disabled={isExportingDocx || isExportingPdf}
            className="flex items-center gap-1.5 px-3 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            <span>{isExportingPdf ? 'Exporting...' : 'PDF'}</span>
          </button>
          <div className="flex items-center gap-2">
            {isSaving ? (
              <>
                <CloudOff className="w-4 h-4 animate-pulse" />
                <span>Saving...</span>
              </>
            ) : lastSaved ? (
              <>
                <Cloud className="w-4 h-4 text-green-500" />
                <span>Saved {formatLastSaved()}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          <BlockNoteEditor ref={editorRef} content={content} onChange={handleChange} />
        </div>
      </div>
    </div>
  );
}
