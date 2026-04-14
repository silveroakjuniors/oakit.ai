'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import OakitLogo from '@/components/OakitLogo';
import { clearToken } from '@/lib/auth';

const navItems = [
  { href: '/super-admin',         label: 'Dashboard', icon: '⊞' },
  { href: '/super-admin/schools', label: 'Schools',   icon: '🏫' },
];

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <aside className="w-60 shrink-0 flex flex-col"
        style={{
          background: 'linear-gradient(180deg, #1C1917 0%, #292524 100%)',
          boxShadow: '2px 0 20px rgba(0,0,0,0.15)',
        }}>
        <div className="px-5 py-6 border-b border-white/8">
          <OakitLogo size="sm" variant="light" showTagline />
          <span className="mt-2 inline-block text-2xs px-2 py-0.5 rounded-full bg-accent-500/20 text-accent-400 font-semibold tracking-wide">
            PLATFORM ADMIN
          </span>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          {navItems.map(item => {
            const isActive = pathname === item.href || (item.href !== '/super-admin' && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive ? 'bg-white/15 text-white' : 'text-white/55 hover:bg-white/8 hover:text-white/85'
                }`}>
                <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
                <span>{item.label}</span>
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-400 shrink-0" />}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-white/8">
          <button onClick={() => { clearToken(); router.push('/login'); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/45 hover:bg-white/8 hover:text-white/75 transition-all">
            <span className="text-base w-5 text-center">↩</span>
            <span>Sign out</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto min-w-0">{children}</main>
    </div>
  );
}
