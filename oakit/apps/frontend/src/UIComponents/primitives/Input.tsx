import { InputHTMLAttributes, ReactNode, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  hint,
  error,
  icon,
  iconPosition = 'left',
  fullWidth = true,
  className = '',
  ...props
}, ref) => {
  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">{label}</label>
      )}
      <div className="relative">
        {icon && iconPosition === 'left' && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={`
            w-full px-3 py-2.5 text-sm
            bg-white border rounded-xl
            text-neutral-800 placeholder:text-neutral-400
            transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400
            disabled:bg-neutral-50 disabled:text-neutral-400 disabled:cursor-not-allowed
            ${error ? 'border-red-300 focus:ring-red-400/30 focus:border-red-400' : 'border-neutral-200 hover:border-neutral-300'}
            ${icon && iconPosition === 'left' ? 'pl-9' : ''}
            ${icon && iconPosition === 'right' ? 'pr-9' : ''}
            ${className}
          `}
          {...props}
        />
        {icon && iconPosition === 'right' && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
            {icon}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-neutral-400">{hint}</p>}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
