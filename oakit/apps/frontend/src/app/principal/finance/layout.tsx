'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getRole } from '@/lib/auth';

const FINANCE_NAV = [
  { href: '/principal/finance',                       label: 'Overview',              icon: '💰' },
  { href: '/principal/finance/fees',                  label: 'Collect Fee',           icon: '💳' },
  { href: '/principal/finance/fee-structures',        label: 'Fee Structures',        icon: '🏷️' },
  { href: '/principal/finance/concessions',           label: 'Concessions',           icon: '🎁' },
  { href: '/principal/finance/expenses',              label: 'Expenses',              icon: '🧾' },
  { href: '/principal/finance/salary',                label: 'Salary',                icon: '👔' },
  { href: '/principal/finance/reconciliation',        label: 'Cash Reconciliation',   icon: '💵' },
  { href: '/principal/finance/reconciliation/online', label: 'Online Reconciliation', icon: '🔍' },
  { href: '/principal/finance/reports',               label: 'Reports',               icon: '📈' },
  { href: '/principal/finance/permissions',           label: 'Permissions',           icon: '🔐' },
];

export default function PrincipalFinanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const role = getRole();
    if (role && !['principal', 'super_admin', 'vice principal', 'head teacher', 'center head'].includes(role.toLowerCase())) {
      router.replace('/login');
    }
  }, []);

  const activeLabel = FINANCE_NAV.find(
    n => pathname === n.href || (n.href !== '/principal/finance' && pathname.startsWith(n.href))
  )?.label ?? 'Overview';

  return (
    <div className="flex flex-col h-full">
      {/* ── Finance sub-nav strip ── */}
      <div className="bg-white border-b border-neutral-100 shrink-0">
        {/* Breadcrumb + mobile toggle */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-50">
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <Link href="/principal" className="hover:text-[#1B4332] transition-colors">Dashboard</Link>
            <span className="text-neutral-300">/</span>
            <span className="font-semibold text-neutral-700">Finance — {activeLabel}</span>
          </div>
          {/* Mobile: show/hide sub-nav */}
          <button
            onClick={() => setOpen(o => !o)}
            className="lg:hidden text-xs text-neutral-500 hover:text-neutral-700 flex items-center gap-1"
          >
            {open ? '▲ Hide' : '▼ Finance menu'}
          </button>
        </div>

        {/* Horizontal scrollable nav — always visible on desktop, toggle on mobile */}
        <div className={`${open ? 'flex' : 'hidden'} lg:flex overflow-x-auto px-3 py-1.5 gap-1`}>
          {FINANCE_NAV.map(item => {
            const isActive = pathname === item.href ||
              (item.href !== '/principal/finance' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                  isActive
                    ? 'bg-[#1B4332] text-white shadow-sm'
                    : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Page content ── */}
      <div className="flex-1 overflow-auto min-w-0">
        {children}
      </div>
    </div>
  );
}
