import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { forwardRef, useImperativeHandle } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { parseContent, useLegacyContent } from "./editorContent";

const BlockNoteEditor = forwardRef(function BlockNoteEditor({ content, onChange }, ref) {
  const { isDark } = useTheme();
  const editor = useCreateBlockNote({
    initialContent: parseContent(content),
  });

  useLegacyContent(editor, content);

  // Expose editor methods to parent via ref
  useImperativeHandle(ref, () => ({
    getEditor: () => editor,
  }), [editor]);

  return (
    <BlockNoteView
      editor={editor}
      onChange={() => {
        onChange(JSON.stringify(editor.document));
      }}
      theme={isDark ? 'dark' : 'light'}
    />
  );
});

export default BlockNoteEditor;
