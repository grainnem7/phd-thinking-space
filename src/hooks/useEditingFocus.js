import { useEffect, useState } from 'react';

const TEXT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);

function isTyping(el) {
  if (!el || el === document.body) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && TEXT_TYPES.has((el.getAttribute('type') || 'text').toLowerCase());
}

// True while a text field or the editor has focus, i.e. while a phone's
// on-screen keyboard is probably up
export function useEditingFocus() {
  const [typing, setTyping] = useState(() => typeof document !== 'undefined' && isTyping(document.activeElement));

  useEffect(() => {
    let timer;
    const update = () => setTyping(isTyping(document.activeElement));
    // Focus moves in two steps (out, then in): read it once it has landed
    const onFocusOut = () => {
      clearTimeout(timer);
      timer = setTimeout(update, 0);
    };
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  return typing;
}
