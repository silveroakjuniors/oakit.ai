'use client';
import { ReactNode } from 'react';

export interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  variant?: 'underline' | 'pill' | 'segment';
  size?: 'sm' | 'md';
}

export function Tabs({ tabs, activeTab, onChange, variant = 'underline', size = 'md' }: TabsProps) {
  if (variant === 'segment') {
    return (
      <div className="flex items-center bg-neutral-100 rounded-xl p-1 gap-0.5">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => onChange(tab.id)}
            className={`relative flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.id ? 'bg-white text-neutral-800 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
            }`}>
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            {tab.label}
            {tab.badge !== undefined && (
              <span className={`text-2xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab.id ? 'bg-primary-100 text-primary-700' : 'bg-neutral-200 text-neutral-500'}`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  if (variant === 'pill') {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => onChange(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}>
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>
    );
  }

  // underline (default)
  return (
    <div className="flex border-b border-neutral-200 gap-0">
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => onChange(tab.id)}
          className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? 'text-primary-600 border-b-2 border-primary-600 -mb-px'
              : 'text-neutral-500 hover:text-neutral-700'
          }`}>
          {tab.icon && <span className="shrink-0">{tab.icon}</span>}
          {tab.label}
          {tab.badge !== undefined && (
            <span className="text-2xs bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded-full font-bold">
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default Tabs;
