/**
 * Student Module - Layout Component
 * Main layout with sidebar and navigation
 */

import React from 'react';
import { LogOut, Home, BookOpen, Sparkles, ClipboardList, TrendingUp } from 'lucide-react';
import { Tab } from '../types';
import OakitLogo from '@/components/OakitLogo';

interface StudentLayoutProps {
  currentTab: Tab;
  studentName: string;
  className: string;
  sectionLabel: string;
  onTabChange: (tab: Tab) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

const TABS: Array<{ id: Tab; Icon: React.ElementType; label: string }> = [
  { id: 'today', Icon: Home, label: 'Today' },
  { id: 'homework', Icon: BookOpen, label: 'Homework' },
  { id: 'ask', Icon: Sparkles, label: 'Ask Oakie' },
  { id: 'quiz', Icon: ClipboardList, label: 'Quiz' },
  { id: 'progress', Icon: TrendingUp, label: 'My Progress' },
];

/**
 * Main layout component
 */
export const StudentLayout = React.memo<StudentLayoutProps>(
  ({
    currentTab,
    studentName,
    className,
    sectionLabel,
    onTabChange,
    onLogout,
    children,
  }) => {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
        {/* Desktop sidebar */}
        <DesktopSidebar
          currentTab={currentTab}
          studentName={studentName}
          className={className}
          sectionLabel={sectionLabel}
          onTabChange={onTabChange}
          onLogout={onLogout}
        />

        {/* Main content */}
        <div className="lg:pl-64 flex flex-col min-h-screen">
          {/* Mobile header */}
          <MobileHeader studentName={studentName} className={className} sectionLabel={sectionLabel} onLogout={onLogout} />

          {/* Tab content */}
          <main className="flex-1 overflow-y-auto pb-24 lg:pb-8">
            <div className="p-4 lg:p-6 max-w-3xl mx-auto">{children}</div>
          </main>

          {/* Mobile bottom nav */}
          <MobileBottomNav currentTab={currentTab} onTabChange={onTabChange} />
        </div>
      </div>
    );
  }
);

StudentLayout.displayName = 'StudentLayout';

/**
 * Desktop sidebar component
 */
interface DesktopSidebarProps {
  currentTab: Tab;
  studentName: string;
  className: string;
  sectionLabel: string;
  onTabChange: (tab: Tab) => void;
  onLogout: () => void;
}

const DesktopSidebar = React.memo<DesktopSidebarProps>(
  ({ currentTab, studentName, className, sectionLabel, onTabChange, onLogout }) => (
    <aside
      className="hidden lg:flex fixed left-0 top-0 h-full w-64 flex-col z-40"
      style={{ background: 'linear-gradient(180deg, #0f2417 0%, #1a3c2e 100%)' }}
    >
      {/* Logo section */}
      <div className="px-6 py-5 border-b border-white/10">
        <OakitLogo size="sm" variant="light" />
        <p className="text-white/40 text-xs mt-1">Student Portal</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {TABS.map(({ id, Icon, label }) => (
          <NavButton
            key={id}
            active={currentTab === id}
            icon={Icon}
            label={label}
            onClick={() => onTabChange(id)}
          />
        ))}
      </nav>

      {/* User section */}
      <div className="px-3 py-3 border-t border-white/10">
        <div className="px-3 py-2 mb-1">
          <p className="text-white text-xs font-semibold truncate">{studentName}</p>
          <p className="text-white/40 text-[10px]">
            {className} · {sectionLabel}
          </p>
        </div>
        <LogoutButton onClick={onLogout} />
      </div>
    </aside>
  )
);

DesktopSidebar.displayName = 'DesktopSidebar';

/**
 * Mobile header
 */
interface MobileHeaderProps {
  studentName: string;
  className: string;
  sectionLabel: string;
  onLogout: () => void;
}

const MobileHeader = React.memo<MobileHeaderProps>(
  ({ studentName, className, sectionLabel, onLogout }) => (
    <header
      className="lg:hidden text-white px-4 pt-8 pb-5 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0f2417 0%, #1e5c3a 100%)' }}
    >
      <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
      <div className="relative z-10 flex items-center justify-between mb-1">
        <OakitLogo size="sm" variant="light" />
        <button
          onClick={onLogout}
          className="text-white/50 hover:text-white/80 text-xs transition-colors"
          aria-label="Sign out"
        >
          Sign out
        </button>
      </div>
      <div className="relative z-10 mt-2">
        <p className="text-white font-bold text-base">{studentName}</p>
        <p className="text-white/50 text-xs">
          {className} · Section {sectionLabel}
        </p>
      </div>
    </header>
  )
);

MobileHeader.displayName = 'MobileHeader';

/**
 * Mobile bottom navigation
 */
interface MobileBottomNavProps {
  currentTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const MobileBottomNav = React.memo<MobileBottomNavProps>(({ currentTab, onTabChange }) => (
  <nav
    className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 z-50 flex items-center justify-around px-1"
    style={{
      paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
      paddingTop: '8px',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
    }}
  >
    {TABS.map(({ id, Icon, label }) => {
      const isActive = currentTab === id;
      return (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={`relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-[48px] min-h-[44px] transition-colors ${
            isActive ? 'text-emerald-600' : 'text-neutral-400'
          }`}
          aria-label={label}
        >
          <Icon size={20} className={isActive ? 'scale-110 transition-transform' : ''} />
          <span
            className={`text-[9px] font-semibold ${
              isActive ? 'text-emerald-600' : 'text-neutral-400'
            }`}
          >
            {label}
          </span>
          {isActive && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500" />
          )}
        </button>
      );
    })}
  </nav>
));

MobileBottomNav.displayName = 'MobileBottomNav';

/**
 * Navigation button
 */
interface NavButtonProps {
  active: boolean;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}

const NavButton = React.memo<NavButtonProps>(({ active, icon: Icon, label, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
      active
        ? 'bg-white/15 text-white'
        : 'text-white/55 hover:bg-white/8 hover:text-white/85'
    }`}
    aria-label={label}
  >
    <Icon size={18} className="shrink-0" />
    <span className="flex-1 text-left">{label}</span>
    {active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
  </button>
));

NavButton.displayName = 'NavButton';

/**
 * Logout button
 */
interface LogoutButtonProps {
  onClick: () => void;
}

const LogoutButton = React.memo<LogoutButtonProps>(({ onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/8 transition-colors text-sm"
    aria-label="Sign out"
  >
    <LogOut size={16} />
    <span>Sign out</span>
  </button>
));

LogoutButton.displayName = 'LogoutButton';
