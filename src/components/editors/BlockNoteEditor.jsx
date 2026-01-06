import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { forwardRef, useImperativeHandle } from "react";

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
  // The content will be plain text that needs migration
  return undefined;
}

const BlockNoteEditor = forwardRef(function BlockNoteEditor({ content, onChange }, ref) {
  const editor = useCreateBlockNote({
    initialContent: parseContent(content),
  });

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
      theme="light"
    />
  );
});

export default BlockNoteEditor;
