import { useMemo, useState } from 'react';
import { FileText, LayoutTemplate, Search, Trash2 } from 'lucide-react';
import Modal from '../common/Modal';
import { useConfirm } from '../common/ConfirmDialog';
import { useFirestore } from '../../hooks/useFirestore';
import { useTemplates } from '../../hooks/useTemplates';
import { BUILT_IN_TEMPLATES, fillPlaceholders } from './builtInTemplates';
import { normalizeText } from '../../lib/search';

const LABEL = 'text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-widest font-medium';
const BLANK_ID = 'blank';

// Lines for the preview pane, from Markdown or BlockNote JSON
function previewLines(template) {
  if (template.markdown !== undefined) {
    return fillPlaceholders(template.markdown).split('\n').map((line) => {
      const heading = line.match(/^(#{1,3})\s+(.*)/);
      if (heading) return { kind: heading[1].length === 1 ? 'h1' : 'h2', text: heading[2] };
      const check = line.match(/^\s*[-*]\s+\[[ xX]\]\s?(.*)/);
      if (check) return { kind: 'check', text: check[1] };
      const bullet = line.match(/^\s*(?:[-*]|\d+\.)\s?(.*)/);
      if (bullet) return { kind: 'li', text: bullet[1] };
      const quote = line.match(/^>\s?(.*)/);
      if (quote) return { kind: 'quote', text: quote[1] };
      return { kind: 'p', text: line.replace(/\*\*(.*?)\*\*/g, '$1') };
    });
  }
  let blocks = [];
  try {
    blocks = JSON.parse(template.content || '[]');
  } catch {
    return [{ kind: 'p', text: template.content || '' }];
  }
  const lines = [];
  const walk = (list) => {
    for (const block of Array.isArray(list) ? list : []) {
      const text = Array.isArray(block.content)
        ? block.content.map((c) => c.text ?? c.props?.name ?? (c.content || []).map((x) => x.text).join('')).join('')
        : '';
      const kind = block.type === 'heading' ? (block.props?.level === 1 ? 'h1' : 'h2')
        : block.type === 'checkListItem' ? 'check'
          : block.type === 'bulletListItem' || block.type === 'numberedListItem' ? 'li'
            : block.type === 'quote' ? 'quote' : 'p';
      lines.push({ kind, text: fillPlaceholders(text) });
      if (block.children?.length) walk(block.children);
    }
  };
  walk(blocks);
  return lines;
}

function Preview({ template }) {
  if (!template) return null;
  if (template.id === BLANK_ID) {
    return <p className="text-sm text-neutral-400 dark:text-neutral-500">An empty note.</p>;
  }
  const lines = previewLines(template);
  return (
    <div className="space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
      {lines.map((line, i) => {
        if (line.kind === 'h1') return <p key={i} className="font-serif text-lg text-neutral-900 dark:text-neutral-100 pt-2">{line.text}</p>;
        if (line.kind === 'h2') return <p key={i} className="font-serif text-base font-medium text-neutral-900 dark:text-neutral-100 pt-2">{line.text}</p>;
        if (line.kind === 'check') return <p key={i} className="pl-1 flex gap-2"><span aria-hidden="true" className="text-neutral-400">☐</span>{line.text}</p>;
        if (line.kind === 'li') return <p key={i} className="pl-1 flex gap-2"><span aria-hidden="true" className="text-neutral-400">•</span>{line.text}</p>;
        if (line.kind === 'quote') return <p key={i} className="pl-3 border-l-2 border-neutral-200 dark:border-neutral-700 italic">{line.text || ' '}</p>;
        return line.text.trim() ? <p key={i}>{line.text}</p> : null;
      })}
    </div>
  );
}

function TemplateButton({ template, selected, onSelect, onCreate, onDelete }) {
  return (
    <li className="relative group">
      <button
        type="button"
        onClick={() => onSelect(template.id)}
        onDoubleClick={() => onCreate(template)}
        aria-pressed={selected}
        className={`w-full text-left p-3 pr-9 rounded-xl border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-600 ${selected
          ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-50 dark:bg-neutral-800/60'
          : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'}`}
      >
        <span className="block text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{template.name}</span>
        {template.description && (
          <span className="block text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-2">{template.description}</span>
        )}
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(template)}
          aria-label={`Delete template ${template.name}`}
          title="Delete template"
          className="absolute top-2.5 right-2.5 p-1 rounded text-neutral-300 hover:text-rose-600 dark:text-neutral-600 dark:hover:text-rose-400 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity"
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

function Picker({ parentId, onCreated }) {
  const confirm = useConfirm();
  const { sections, addSection } = useFirestore();
  const { templates: mine, deleteTemplate } = useTemplates();
  const [queryText, setQueryText] = useState('');
  const [selectedId, setSelectedId] = useState(BUILT_IN_TEMPLATES[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const matches = (t) => {
    const q = normalizeText(queryText.trim());
    return !q || normalizeText(`${t.name} ${t.description || ''}`).includes(q);
  };
  const builtIn = BUILT_IN_TEMPLATES.filter(matches);
  const own = useMemo(() => mine.map((t) => ({ ...t, own: true })), [mine]);
  const ownVisible = own.filter(matches);
  const blank = { id: BLANK_ID, name: 'Blank note', description: 'Start from an empty page.' };
  const all = [blank, ...BUILT_IN_TEMPLATES, ...own];
  const selected = all.find((t) => t.id === selectedId) || null;

  const create = async (template) => {
    if (!template || busy) return;
    setBusy(true);
    setError(null);
    try {
      const siblings = sections.filter((s) => (s.parentId ?? null) === (parentId ?? null));
      const order = siblings.length ? Math.max(...siblings.map((s) => s.order || 0)) + 1 : 0;
      const isBuiltIn = template.markdown !== undefined;
      const newId = await addSection({
        name: template.id === BLANK_ID ? 'Untitled Note' : fillPlaceholders(isBuiltIn ? template.noteName : template.name),
        type: 'note',
        parentId: parentId ?? null,
        order,
        content: template.id === BLANK_ID ? '' : fillPlaceholders(isBuiltIn ? template.markdown : template.content),
      });
      if (newId) onCreated?.(newId);
    } catch (err) {
      console.error('Could not create note from template:', err);
      setError("Couldn't create the note. Check your connection and try again.");
      setBusy(false);
    }
  };

  const handleDelete = async (template) => {
    const ok = await confirm({
      title: `Delete template "${template.name}"?`,
      body: 'Notes already created from it are not affected. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteTemplate(template.id);
      if (selectedId === template.id) setSelectedId(BUILT_IN_TEMPLATES[0].id);
    } catch (err) {
      console.error('Could not delete template:', err);
      setError("Couldn't delete the template.");
    }
  };

  const itemProps = (t) => ({ template: t, selected: t.id === selectedId, onSelect: setSelectedId, onCreate: create });

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search size={14} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Search templates…"
          aria-label="Search templates"
          autoFocus
          className="w-full pl-9 pr-3 py-2.5 text-base sm:text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-neutral-300 dark:focus:border-neutral-600 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400"
        />
      </div>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-5 md:max-h-[55vh] md:overflow-y-auto md:pr-1">
          <div>
            <h3 className={`${LABEL} mb-2`}>Built-in</h3>
            <ul className="grid gap-2">
              {!queryText.trim() && <TemplateButton {...itemProps(blank)} />}
              {builtIn.map((t) => <TemplateButton key={t.id} {...itemProps(t)} />)}
            </ul>
            {builtIn.length === 0 && <p className="text-sm text-neutral-400 dark:text-neutral-500">No built-in templates match.</p>}
          </div>
          <div>
            <h3 className={`${LABEL} mb-2`}>My templates</h3>
            {own.length === 0 ? (
              <p className="text-sm text-neutral-400 dark:text-neutral-500">
                None yet. Use <span className="whitespace-nowrap">“Save as template”</span> on any note.
              </p>
            ) : ownVisible.length === 0 ? (
              <p className="text-sm text-neutral-400 dark:text-neutral-500">No templates of yours match.</p>
            ) : (
              <ul className="grid gap-2">
                {ownVisible.map((t) => <TemplateButton key={t.id} {...itemProps(t)} onDelete={handleDelete} />)}
              </ul>
            )}
          </div>
        </div>

        <section aria-label="Template preview" className="flex flex-col min-h-[16rem] border border-neutral-200 dark:border-neutral-800 rounded-xl">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
            {selected?.own ? <FileText size={14} aria-hidden="true" className="text-neutral-400" /> : <LayoutTemplate size={14} aria-hidden="true" className="text-neutral-400" />}
            <span className={LABEL}>Preview</span>
          </div>
          <div className="flex-1 px-4 py-3 overflow-y-auto md:max-h-[42vh]">
            {selected ? <Preview template={selected} /> : <p className="text-sm text-neutral-400">Choose a template.</p>}
          </div>
          <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-neutral-100 dark:border-neutral-800">
            {error && <p role="alert" className="mr-auto text-sm text-rose-600 dark:text-rose-400">{error}</p>}
            <button
              type="button"
              onClick={() => create(selected)}
              disabled={!selected || busy}
              className="px-4 py-2 text-sm bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white rounded-lg transition-colors disabled:opacity-50"
            >
              {busy ? 'Creating…' : 'Create note'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

// Props: { isOpen, onClose, parentId, onCreated(noteId) }
export default function TemplatePickerModal({ isOpen, onClose, parentId, onCreated }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New note from template" size="xl">
      <Picker parentId={parentId} onCreated={onCreated} />
    </Modal>
  );
}
