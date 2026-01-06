import { useState, useRef, useEffect, cloneElement } from 'react';

export default function Dropdown({
  trigger,
  children,
  align = 'left',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const alignClasses = {
    left: 'left-0',
    right: 'right-0',
  };

  const handleTriggerClick = (e) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  // Clone the trigger element and attach our click handler
  const triggerWithHandler = cloneElement(trigger, {
    onClick: (e) => {
      // Call original onClick if exists
      if (trigger.props.onClick) {
        trigger.props.onClick(e);
      }
      handleTriggerClick(e);
    },
  });

  return (
    <div ref={dropdownRef} className="relative inline-block">
      {triggerWithHandler}
      {isOpen && (
        <div
          className={`absolute z-50 mt-1 min-w-[160px] bg-white border border-neutral-200 rounded-xl py-2 ${alignClasses[align]}`}
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
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors ${
        danger
          ? 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50'
          : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
      }`}
    >
      {children}
    </button>
  );
}
