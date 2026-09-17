import { createContext, useCallback, useContext, useRef, useState } from 'react';
import Modal from './Modal';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState({
    isOpen: false,
    title: '',
    body: '',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    danger: true,
  });
  const resolverRef = useRef(null);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({
        isOpen: true,
        title: options.title || 'Are you sure?',
        body: options.body || '',
        confirmLabel: options.confirmLabel || 'Delete',
        cancelLabel: options.cancelLabel || 'Cancel',
        danger: options.danger !== false,
      });
    });
  }, []);

  const handleConfirm = () => {
    resolverRef.current?.(true);
    resolverRef.current = null;
    setState((s) => ({ ...s, isOpen: false }));
  };

  const handleCancel = () => {
    resolverRef.current?.(false);
    resolverRef.current = null;
    setState((s) => ({ ...s, isOpen: false }));
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal isOpen={state.isOpen} onClose={handleCancel} title={state.title} size="sm">
        {state.body && (
          <p className="text-base text-neutral-600 dark:text-neutral-300 mb-6 whitespace-pre-line">{state.body}</p>
        )}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={handleCancel}
            // For destructive actions, focus Cancel so Enter can't delete by accident
            autoFocus={state.danger}
            className="px-4 py-2 text-base text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-600"
          >
            {state.cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            autoFocus={!state.danger}
            className={`px-4 py-2 text-base rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900 ${
              state.danger
                ? 'text-white bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 focus-visible:ring-rose-400'
                : 'text-white bg-neutral-700 hover:bg-neutral-900 dark:text-neutral-900 dark:bg-neutral-100 dark:hover:bg-neutral-300 focus-visible:ring-neutral-400'
            }`}
          >
            {state.confirmLabel}
          </button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- the hook is this module's public API
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ctx;
}
