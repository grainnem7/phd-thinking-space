import { useState, useRef, useEffect, useId, cloneElement } from 'react';

const alignClasses = {
  left: 'left-0',
  right: 'right-0',
};

export default function Dropdown({
  trigger,
  children,
  align = 'left',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    // Capture phase so Escape closes only the menu, not a dialog behind it
    const handleEscape = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setIsOpen(false);
      const menuHasFocus = dropdownRef.current?.contains(document.activeElement);
      if (menuHasFocus) {
        dropdownRef.current.querySelector('[aria-haspopup]')?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEscape, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEscape, true);
    };
  }, [isOpen]);

  const handleTriggerClick = (e) => {
    e.stopPropagation();
    setIsOpen((open) => !open);
  };

  // Up/Down/Home/End move between menu items
  const handleMenuKeyDown = (e) => {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(e.key) || !menuRef.current) return;
    const items = Array.from(menuRef.current.querySelectorAll('[role="menuitem"]:not([disabled])'));
    if (items.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    const index = items.indexOf(document.activeElement);
    let next = 0;
    if (e.key === 'ArrowDown') next = index < 0 ? 0 : (index + 1) % items.length;
    if (e.key === 'ArrowUp') next = index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length;
    if (e.key === 'End') next = items.length - 1;
    items[next].focus();
  };

  // Clone the trigger element and attach our click handler + menu semantics
  const triggerWithHandler = cloneElement(trigger, {
    'aria-haspopup': 'menu',
    'aria-expanded': isOpen,
    'aria-controls': isOpen ? menuId : undefined,
    onClick: (e) => {
      // Call original onClick if exists
      if (trigger.props.onClick) {
        trigger.props.onClick(e);
      }
      handleTriggerClick(e);
    },
    onKeyDown: (e) => {
      trigger.props.onKeyDown?.(e);
      const menu = isOpen && e.key === 'ArrowDown' ? document.getElementById(menuId) : null;
      if (menu) {
        e.preventDefault();
        menu.querySelector('[role="menuitem"]:not([disabled])')?.focus();
      }
    },
  });

  return (
    <div ref={dropdownRef} className="relative inline-block">
      {triggerWithHandler}
      {isOpen && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          onKeyDown={handleMenuKeyDown}
          className={`absolute z-50 mt-1 min-w-[160px] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg dark:shadow-black/40 py-2 ${alignClasses[align] || alignClasses.left}`}
        >
          {typeof children === 'function'
            ? children({ close: () => setIsOpen(false) })
            : children
          }
        </div>
      )}
    </div>
  );
}

export function DropdownItem({ onClick, children, danger = false }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors focus:outline-none ${
        danger
          ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-50 focus-visible:bg-rose-50 dark:text-rose-400 dark:hover:text-rose-300 dark:hover:bg-rose-950/40 dark:focus-visible:bg-rose-950/40'
          : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 focus-visible:bg-neutral-50 dark:text-neutral-300 dark:hover:text-neutral-100 dark:hover:bg-neutral-800 dark:focus-visible:bg-neutral-800'
      }`}
    >
      {children}
    </button>
  );
}
