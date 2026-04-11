'use client';
import { ReactNode, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsiblePanelProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  onOpen?: () => void;
}

export function CollapsiblePanel({
  title,
  subtitle,
  icon,
  badge,
  children,
  defaultOpen = false,
  className = '',
  onOpen,
}: CollapsiblePanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && onOpen) onOpen();
  }

  return (
    <div className={`border border-neutral-200 rounded-2xl overflow-hidden ${className}`}>
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-neutral-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && <span className="shrink-0 text-neutral-500">{icon}</span>}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-800 truncate">{title}</p>
            {subtitle && <p className="text-xs text-neutral-500 truncate">{subtitle}</p>}
          </div>
          {badge && <span className="shrink-0">{badge}</span>}
        </div>
        <ChevronDown className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-neutral-100">
          {children}
        </div>
      )}
    </div>
  );
}

export default CollapsiblePanel;
