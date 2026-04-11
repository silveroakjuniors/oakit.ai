import { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export type AlertVariant = 'success' | 'warning' | 'danger' | 'info';

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  message: string | ReactNode;
  onDismiss?: () => void;
  icon?: ReactNode;
  action?: { label: string; onClick: () => void };
}

const styles: Record<AlertVariant, { container: string; icon: string; defaultIcon: ReactNode }> = {
  success: {
    container: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    icon: 'text-emerald-500',
    defaultIcon: <CheckCircle2 className="w-4 h-4" />,
  },
  warning: {
    container: 'bg-amber-50 border-amber-200 text-amber-800',
    icon: 'text-amber-500',
    defaultIcon: <AlertTriangle className="w-4 h-4" />,
  },
  danger: {
    container: 'bg-red-50 border-red-200 text-red-700',
    icon: 'text-red-500',
    defaultIcon: <AlertCircle className="w-4 h-4" />,
  },
  info: {
    container: 'bg-blue-50 border-blue-200 text-blue-800',
    icon: 'text-blue-500',
    defaultIcon: <Info className="w-4 h-4" />,
  },
};

export function Alert({ variant = 'info', title, message, onDismiss, icon, action }: AlertProps) {
  const s = styles[variant];
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${s.container}`}>
      <span className={`shrink-0 mt-0.5 ${s.icon}`}>{icon || s.defaultIcon}</span>
      <div className="flex-1 min-w-0">
        {title && <p className="text-sm font-semibold mb-0.5">{title}</p>}
        <p className="text-xs leading-relaxed">{message}</p>
        {action && (
          <button onClick={action.onClick} className="mt-2 text-xs font-semibold underline underline-offset-2 hover:no-underline">
            {action.label}
          </button>
        )}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default Alert;
