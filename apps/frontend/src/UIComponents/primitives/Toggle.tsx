interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  label?: string;
  description?: string;
}

export function Toggle({ checked, onChange, disabled = false, size = 'md', label, description }: ToggleProps) {
  const track = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11';
  const thumb = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const translate = size === 'sm' ? 'translate-x-4' : 'translate-x-5';

  const toggle = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent
        transition-colors duration-200 ease-in-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${track}
        ${checked ? 'bg-primary-600' : 'bg-neutral-200'}
      `}
    >
      <span className={`
        pointer-events-none inline-block rounded-full bg-white shadow ring-0
        transition duration-200 ease-in-out
        ${thumb}
        ${checked ? translate : 'translate-x-0'}
      `} />
    </button>
  );

  if (!label) return toggle;

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-800">{label}</p>
        {description && <p className="text-xs text-neutral-500 mt-0.5">{description}</p>}
      </div>
      {toggle}
    </div>
  );
}

export default Toggle;
