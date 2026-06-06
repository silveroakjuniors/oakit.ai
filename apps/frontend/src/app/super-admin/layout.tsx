'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import OakitLogo from '@/components/OakitLogo';
import { clearToken, getToken, getRole } from '@/lib/auth';

const navItems = [
  { href: '/super-admin',                 label: 'Dashboard',        icon: '⊞' },
  { href: '/super-admin/schools',          label: 'Schools',          icon: '🏫' },
  { href: '/super-admin/franchises',       label: 'Franchises',       icon: '🏢' },
  { href: '/super-admin/billing',          label: 'AI Billing',       icon: '🤖' },
  { href: '/super-admin/platform-billing', label: 'Platform Billing', icon: '🧾' },
  { href: '/super-admin/finance',          label: 'Finance Module',   icon: '💰' },
  { href: '/super-admin/stats',            label: 'Analytics',        icon: '📊' },
];

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace('/login'); return; }
    const role = getRole();
    if (!role || role.toLowerCase() !== 'super_admin') {
      router.replace('/login');
      return;
    }
    setAuthChecked(true);
  }, [router]);

  if (!authChecked) return null;

  return (
    <div className="flex min-h-screen" style={{ background: '#0F1A13' }}>
      <aside className="w-60 shrink-0 flex flex-col"
        style={{
          background: 'linear-gradient(180deg, #0a1a0f 0%, #0d1f14 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}>
        <div className="px-5 py-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <OakitLogo size="sm" variant="light" showTagline />
          <span className="mt-3 inline-block text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}>
            Platform Admin
          </span>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          {navItems.map(item => {
            const isActive = pathname === item.href || (item.href !== '/super-admin' && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: isActive ? 'rgba(16,185,129,0.15)' : 'transparent',
                  color: isActive ? '#6ee7b7' : 'rgba(255,255,255,0.45)',
                  border: isActive ? '1px solid rgba(16,185,129,0.2)' : '1px solid transparent',
                }}>
                <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
                <span>{item.label}</span>
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#10b981' }} />}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => { clearToken(); router.push('/login'); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all"
            style={{ color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'; }}>
            <span className="text-base w-5 text-center">↩</span>
            <span>Sign out</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto min-w-0" style={{ background: '#0F1A13' }}>{children}</main>
    </div>
  );
}
