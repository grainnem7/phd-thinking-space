import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { forwardRef, useImperativeHandle, useMemo } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { parseContent, useLegacyContent } from "./editorContent";
import { noteSchema } from "./noteSchema";
import { NoteLinkContext, isLinkableNote } from "./noteLinks";
import NoteLinkMenu from "./NoteLinkMenu";

const NO_NOTES = [];

// Note editor. `notes` (sections), `onOpenNote` and `onCreateNote` enable
// [[links]] between notes.
const BlockNoteEditor = forwardRef(function BlockNoteEditor(
  { content, onChange, notes = NO_NOTES, currentNoteId, onOpenNote, onCreateNote },
  ref,
) {
  const { isDark } = useTheme();
  const editor = useCreateBlockNote({
    schema: noteSchema,
    initialContent: parseContent(content),
  });

  useLegacyContent(editor, content);

  // Expose editor methods to parent via ref
  useImperativeHandle(ref, () => ({
    getEditor: () => editor,
  }), [editor]);

  const linkContext = useMemo(() => ({
    notesById: new Map(notes.filter(isLinkableNote).map((n) => [n.id, n])),
    onOpenNote,
  }), [notes, onOpenNote]);

  return (
    <NoteLinkContext.Provider value={linkContext}>
      <BlockNoteView
        editor={editor}
        onChange={() => {
          onChange(JSON.stringify(editor.document));
        }}
        theme={isDark ? 'dark' : 'light'}
      >
        <NoteLinkMenu
          editor={editor}
          notes={notes}
          currentNoteId={currentNoteId}
          onCreateNote={onCreateNote}
        />
      </BlockNoteView>
    </NoteLinkContext.Provider>
  );
});

export default BlockNoteEditor;
