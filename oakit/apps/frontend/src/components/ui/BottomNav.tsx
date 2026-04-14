'use client';

interface NavTab {
  id: string;
  icon: string;
  label: string;
  badge?: number;
}

interface BottomNavProps {
  tabs: NavTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export default function BottomNav({ tabs, activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 z-50 flex items-center justify-around px-2"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))', paddingTop: '8px' }}
    >
      {tabs.map(t => {
        const isActive = t.id === activeTab;
        return (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={`relative flex flex-col items-center gap-0.5 min-w-[48px] min-h-[44px] px-2 py-1 rounded-xl transition-colors ${
              isActive ? 'text-emerald-600' : 'text-neutral-400 hover:text-neutral-600'
            }`}
          >
            <span className={`text-xl transition-transform ${isActive ? 'scale-110' : ''}`}>{t.icon}</span>
            <span className={`text-[9px] font-semibold leading-tight ${isActive ? 'text-emerald-600' : 'text-neutral-400'}`}>
              {t.badge && t.badge > 0 ? `(${t.badge})` : t.label}
            </span>
            {isActive && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500" />}
          </button>
        );
      })}
    </nav>
  );
}
