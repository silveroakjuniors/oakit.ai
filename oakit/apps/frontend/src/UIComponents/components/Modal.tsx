'use client';
import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnBackdrop?: boolean;
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md', closeOnBackdrop = true }: ModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      {/* Panel */}
      <div className={`relative w-full ${sizes[size]} bg-white rounded-2xl shadow-2xl animate-slide-up overflow-hidden`}>
        {/* Header */}
        {(title || subtitle) && (
          <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-neutral-100">
            <div>
              {title && <h2 className="text-base font-semibold text-neutral-900">{title}</h2>}
              {subtitle && <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 transition-colors ml-4 shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        {/* Body */}
        <div className="px-5 py-4">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="px-5 pb-5 pt-2 border-t border-neutral-100 flex gap-2 justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;
