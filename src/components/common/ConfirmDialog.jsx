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
            onClick={handleCancel}
            className="px-4 py-2 text-base text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
          >
            {state.cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            autoFocus
            className={
              state.danger
                ? 'px-4 py-2 text-base text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors'
                : 'px-4 py-2 text-base text-white bg-neutral-700 hover:bg-neutral-900 rounded-lg transition-colors'
            }
          >
            {state.confirmLabel}
          </button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ctx;
}
