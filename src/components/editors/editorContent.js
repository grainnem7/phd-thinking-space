import { useEffect, useRef } from 'react';

// Stored note content is BlockNote JSON. Older notes (and demo data) may hold
// Markdown or plain text instead.
export function parseContent(content) {
  if (!content) return undefined;
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // Not JSON — handled by useLegacyContent
  }
  return undefined;
}

function isLegacyText(content) {
  return typeof content === 'string' && content.trim() !== '' && parseContent(content) === undefined;
}

// Converts Markdown/plain-text content into blocks once the editor exists,
// instead of opening a blank document that the first keystroke would overwrite.
export function useLegacyContent(editor, content) {
  const converted = useRef(false);
  useEffect(() => {
    if (converted.current || !editor || !isLegacyText(content)) return;
    converted.current = true;
    try {
      const blocks = editor.tryParseMarkdownToBlocks(content);
      if (blocks.length > 0) editor.replaceBlocks(editor.document, blocks);
    } catch (e) {
      console.error('Could not convert note content:', e);
    }
  }, [editor, content]);
}
