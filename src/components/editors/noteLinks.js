import { createContext } from 'react';

// Links between notes are a custom inline content node stored in BlockNote JSON:
//   { type: 'noteLink', props: { noteId, name } }
// `name` is the target's name when the link was made; the editor shows the live
// name while the note exists.
export const NOTE_LINK_TYPE = 'noteLink';

// What a rendered link needs from the app. `notesById` is undefined outside a
// note editor (e.g. HTML export), where links render with their stored name.
export const NoteLinkContext = createContext({ notesById: undefined, onOpenNote: undefined });

export const isLinkableNote = (section) => section && (section.type === 'note' || !section.type);

// Cheap check on stored JSON, without parsing every note
export function linksToNote(content, noteId) {
  return typeof content === 'string'
    && Boolean(noteId)
    && content.includes(`"${NOTE_LINK_TYPE}"`)
    && content.includes(`"noteId":${JSON.stringify(noteId)}`);
}

// Exporter mappings (DOCX / PDF) that write links as plain text
export function withNoteLinkMappings(mappings, nameFor) {
  return {
    ...mappings,
    inlineContentMapping: {
      ...mappings.inlineContentMapping,
      [NOTE_LINK_TYPE]: (inlineContent, exporter) => exporter.transformStyledText({
        type: 'text',
        text: nameFor(inlineContent.props) || 'Untitled',
        styles: {},
      }),
    },
  };
}
