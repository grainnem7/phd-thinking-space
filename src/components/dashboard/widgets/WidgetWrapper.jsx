import { Plus } from 'lucide-react';

export default function WidgetWrapper({ title, onRemove, children, actions, noPadding }) {
  return (
    <div className="h-full flex flex-col">
      {/* Minimal section header */}
      <div className="widget-drag-handle flex-shrink-0 flex items-center justify-between px-6 pt-5 pb-4 cursor-move border-b border-neutral-100">
        <h2 className="text-xs text-neutral-400 uppercase tracking-widest font-medium">{title}</h2>
        <div className="flex items-center gap-2">
          {actions}
          {onRemove && (
            <button
              onClick={onRemove}
              className="text-neutral-300 hover:text-neutral-500 transition-colors opacity-0 group-hover:opacity-100"
              title="Remove widget"
            >
              <Plus size={15} className="rotate-45" />
            </button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className={`flex-1 min-h-0 overflow-y-auto ${noPadding ? '' : 'px-6 py-5'}`}>
        {children}
      </div>
    </div>
  );
}
