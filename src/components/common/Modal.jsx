import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { Plus } from 'lucide-react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

// Open dialogs, bottom to top. Only the topmost one handles Escape/Tab, and the
// body scroll lock is held while any dialog is open (e.g. a confirm over a modal).
const openStack = [];
let savedBodyOverflow = '';

function lockBodyScroll() {
  if (openStack.length === 1) {
    savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
}

function unlockBodyScroll() {
  if (openStack.length === 0) {
    document.body.style.overflow = savedBodyOverflow;
  }
}

function getFocusable(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('inert') && el.getClientRects().length > 0,
  );
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export default function Modal({ isOpen, ...props }) {
  if (!isOpen) return null;
  return <ModalPanel {...props} />;
}

function ModalPanel({ onClose, title, children, size = 'md' }) {
  const overlayRef = useRef(null);
  const panelRef = useRef(null);
  const bodyRef = useRef(null);
  const titleId = useId();
  // Captured while rendering, before any autoFocus inside the dialog moves focus
  const [returnFocusTo] = useState(() => document.activeElement);

  const close = useEffectEvent(() => onClose?.());

  useEffect(() => {
    const token = {};
    openStack.push(token);
    lockBodyScroll();

    // Respect autoFocus inside the dialog; otherwise focus the first control
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      const target = getFocusable(bodyRef.current)[0] || getFocusable(panel)[0] || panel;
      target.focus();
    }

    const handleKeyDown = (e) => {
      if (openStack[openStack.length - 1] !== token) return;
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = getFocusable(panelRef.current);
      if (focusable.length === 0) {
        e.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!panelRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const index = openStack.indexOf(token);
      if (index !== -1) openStack.splice(index, 1);
      unlockBodyScroll();
      // Only restore focus when the dialog really closed (StrictMode re-runs
      // effects with the panel still mounted)
      const closed = !panel || !panel.isConnected;
      if (closed && returnFocusTo && returnFocusTo !== document.body && returnFocusTo.isConnected) {
        returnFocusTo.focus({ preventScroll: true });
      }
    };
  }, [returnFocusTo]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-neutral-900/20 dark:bg-black/60"
      onClick={(e) => {
        if (e.target === overlayRef.current) {
          onClose?.();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`w-full ${sizes[size] || sizes.md} bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-t-xl sm:rounded-xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto focus:outline-none`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-neutral-100 dark:border-neutral-800 sticky top-0 bg-white dark:bg-neutral-900 z-10">
          <h2 id={titleId} className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-widest font-medium">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            title="Close"
            className="text-neutral-300 hover:text-neutral-500 dark:text-neutral-600 dark:hover:text-neutral-300 transition-colors p-2 sm:p-1 -m-1 sm:m-0 rounded touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-600"
          >
            <Plus size={18} className="rotate-45 sm:w-4 sm:h-4" />
          </button>
        </div>
        <div ref={bodyRef} className="p-4 sm:p-6 text-neutral-900 dark:text-neutral-100">
          {children}
        </div>
      </div>
    </div>
  );
}
