'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ClipboardList, Users, BarChart2,
  TrendingUp, FileText, DollarSign, BookOpen, Calendar,
  Camera, Megaphone, ChevronLeft, ChevronRight, LogOut,
  GraduationCap, Settings,
} from 'lucide-react';
import OakitLogo from '@/components/OakitLogo';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { href: '/principal', label: 'Dashboard', Icon: LayoutDashboard, exact: true },
      { href: '/principal/attendance', label: 'Attendance', Icon: ClipboardList },
      { href: '/principal/teachers', label: 'Teachers', Icon: Users },
      { href: '/principal/coverage', label: 'Coverage', Icon: BarChart2 },
      { href: '/principal/overview', label: 'Reports', Icon: TrendingUp },
    ],
  },
  {
    label: 'School',
    items: [
      { href: '/principal/feed', label: 'School Feed', Icon: Camera },
      { href: '/principal/announcements', label: 'Announcements', Icon: Megaphone },
      { href: '/principal/curriculum', label: 'Curriculum', Icon: BookOpen },
      { href: '/principal/planner', label: 'Planner', Icon: FileText },
      { href: '/principal/calendar', label: 'Calendar', Icon: Calendar },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/principal/finance', label: 'Finance Hub', Icon: DollarSign },
      { href: '/principal/finance/fees', label: 'Fee Management', Icon: GraduationCap },
      { href: '/principal/finance/salary', label: 'Salary', Icon: FileText },
    ],
  },
  {
    label: 'HR & Admin',
    items: [
      { href: '/principal/hr', label: 'Staff HR', Icon: FileText },
      { href: '/principal/settings', label: 'Settings', Icon: Settings },
    ],
  },
];

interface Props {
  onSignOut: () => void;
  principalName: string;
}

export default function SideNav({ onSignOut, principalName }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href) && href !== '/principal';

  return (
    <aside
      className={`hidden lg:flex flex-col shrink-0 bg-[#0a1f14] text-white transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-56'
      }`}
      style={{ height: '100vh', position: 'sticky', top: 0 }}
    >
      {/* Logo + collapse */}
      <div className={`flex items-center justify-between px-3 py-4 border-b border-white/10 ${collapsed ? 'px-2' : ''}`}>
        {!collapsed && <OakitLogo size="xs" variant="light" />}
        <button
          onClick={() => setCollapsed(c => !c)}
          className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white ${collapsed ? 'mx-auto' : ''}`}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-4 px-2">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest px-2 mb-1">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ href, label, Icon, exact }) => {
                const active = isActive(href, exact);
                return (
                  <Link
                    key={href}
                    href={href}
                    title={collapsed ? label : undefined}
                    className={`flex items-center gap-2.5 px-2 py-2 rounded-xl transition-all text-sm font-medium ${
                      active
                        ? 'bg-white/15 text-white'
                        : 'text-white/50 hover:bg-white/8 hover:text-white/80'
                    } ${collapsed ? 'justify-center' : ''}`}
                  >
                    <Icon className={`shrink-0 ${active ? 'text-[#74c69d]' : ''}`} size={16} />
                    {!collapsed && <span className="truncate text-xs">{label}</span>}
                    {active && !collapsed && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#74c69d]" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User + sign out */}
      <div className={`border-t border-white/10 p-3 ${collapsed ? 'flex justify-center' : ''}`}>
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#2d6a4f] flex items-center justify-center text-xs font-bold text-white shrink-0">
              {principalName?.[0] ?? 'P'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white/80 truncate">{principalName}</p>
              <p className="text-[9px] text-white/30">Principal</p>
            </div>
            <button onClick={onSignOut}
              className="p-1 rounded-lg hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button onClick={onSignOut}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
