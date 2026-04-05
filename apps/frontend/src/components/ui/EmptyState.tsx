import { ReactNode } from 'react';

interface EmptyStateProps {
  emoji?: string;
  icon?: ReactNode;
  heading: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export default function EmptyState({ emoji, icon, heading, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}>
      {icon ? (
        <div className="mb-4">{icon}</div>
      ) : emoji ? (
        <div className="text-4xl mb-4">{emoji}</div>
      ) : null}
      <p className="font-semibold text-neutral-700 text-sm">{heading}</p>
      {description && <p className="text-sm text-neutral-400 mt-1.5 max-w-xs leading-relaxed">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors min-h-[44px]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
