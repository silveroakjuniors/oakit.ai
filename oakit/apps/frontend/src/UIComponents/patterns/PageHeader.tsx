import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
}

export function PageHeader({ title, subtitle, icon, actions, breadcrumb }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0 text-primary-600">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          {breadcrumb && breadcrumb.length > 0 && (
            <div className="flex items-center gap-1 mb-1">
              {breadcrumb.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-neutral-300 text-xs">/</span>}
                  {crumb.href ? (
                    <a href={crumb.href} className="text-xs text-neutral-500 hover:text-neutral-700 transition-colors">{crumb.label}</a>
                  ) : (
                    <span className="text-xs text-neutral-400">{crumb.label}</span>
                  )}
                </span>
              ))}
            </div>
          )}
          <h1 className="text-xl font-semibold text-neutral-900 truncate">{title}</h1>
          {subtitle && <p className="text-sm text-neutral-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export default PageHeader;
