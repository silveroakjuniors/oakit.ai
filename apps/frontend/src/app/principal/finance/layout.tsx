'use client';

import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearToken, getRole } from '@/lib/auth';

const FINANCE_NAV = [
  { href: '/principal/finance',                label: 'Overview',       icon: '💰' },
  { href: '/principal/finance/fee-structures', label: 'Fee Structures', icon: '🏷️' },
  { href: '/principal/finance/concessions',    label: 'Concessions',    icon: '🎁' },
  { href: '/principal/finance/expenses',       label: 'Expenses',       icon: '🧾' },
  { href: '/principal/finance/salary',         label: 'Salary',         icon: '👔' },
  { href: '/principal/finance/reconciliation', label: 'Reconciliation', icon: '🔍' },
  { href: '/principal/finance/reports',        label: 'Reports',        icon: '📈' },
  { href: '/principal/finance/permissions',    label: 'Permissions',    icon: '🔐' },
];

export default function PrincipalFinanceLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Role guard — only principal (and super_admin) may access this section
  useEffect(() => {
    const role = getRole();
    if (role && !['principal', 'super_admin', 'vice principal', 'head teacher', 'center head'].includes(role.toLowerCase())) {
      router.replace('/login');
    }
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Top bar */}
      <header className="h-14 bg-white border-b border-neutral-200 flex items-center justify-between px-4 shrink-0 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl hover:bg-neutral-100 text-neutral-500"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 3.5h12M2 8h12M2 12.5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
          <Link href="/principal" className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors">
            ← Dashboard
          </Link>
          <span className="text-neutral-300 hidden sm:block">/</span>
          <span className="text-sm font-semibold text-neutral-700 hidden sm:block">
            Finance — {FINANCE_NAV.find(n => pathname === n.href || (n.href !== '/principal/finance' && pathname.startsWith(n.href)))?.label || 'Overview'}
          </span>
        </div>
        <button
          onClick={() => { clearToken(); router.push('/login'); }}
          className="text-xs text-neutral-400 hover:text-neutral-700 px-3 py-1.5 rounded-xl hover:bg-neutral-100 transition-colors"
        >
          ↩ Sign out
        </button>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-52 shrink-0 bg-white border-r border-neutral-200">
          <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Finance</p>
            {FINANCE_NAV.map(item => {
              const isActive = pathname === item.href || (item.href !== '/principal/finance' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800'
                  }`}
                >
                  <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-56 bg-white border-r border-neutral-200 flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
                <span className="text-sm font-semibold text-neutral-700">Finance</span>
                <button onClick={() => setDrawerOpen(false)} className="text-neutral-400 w-8 h-8 flex items-center justify-center rounded-lg">✕</button>
              </div>
              <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto">
                {FINANCE_NAV.map(item => {
                  const isActive = pathname === item.href || (item.href !== '/principal/finance' && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setDrawerOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isActive ? 'bg-emerald-50 text-emerald-700' : 'text-neutral-500 hover:bg-neutral-100'
                      }`}
                    >
                      <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto min-w-0">{children}</main>
      </div>
    </div>
  );
}
