import { useCallback, useRef, useEffect } from 'react';
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";

function parseContent(content) {
  if (!content) return undefined;

  // Try to parse as JSON (BlockNote format)
  try {
    const parsed = JSON.parse(content);
    // Verify it's an array (BlockNote document format)
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (e) {
    // Not JSON, ignore
  }

  // Return undefined to let BlockNote create a fresh document
  return undefined;
}

export default function TabEditor({ content, onChange }) {
  const timeoutRef = useRef(null);
  const initialContent = parseContent(content);

  const editor = useCreateBlockNote({
    initialContent,
  });

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
        theme="light"
      />
    </div>
  );
}
