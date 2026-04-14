'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  variant?: ToastVariant;
  duration?: number;
  onDismiss?: () => void;
}

const styles: Record<ToastVariant, { container: string; icon: React.ReactNode }> = {
  success: { container: 'bg-emerald-600 text-white', icon: <CheckCircle2 className="w-4 h-4" /> },
  error:   { container: 'bg-red-600 text-white',     icon: <AlertCircle className="w-4 h-4" /> },
  info:    { container: 'bg-neutral-800 text-white', icon: <Info className="w-4 h-4" /> },
};

export function Toast({ message, variant = 'info', duration = 3000, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(true);
  const s = styles[variant];

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); onDismiss?.(); }, duration);
    return () => clearTimeout(t);
  }, [duration, onDismiss]);

  if (!visible) return null;

  return (
    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-slide-up ${s.container}`}>
      <span className="shrink-0">{s.icon}</span>
      <span className="flex-1">{message}</span>
      <button onClick={() => { setVisible(false); onDismiss?.(); }} className="shrink-0 opacity-70 hover:opacity-100">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default Toast;
