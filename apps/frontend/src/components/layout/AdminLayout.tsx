'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import OakitLogo from '@/components/OakitLogo';
import { clearToken } from '@/lib/auth';

const navItems = [
  { href: '/admin',                  label: 'Dashboard',        icon: '⊞' },
  { href: '/admin/users',            label: 'Users & Roles',    icon: '👥' },
  { href: '/admin/classes',          label: 'Classes',          icon: '🏫' },
  { href: '/admin/students',         label: 'Students',         icon: '🎒' },
  { href: '/admin/curriculum',       label: 'Curriculum',       icon: '📄' },
  { href: '/admin/textbook-planner', label: 'Textbook Planner', icon: '📚' },
  { href: '/admin/supplementary',    label: 'Activities',       icon: '🎵' },
  { href: '/admin/calendar',         label: 'Calendar',         icon: '📅' },
  { href: '/admin/plans',            label: 'Plans',            icon: '📋' },
  { href: '/admin/reports',          label: 'Reports',          icon: '📊' },
  { href: '/admin/announcements',    label: 'Announcements',    icon: '📢' },
  { href: '/admin/audit',            label: 'Audit Log',        icon: '🔍' },
  { href: '/admin/setup',            label: 'Setup Wizard',     icon: '🧭' },
  { href: '/admin/settings',         label: 'Settings',         icon: '⚙️' },
];

function SidebarContent({ pathname, onClose }: { pathname: string; onClose?: () => void }) {
  const router = useRouter();
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
        <OakitLogo size="xs" variant="light" showTagline />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto">
        {navItems.map(item => {
          const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
                isActive ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/8 hover:text-white/90'
              }`}>
              <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
              <span className="truncate">{item.label}</span>
              {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50">
      {/* Top bar */}
      <header className="h-14 bg-white border-b border-neutral-200 flex items-center justify-between px-4 shrink-0 z-40 sticky top-0"
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-3">
          {/* Hamburger — mobile only */}
          <button onClick={() => setDrawerOpen(true)}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-neutral-100 transition-colors text-neutral-600">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-neutral-700">Admin Portal</span>
          </div>
        </div>
        <button onClick={() => { clearToken(); router.push('/login'); }}
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-800 font-medium px-3 py-1.5 rounded-lg hover:bg-neutral-100 transition-colors min-h-[36px]">
          ↩ Sign out
        </button>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-56 shrink-0"
          style={{ background: 'linear-gradient(180deg, var(--brand-primary) 0%, var(--brand-primary-dark) 100%)', boxShadow: '2px 0 20px rgba(0,0,0,0.12)' }}>
          <SidebarContent pathname={pathname} />
        </aside>

        {/* Mobile drawer backdrop */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-64 flex flex-col animate-slide-in-right"
              style={{ background: 'linear-gradient(180deg, var(--brand-primary) 0%, var(--brand-primary-dark) 100%)' }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <OakitLogo size="xs" variant="light" />
                <button onClick={() => setDrawerOpen(false)} className="text-white/60 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg">✕</button>
              </div>
              <SidebarContent pathname={pathname} onClose={() => setDrawerOpen(false)} />
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto min-w-0">{children}</main>
      </div>
    </div>
  );
}
