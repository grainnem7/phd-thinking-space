import { useCallback, useRef, useEffect, useLayoutEffect, useImperativeHandle } from 'react';
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useTheme } from '../../contexts/ThemeContext';
import { parseContent, useLegacyContent } from '../editors/editorContent';

const SAVE_DELAY = 500;

// Editor for one paper tab. Changes are saved after a short pause and flushed
// immediately when the editor unmounts (switching tab or paper, leaving the
// page). `ref` exposes `flush()` so callers can save before writing to the
// same tab themselves.
export default function TabEditor({ content, onChange, ref }) {
  const timeoutRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const initialContent = parseContent(content);

  const { isDark } = useTheme();
  const editor = useCreateBlockNote({
    initialContent,
  });
  useLegacyContent(editor, content);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const flush = useCallback(() => {
    if (!timeoutRef.current) return undefined;
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    let json;
    try {
      json = JSON.stringify(editor.document);
    } catch (e) {
      console.error('Could not read tab content:', e);
      return undefined;
    }
    return onChangeRef.current?.(json);
  }, [editor]);

  // Debounced save
  const handleChange = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    // flush() only saves while a timer is pending
    timeoutRef.current = setTimeout(flush, SAVE_DELAY);
  }, [flush]);

  useImperativeHandle(ref, () => ({ flush }), [flush]);

  // Save pending edits on unmount. A layout-effect cleanup runs before the
  // BlockNote view below it is torn down, so the document is still readable.
  useLayoutEffect(() => () => {
    flush();
  }, [flush]);

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
