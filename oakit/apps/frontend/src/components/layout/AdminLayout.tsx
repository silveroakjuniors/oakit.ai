'use client';

import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import OakitLogo from '@/components/OakitLogo';
import { clearToken, getToken } from '@/lib/auth';
import { apiGet } from '@/lib/api';

// ── Finance permission helpers ────────────────────────────────────────────────
// These mirror the backend PERMISSIONS constants.
const FIN_PERMS = {
  VIEW_FEES:            'VIEW_FEES',
  COLLECT_PAYMENT:      'COLLECT_PAYMENT',
  MANAGE_FEE_STRUCTURE: 'MANAGE_FEE_STRUCTURE',
  VIEW_EXPENSE:         'VIEW_EXPENSE',
  ADD_EXPENSE:          'ADD_EXPENSE',
  VIEW_SALARY:          'VIEW_SALARY',
  VIEW_REPORTS:         'VIEW_REPORTS',
  VIEW_RECONCILIATION:  'VIEW_RECONCILIATION',
  MANAGE_CONCESSION:    'MANAGE_CONCESSION',
} as const;

interface NavItem {
  href: string;
  label: string;
  icon: string;
  group: string;
  /** If set, item is only shown when user has this financial permission */
  requirePerm?: string;
}

const navItems: NavItem[] = [
  { href: '/admin',                  label: 'Dashboard',        icon: '⊞',  group: 'main' },
  { href: '/admin/users',            label: 'Users & Roles',    icon: '👥',  group: 'school' },
  { href: '/admin/classes',          label: 'Classes',          icon: '🏫',  group: 'school' },
  { href: '/admin/students',         label: 'Students',         icon: '🎒',  group: 'school' },
  { href: '/admin/enquiries',        label: 'Enquiries',        icon: '📬',  group: 'school' },
  { href: '/admin/curriculum',       label: 'Curriculum',       icon: '📄',  group: 'content' },
  { href: '/admin/textbook-planner', label: 'Textbook Planner', icon: '📚',  group: 'content' },
  { href: '/admin/supplementary',    label: 'Activities',       icon: '🎵',  group: 'content' },
  { href: '/admin/calendar',         label: 'Calendar',         icon: '📅',  group: 'content' },
  { href: '/admin/plans',            label: 'Daily Planner',    icon: '🗓️', group: 'content' },
  // Finance — each item gated by the relevant permission
  { href: '/admin/finance',                label: 'Finance',          icon: '💰',  group: 'finance', requirePerm: FIN_PERMS.VIEW_FEES },
  { href: '/admin/finance/fee-structures', label: 'Fee Structures',   icon: '🏷️', group: 'finance', requirePerm: FIN_PERMS.MANAGE_FEE_STRUCTURE },
  { href: '/admin/finance/fees',           label: 'Fee Collection',   icon: '💳',  group: 'finance', requirePerm: FIN_PERMS.COLLECT_PAYMENT },
  { href: '/admin/finance/enquiries',      label: 'Admissions',       icon: '📝',  group: 'finance', requirePerm: FIN_PERMS.VIEW_FEES },
  { href: '/admin/finance/concessions',    label: 'Concessions',      icon: '🎁',  group: 'finance', requirePerm: FIN_PERMS.MANAGE_CONCESSION },
  { href: '/admin/finance/expenses',       label: 'Expenses',         icon: '🧾',  group: 'finance', requirePerm: FIN_PERMS.VIEW_EXPENSE },
  { href: '/admin/finance/salary',         label: 'Salary',           icon: '👔',  group: 'finance', requirePerm: FIN_PERMS.VIEW_SALARY },
  { href: '/admin/finance/reports',        label: 'Reports',          icon: '📈',  group: 'finance', requirePerm: FIN_PERMS.VIEW_REPORTS },
  { href: '/admin/reports',          label: 'Reports',          icon: '📊',  group: 'insights' },
  { href: '/admin/announcements',    label: 'Announcements',    icon: '📢',  group: 'insights' },
  { href: '/admin/audit',            label: 'Audit Log',        icon: '🔍',  group: 'insights' },
  { href: '/admin/setup',            label: 'Setup Wizard',     icon: '🧭',  group: 'system' },
  { href: '/admin/settings',         label: 'Settings',         icon: '⚙️', group: 'system' },
];

const NAV_GROUPS = [
  { key: 'main',     label: null },
  { key: 'school',   label: 'School' },
  { key: 'content',  label: 'Content' },
  { key: 'finance',  label: 'Finance' },
  { key: 'insights', label: 'Insights' },
  { key: 'system',   label: 'System' },
];

function SidebarContent({ pathname, permissions, onClose }: { pathname: string; permissions: string[]; onClose?: () => void }) {
  const router = useRouter();

  // Filter nav items based on financial permissions
  const visibleItems = navItems.filter(item => {
    if (!item.requirePerm) return true;
    return permissions.includes(item.requirePerm);
  });

  // Only show Finance group header if at least one finance item is visible
  const hasFinanceItems = visibleItems.some(i => i.group === 'finance');

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-neutral-100 flex items-center gap-3">
        <OakitLogo size="xs" variant="dark" showTagline />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {NAV_GROUPS.map(group => {
          if (group.key === 'finance' && !hasFinanceItems) return null;
          const items = visibleItems.filter(i => i.group === group.key);
          if (items.length === 0) return null;
          return (
            <div key={group.key} className={group.label ? 'mt-4 first:mt-0' : ''}>
              {group.label && (
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                  {group.label}
                </p>
              )}
              {items.map(item => {
                const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href} onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800'
                    }`}>
                    <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Bottom sign out */}
      <div className="px-3 py-4 border-t border-neutral-100">
        <button onClick={() => { clearToken(); router.push('/login'); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-all">
          <span className="text-base w-5 text-center shrink-0">↩</span>
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [finPerms, setFinPerms] = useState<string[]>([]);

  // Fetch the user's effective financial permissions once on mount
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<{ permissions: string[] }>('/api/v1/financial/permissions', token)
      .then(data => setFinPerms(data.permissions || []))
      .catch(() => setFinPerms([]));
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50">
      {/* Top bar */}
      <header className="h-14 bg-white border-b border-neutral-200 flex items-center justify-between px-4 shrink-0 z-40 sticky top-0">
        <div className="flex items-center gap-3">
          {/* Hamburger — mobile only */}
          <button onClick={() => setDrawerOpen(true)}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl hover:bg-neutral-100 transition-colors text-neutral-500">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 3.5h12M2 8h12M2 12.5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
          {/* Breadcrumb */}
          <div className="hidden lg:flex items-center gap-2 text-sm">
            <span className="text-neutral-400 font-medium">Admin</span>
            <span className="text-neutral-300">/</span>
            <span className="text-neutral-700 font-semibold capitalize">
              {pathname.split('/').filter(Boolean).slice(1).join(' › ') || 'Dashboard'}
            </span>
          </div>
          <span className="lg:hidden text-sm font-semibold text-neutral-700">Admin Portal</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-neutral-500 px-3 py-1.5 rounded-full font-medium">
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
          <button onClick={() => { clearToken(); router.push('/login'); }}
            className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-800 font-medium px-3 py-1.5 rounded-xl hover:bg-neutral-100 transition-colors min-h-[36px] border border-transparent hover:border-neutral-200">
            ↩ Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar — white */}
        <aside className="hidden lg:flex flex-col w-56 shrink-0 bg-white border-r border-neutral-200">
          <SidebarContent pathname={pathname} permissions={finPerms} />
        </aside>

        {/* Mobile drawer backdrop */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-64 flex flex-col bg-white border-r border-neutral-200 animate-slide-in-right">
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
                <OakitLogo size="xs" variant="dark" />
                <button onClick={() => setDrawerOpen(false)} className="text-neutral-400 hover:text-neutral-700 w-8 h-8 flex items-center justify-center rounded-lg">✕</button>
              </div>
              <SidebarContent pathname={pathname} permissions={finPerms} onClose={() => setDrawerOpen(false)} />
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto min-w-0">{children}</main>
      </div>
    </div>
  );
}
