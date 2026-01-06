import { forwardRef } from 'react';

const variants = {
  primary: 'bg-neutral-900 text-white hover:bg-neutral-800',
  secondary: 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
  ghost: 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50',
  danger: 'text-neutral-400 hover:text-neutral-600',
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
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]}
        ${sizes[size]}
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
