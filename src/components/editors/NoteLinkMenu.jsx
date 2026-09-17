import { useCallback, useEffect, useRef } from 'react';
import { SuggestionMenuController } from '@blocknote/react';
import { FileText, FilePlus } from 'lucide-react';
import { NOTE_LINK_TYPE, isLinkableNote } from './noteLinks';
import { normalizeText } from '../../lib/search';

const MAX_ITEMS = 8;

// Typing `[[` opens a menu of notes to link to, ending with "Create note".
export default function NoteLinkMenu({ editor, notes, currentNoteId, onCreateNote }) {
  // getItems reads the latest notes without re-registering the menu
  const latest = useRef({ notes, currentNoteId, onCreateNote });
  useEffect(() => {
    latest.current = { notes, currentNoteId, onCreateNote };
  }, [notes, currentNoteId, onCreateNote]);

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

  return <SuggestionMenuController triggerCharacter="[[" getItems={getItems} />;
}
