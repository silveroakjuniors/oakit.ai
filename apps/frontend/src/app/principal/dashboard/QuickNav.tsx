'use client';
import Link from 'next/link';
import { ClipboardList, Users, BarChart2, TrendingUp, FileText, DollarSign } from 'lucide-react';

const NAV = [
  { href: '/principal/attendance', label: 'Attendance', Icon: ClipboardList, from: '#6366f1', to: '#4f46e5' },
  { href: '/principal/teachers',   label: 'Teachers',   Icon: Users,         from: '#10b981', to: '#059669' },
  { href: '/principal/coverage',   label: 'Coverage',   Icon: BarChart2,     from: '#f59e0b', to: '#d97706' },
  { href: '/principal/overview',   label: 'Reports',    Icon: TrendingUp,    from: '#8b5cf6', to: '#7c3aed' },
  { href: '/principal/hr',         label: 'Staff HR',   Icon: FileText,      from: '#14b8a6', to: '#0d9488' },
  { href: '/principal/finance',    label: 'Finance',    Icon: DollarSign,    from: '#22c55e', to: '#16a34a' },
];

export default function QuickNav() {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {NAV.map(({ href, label, Icon, from, to }) => (
        <Link key={href} href={href}
          className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-white border border-neutral-100 hover:shadow-md hover:-translate-y-0.5 transition-all group shadow-sm">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
            style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <span className="text-[10px] font-semibold text-neutral-600 leading-tight text-center">{label}</span>
        </Link>
      ))}
    </div>
  );
}
