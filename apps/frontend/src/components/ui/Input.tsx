import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-neutral-700 tracking-tight">{label}</label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`
              w-full px-4 py-2.5 rounded-xl text-sm
              bg-white border
              placeholder:text-neutral-400
              focus:outline-none focus:border-primary-400
              disabled:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-400
              ${error ? 'border-red-400 bg-red-50/30' : 'border-neutral-200 hover:border-neutral-300'}
              ${icon ? 'pl-10' : ''}
              ${className}
            `}
            {...props}
          />
        </div>
        {hint && !error && <p className="text-xs text-neutral-400">{hint}</p>}
        {error && <p className="text-xs text-red-500 flex items-center gap-1">⚠ {error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
