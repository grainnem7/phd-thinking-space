import { useCallback, useEffect, useRef } from 'react';
import { SuggestionMenuController, useExtension } from '@blocknote/react';
import { SuggestionMenu } from '@blocknote/core/extensions';
import { FileText, FilePlus } from 'lucide-react';
import { NOTE_LINK_TYPE, isLinkableNote } from './noteLinks';
import { normalizeText } from '../../lib/search';

const MAX_ITEMS = 8;
const TRIGGER = '[[';

// Typing `[[` opens a menu of notes to link to, ending with "Create note".
export default function NoteLinkMenu({ editor, notes, currentNoteId, onCreateNote }) {
  // getItems reads the latest notes without re-registering the menu
  const latest = useRef({ notes, currentNoteId, onCreateNote });
  useEffect(() => {
    latest.current = { notes, currentNoteId, onCreateNote };
  }, [notes, currentNoteId, onCreateNote]);

  // BlockNote 0.45 only recognises single-character triggers when typing
  // (its multi-character check compares one character too many), so watch for
  // "[[" before the cursor and open the menu ourselves.
  const suggestionMenu = useExtension(SuggestionMenu);
  useEffect(() => editor.onChange(() => {
    const view = editor.prosemirrorView;
    if (!view || !editor.isEditable || suggestionMenu.shown()) return;
    const { selection } = view.state;
    const { $from } = selection;
    if (!selection.empty || $from.parent.type.spec.code || $from.parentOffset < TRIGGER.length) return;
    const before = $from.parent.textBetween($from.parentOffset - TRIGGER.length, $from.parentOffset, undefined, '￼');
    if (before !== TRIGGER) return;
    const pos = selection.from;
    // Replace the typed brackets with a tracked trigger once this update finishes
    queueMicrotask(() => {
      if (editor.prosemirrorView?.state.selection.from !== pos || suggestionMenu.shown()) return;
      editor.transact((tr) => tr.delete(pos - TRIGGER.length, pos));
      suggestionMenu.openSuggestionMenu(TRIGGER, { deleteTriggerCharacter: true });
    });
  }), [editor, suggestionMenu]);

  const insertLink = useCallback((noteId, name) => {
    editor.insertInlineContent([
      { type: NOTE_LINK_TYPE, props: { noteId, name } },
      ' ',
    ]);
  }, [editor]);

  const getItems = useCallback(async (query) => {
    const { notes: all = [], currentNoteId: currentId, onCreateNote: create } = latest.current;
    const text = query.replace(/\]+$/, '').trim();
    const q = normalizeText(text);
    const matches = all
      .filter((n) => isLinkableNote(n) && n.id !== currentId && normalizeText(n.name).includes(q))
      .map((n) => ({ note: n, norm: normalizeText(n.name) }))
      .sort((a, b) => Number(!a.norm.startsWith(q)) - Number(!b.norm.startsWith(q)) || a.norm.localeCompare(b.norm))
      .slice(0, MAX_ITEMS);

    const items = matches.map(({ note }) => ({
      title: note.name || 'Untitled',
      icon: <FileText size={16} />,
      group: 'Link to note',
      onItemClick: () => insertLink(note.id, note.name || 'Untitled'),
    }));

    const exact = matches.some(({ norm }) => norm === q);
    if (text && !exact && create) {
      items.push({
        title: `Create note "${text}"`,
        subtext: 'New note next to this one',
        icon: <FilePlus size={16} />,
        group: 'Link to note',
        onItemClick: async () => {
          const id = await create(text);
          if (id) insertLink(id, text);
        },
      });
    }
    return items;
  }, [insertLink]);

  return <SuggestionMenuController triggerCharacter={TRIGGER} getItems={getItems} />;
}
