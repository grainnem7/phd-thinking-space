import { BlockNoteSchema, defaultInlineContentSpecs } from '@blocknote/core';
import { createReactInlineContentSpec } from '@blocknote/react';
import { NOTE_LINK_TYPE } from './noteLinks';
import NoteLinkChip from './NoteLinkChip';

const NoteLink = createReactInlineContentSpec(
  {
    type: NOTE_LINK_TYPE,
    propSchema: {
      noteId: { default: '' },
      name: { default: '' },
    },
    content: 'none',
  },
  { render: NoteLinkChip },
);

// Schema for every editor that shows note content
export const noteSchema = BlockNoteSchema.create({
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    [NOTE_LINK_TYPE]: NoteLink,
  },
});
