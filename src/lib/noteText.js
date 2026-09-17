// Plain text from stored note content: BlockNote JSON, or legacy Markdown/plain text.

function inlineText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) {
    // Tables: { type: 'tableContent', rows: [{ cells: [[inline...]] }] }
    if (content?.rows) {
      return content.rows.map((row) => (row.cells || []).map((cell) => inlineText(cell?.content ?? cell)).join(' ')).join(' ');
    }
    return '';
  }
  return content.map((part) => {
    if (typeof part?.text === 'string') return part.text;
    if (Array.isArray(part?.content)) return inlineText(part.content); // links
    if (part?.props?.name) return part.props.name; // custom inline content, e.g. note links
    return '';
  }).join('');
}

export function blocksToText(blocks) {
  if (!Array.isArray(blocks)) return '';
  const lines = [];
  for (const block of blocks) {
    const text = inlineText(block?.content);
    if (text) lines.push(text);
    if (Array.isArray(block?.children) && block.children.length) {
      const childText = blocksToText(block.children);
      if (childText) lines.push(childText);
    }
  }
  return lines.join('\n');
}

export function contentToText(content) {
  if (!content) return '';
  if (Array.isArray(content)) return blocksToText(content);
  if (typeof content !== 'string') return '';
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return blocksToText(parsed);
  } catch {
    // Legacy Markdown: strip the most common syntax
  }
  return content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+(\[[ xX]\]\s+)?/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[*_`>]/g, '');
}

export function countWords(text) {
  const trimmed = (text || '').trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
