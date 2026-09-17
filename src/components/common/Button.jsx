import { forwardRef } from 'react';

const variants = {
  // Accent colour from Settings → Appearance (graphite = near-black / near-white)
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover',
  secondary: 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700',
  ghost: 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 dark:hover:text-neutral-200 dark:hover:bg-neutral-800',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500',
};

const sizes = {
  sm: 'px-2.5 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
  icon: 'p-2',
};

const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2 rounded-lg
        transition-colors duration-150 outline-none
        focus-visible:ring-2 focus-visible:ring-accent-ring/50
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant] || variants.primary}
        ${sizes[size] || sizes.md}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
