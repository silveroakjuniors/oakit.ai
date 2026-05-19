'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, ClipboardList, Users, BarChart2, TrendingUp,
  FileText, DollarSign, Camera, Megaphone, BookOpen, CalendarDays,
  ChevronLeft, ChevronRight, Menu, X, GraduationCap,
} from 'lucide-react';
import OakitLogo from '@/components/OakitLogo';
import { getRole } from '@/lib/auth';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { href: '/principal',               label: 'Dashboard',     Icon: LayoutDashboard, exact: true },
      { href: '/principal/feed',          label: 'School Feed',   Icon: Camera },
      { href: '/principal/announcements', label: 'Announcements', Icon: Megaphone },
    ],
  },
  {
    label: 'Academic',
    items: [
      { href: '/principal/attendance',  label: 'Attendance',  Icon: ClipboardList },
      { href: '/principal/teachers',    label: 'Teachers',    Icon: Users },
      { href: '/principal/coverage',    label: 'Coverage',    Icon: BarChart2 },
      { href: '/principal/curriculum',  label: 'Curriculum',  Icon: BookOpen },
      { href: '/principal/planner',     label: 'Planner',     Icon: CalendarDays },
      { href: '/principal/overview',    label: 'Reports',     Icon: TrendingUp },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/principal/finance',                  label: 'Finance Home',   Icon: DollarSign },
      { href: '/principal/finance/fees',             label: 'Collect Fee',    Icon: GraduationCap },
      { href: '/principal/finance/fee-structures',   label: 'Fee Structures', Icon: FileText },
      { href: '/principal/finance/concessions',      label: 'Concessions',    Icon: FileText },
      { href: '/principal/finance/expenses',         label: 'Expenses',       Icon: TrendingUp },
      { href: '/principal/finance/salary',           label: 'Salary',         Icon: Users },
      { href: '/principal/finance/reports',          label: 'Reports',        Icon: BarChart2 },
    ],
  },
  {
    label: 'HR & Admin',
    items: [
      { href: '/principal/hr', label: 'Staff HR', Icon: FileText },
    ],
  },
];

function NavItem({ href, label, Icon, exact, collapsed, onClick }: {
  href: string; label: string; Icon: any; exact?: boolean;
  collapsed: boolean; onClick?: () => void;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : (pathname.startsWith(href) && href !== '/principal');
  const isDashboard = href === '/principal' && pathname === '/principal';
  const isActive = active || isDashboard;

  return (
    <Link href={href} onClick={onClick}
      className={`relative flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all group ${
        isActive
          ? 'bg-white/15 text-white'
          : 'text-white/50 hover:bg-white/8 hover:text-white/80'
      } ${collapsed ? 'justify-center' : ''}`}
      title={collapsed ? label : undefined}
    >
      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#74c69d]' : 'text-white/40 group-hover:text-white/60'}`} />
      {!collapsed && (
        <span className="text-xs font-medium truncate">{label}</span>
      )}
      {isActive && !collapsed && (
        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#74c69d] shrink-0" />
      )}
      {/* Tooltip when collapsed */}
      {collapsed && (
        <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-neutral-900 text-white text-xs rounded-lg
          opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity shadow-lg">
          {label}
        </div>
      )}
    </Link>
  );
}

export default function PrincipalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const role = getRole();
    if (role && !['principal', 'admin', 'super_admin'].includes(role.toLowerCase())) {
      router.replace('/login');
    }
  }, []);

  const SidebarInner = ({ onItemClick }: { onItemClick?: () => void }) => (
    <div className="flex flex-col h-full"
      style={{ background: 'linear-gradient(180deg, #0a1f14 0%, #1a3c2e 60%, #0f2d1e 100%)' }}>

      {/* Logo + collapse */}
      <div className={`flex items-center border-b border-white/10 shrink-0 ${collapsed ? 'justify-center px-2 py-4' : 'justify-between px-4 py-4'}`}>
        {!collapsed && <OakitLogo size="xs" variant="light" />}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="hidden lg:flex w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 items-center justify-center text-white/60 hover:text-white transition-all"
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-[9px] font-bold text-white/25 uppercase tracking-widest px-3 mb-1.5">
                {group.label}
              </p>
            )}
            {collapsed && <div className="border-t border-white/10 my-2" />}
            <div className="space-y-0.5">
              {group.items.map(item => (
                <NavItem key={item.href} {...item} collapsed={collapsed} onClick={onItemClick} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div className={`border-t border-white/10 p-2 shrink-0 ${collapsed ? 'flex justify-center' : ''}`}>
        <Link href="/principal"
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-white/30 hover:text-white/60 hover:bg-white/8 transition-all ${collapsed ? 'justify-center' : ''}`}>
          <LayoutDashboard size={14} className="shrink-0" />
          {!collapsed && <span className="text-[10px]">Principal Home</span>}
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen lg:h-screen lg:overflow-hidden" style={{ background: '#F0F2F5' }}>

      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex flex-col shrink-0 transition-all duration-200 ${collapsed ? 'w-14' : 'w-52'}`}>
        <SidebarInner />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-60 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/10"
              style={{ background: '#0a1f14' }}>
              <OakitLogo size="xs" variant="light" />
              <button onClick={() => setMobileOpen(false)}
                className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-white/60">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarInner onItemClick={() => setMobileOpen(false)} />
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-neutral-100 shrink-0">
          <button onClick={() => setMobileOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-neutral-100 text-neutral-500">
            <Menu size={16} />
          </button>
          <OakitLogo size="xs" />
        </div>

        <main className="flex-1 min-h-0 overflow-y-auto lg:overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
