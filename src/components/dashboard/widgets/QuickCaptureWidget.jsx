import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import WidgetWrapper from './WidgetWrapper';

export default function QuickCaptureWidget({ onRemove, captures = [], onAddCapture }) {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (text.trim()) {
      onAddCapture?.({ text: text.trim(), createdAt: new Date().toISOString() });
      setText('');
    }
  };

  const parseDate = (v) => {
    if (!v) return null;
    try { return v.toDate ? v.toDate() : new Date(v); } catch { return null; }
  };

  const timeAgo = (v) => {
    const d = parseDate(v);
    if (!d || isNaN(d.getTime())) return '';
    try { return formatDistanceToNow(d, { addSuffix: true }); } catch { return ''; }
  };

  return (
    <WidgetWrapper title="Quick Capture" onRemove={onRemove}>
      {/* Simple input */}
      <div className="mb-6">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Capture an idea..."
          className="w-full px-3 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300 placeholder:text-neutral-300"
        />
        <p className="text-xs text-neutral-400 mt-2">Press Enter to save</p>
      </div>

      {/* Captures list */}
      {captures.length === 0 ? (
        <p className="text-sm text-neutral-400">No captures yet</p>
      ) : (
        <div className="divide-y divide-neutral-100">
          {captures.slice(0, 6).map((c) => (
            <div key={c.id} className="py-3">
              <p className="text-sm text-neutral-900">{c.text}</p>
              <p className="text-xs text-neutral-400 mt-1">{timeAgo(c.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </WidgetWrapper>
  );
}
