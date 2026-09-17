import { useCallback, useRef, useEffect } from 'react';
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useTheme } from '../../contexts/ThemeContext';
import { parseContent, useLegacyContent } from '../editors/editorContent';

export default function TabEditor({ content, onChange }) {
  const timeoutRef = useRef(null);
  const initialContent = parseContent(content);

  const { isDark } = useTheme();
  const editor = useCreateBlockNote({
    initialContent,
  });
  useLegacyContent(editor, content);

  // Debounced save
  const handleChange = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      onChange(JSON.stringify(editor.document));
    }, 500);
  }, [editor, onChange]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="reading-list-editor">
      <BlockNoteView
        editor={editor}
        onChange={handleChange}
        theme={isDark ? 'dark' : 'light'}
      />
    </div>
  );
}
