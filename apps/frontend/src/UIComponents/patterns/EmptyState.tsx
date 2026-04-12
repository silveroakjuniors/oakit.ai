import { ReactNode } from 'react';
import { Button } from '@/UIComponents/primitives/Button';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void; icon?: ReactNode };
  secondaryAction?: { label: string; onClick: () => void };
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: { icon: 'w-10 h-10', title: 'text-sm', desc: 'text-xs', padding: 'py-6' },
  md: { icon: 'w-12 h-12', title: 'text-base', desc: 'text-sm', padding: 'py-10' },
  lg: { icon: 'w-16 h-16', title: 'text-lg', desc: 'text-base', padding: 'py-16' },
};

export function EmptyState({ icon, title, description, action, secondaryAction, size = 'md' }: EmptyStateProps) {
  const s = sizes[size];
  return (
    <div className={`flex flex-col items-center justify-center text-center ${s.padding} px-6`}>
      {icon && (
        <div className={`${s.icon} rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400 mb-4`}>
          {icon}
        </div>
      )}
      <p className={`${s.title} font-semibold text-neutral-800 mb-1`}>{title}</p>
      {description && <p className={`${s.desc} text-neutral-500 max-w-xs`}>{description}</p>}
      {(action || secondaryAction) && (
        <div className="flex gap-2 mt-4">
          {secondaryAction && (
            <Button variant="secondary" size="sm" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
          {action && (
            <Button variant="primary" size="sm" onClick={action.onClick} icon={action.icon}>
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
