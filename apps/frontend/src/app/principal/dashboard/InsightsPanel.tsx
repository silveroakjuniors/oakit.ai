'use client';
import React, { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { ChevronDown, ChevronUp, Users, DollarSign, GraduationCap, AlertCircle } from 'lucide-react';
import { apiGet } from '@/lib/api';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FeeAssignment {
  total_students: number;
  students_with_fee: number;
  students_without_fee: number;
  total_assigned: number;
  total_outstanding: number;
  total_collected: number;
}
interface Instalment {
  label: string;
  instalment_number: number;
  due_date: string | null;
  fee_head_name: string;
  student_count: number;
  total_due: number;
}
interface ConcessionSummary {
  pending: number;
  approved: number;
  rejected: number;
  approved_amount: number;
  pending_count: number;
}
interface PersonActivity {
  id: string;
  name: string;
  mobile?: string;
  children_count?: number;
  children_names?: string;
  messages_sent_30d?: number;
  plans_30d?: number;
  attendance_30d?: number;
  homework_30d?: number;
  streak?: number;
  last_plan?: string;
  activity_status: 'active' | 'inactive' | 'never_logged_in' | 'low';
}
interface ActivitySummary {
  total: number;
  active: number;
  inactive: number;
  never_logged_in?: number;
  low?: number;
  list: PersonActivity[];
}
interface InsightsData {
  fee_assignment: FeeAssignment;
  instalments: Instalment[];
  concessions: ConcessionSummary;
  parents: ActivitySummary;
  teachers: ActivitySummary;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)}Cr`;
  if (n >= 10_00_000)   return `₹${(n / 10_00_000).toFixed(1)}L`;
  if (n >= 1_000)       return `₹${(n / 1_000).toFixed(0)}K`;
  return `₹${n.toFixed(0)}`;
}

const STATUS_COLOR: Record<string, string> = {
  active:          '#10b981',
  low:             '#f59e0b',
  inactive:        '#f87171',
  never_logged_in: '#9ca3af',
};
const STATUS_LABEL: Record<string, string> = {
  active:          'Active',
  low:             'Low activity',
  inactive:        'Inactive',
  never_logged_in: 'Never logged in',
};

// ── Drill-down list ───────────────────────────────────────────────────────────
function DrillList({
  items, type,
}: {
  items: PersonActivity[];
  type: 'parent' | 'teacher';
}) {
  const [filter, setFilter] = useState<string>('all');
  const filtered = filter === 'all' ? items : items.filter(i => i.activity_status === filter);

  const statuses = type === 'parent'
    ? ['all', 'active', 'inactive', 'never_logged_in']
    : ['all', 'active', 'low', 'inactive'];

  return (
    <div className="mt-3 space-y-2">
      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {statuses.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-2.5 py-1 rounded-lg text-[9px] font-semibold transition-all ${
              filter === s
                ? 'text-white shadow-sm'
                : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
            }`}
            style={filter === s ? { background: s === 'all' ? '#1B4332' : STATUS_COLOR[s] } : {}}>
            {s === 'all' ? `All (${items.length})` : `${STATUS_LABEL[s]} (${items.filter(i => i.activity_status === s).length})`}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="text-xs text-neutral-400 text-center py-4">No records</p>
        ) : filtered.map(person => (
          <div key={person.id}
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-neutral-50 border border-neutral-100">
            {/* Avatar */}
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ background: STATUS_COLOR[person.activity_status] }}>
              {person.name?.[0] ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-neutral-800 truncate">{person.name}</p>
              {type === 'parent' && person.children_names && (
                <p className="text-[9px] text-neutral-400 truncate">{person.children_names}</p>
              )}
              {type === 'teacher' && (
                <p className="text-[9px] text-neutral-400">
                  {person.plans_30d ?? 0} plans · {person.attendance_30d ?? 0} att · streak {person.streak ?? 0}
                </p>
              )}
              {type === 'parent' && (
                <p className="text-[9px] text-neutral-400">
                  {person.messages_sent_30d ?? 0} messages in 30d
                </p>
              )}
            </div>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 text-white"
              style={{ background: STATUS_COLOR[person.activity_status] }}>
              {STATUS_LABEL[person.activity_status]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Collapsible section ───────────────────────────────────────────────────────
function Section({
  title, subtitle, badge, accent, children, defaultOpen = false,
}: {
  title: string; subtitle?: string; badge?: React.ReactNode;
  accent?: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${accent || 'border-neutral-100'}`}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50/60 transition-colors text-left">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="min-w-0">
            <p className="text-sm font-bold text-neutral-800 truncate">{title}</p>
            {subtitle && <p className="text-[10px] text-neutral-400 mt-0.5">{subtitle}</p>}
          </div>
          {badge}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-neutral-400 shrink-0" />
               : <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />}
      </button>
      {open && <div className="border-t border-neutral-100 px-4 pb-4 pt-3">{children}</div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function InsightsPanel({ token }: { token: string }) {
  const [data, setData]     = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<InsightsData>('/api/v1/principal/context/insights', token)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-neutral-100 h-16 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { fee_assignment: fa, instalments, concessions, parents, teachers } = data;

  // ── Fee assignment pie ──
  const feeAssignPie = [
    { name: 'Fee Assigned',    value: fa.students_with_fee,    color: '#10b981' },
    { name: 'No Fee Assigned', value: fa.students_without_fee, color: '#f87171' },
  ].filter(d => d.value > 0);

  // ── Fee collected vs outstanding pie ──
  const feeStatusPie = [
    { name: 'Collected',    value: fa.total_collected,   color: '#10b981' },
    { name: 'Outstanding',  value: fa.total_outstanding, color: '#f87171' },
  ].filter(d => d.value > 0);

  // ── Instalment bar data ──
  const instBar = instalments.slice(0, 8).map(i => ({
    name: i.label.length > 10 ? i.label.slice(0, 10) : i.label,
    full: i.label,
    due:  i.total_due,
    head: i.fee_head_name,
  }));

  // ── Concession pie ──
  const concPie = [
    { name: 'Approved', value: concessions.approved, color: '#10b981' },
    { name: 'Pending',  value: concessions.pending,  color: '#f59e0b' },
    { name: 'Rejected', value: concessions.rejected, color: '#f87171' },
  ].filter(d => d.value > 0);

  // ── Parent activity pie ──
  const parentPie = [
    { name: 'Active',          value: parents.active,           color: '#10b981' },
    { name: 'Inactive',        value: parents.inactive,         color: '#f87171' },
    { name: 'Never logged in', value: parents.never_logged_in ?? 0, color: '#9ca3af' },
  ].filter(d => d.value > 0);

  // ── Teacher activity pie ──
  const teacherPie = [
    { name: 'Active',       value: teachers.active,   color: '#10b981' },
    { name: 'Low activity', value: teachers.low ?? 0, color: '#f59e0b' },
    { name: 'Inactive',     value: teachers.inactive, color: '#f87171' },
  ].filter(d => d.value > 0);

  const RADIAN = Math.PI / 180;
  function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
    if (percent < 0.1) return null;
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      fontSize={9} fontWeight={700}>{`${(percent * 100).toFixed(0)}%`}</text>;
  }

  function MiniDonut({ data: d, size = 100 }: { data: { name: string; value: number; color: string }[]; size?: number }) {
    return (
      <div style={{ width: size, height: size }} className="shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={d} cx="50%" cy="50%" innerRadius="38%" outerRadius="58%"
              dataKey="value" labelLine={false} label={PieLabel}>
              {d.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Pie>
            <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }}
              formatter={(v: any, name: any) => [v, name]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  function Legend({ items }: { items: { name: string; value: number; color: string }[] }) {
    return (
      <div className="flex flex-col gap-1.5 flex-1">
        {items.map(d => (
          <div key={d.name} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
            <div className="flex-1 flex items-center justify-between">
              <p className="text-[10px] text-neutral-600">{d.name}</p>
              <p className="text-[10px] font-bold text-neutral-800">{d.value}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const assignPct = fa.total_students > 0
    ? Math.round((fa.students_with_fee / fa.total_students) * 100)
    : 0;
  const collPct = fa.total_assigned > 0
    ? Math.round((fa.total_collected / fa.total_assigned) * 100)
    : 0;
  const parentActivePct = parents.total > 0
    ? Math.round((parents.active / parents.total) * 100)
    : 0;
  const teacherActivePct = teachers.total > 0
    ? Math.round((teachers.active / teachers.total) * 100)
    : 0;

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">School Insights</p>

      {/* ── 1. Fee Assignment ── */}
      <Section
        title="Fee Assignment"
        subtitle={`${fa.students_with_fee} of ${fa.total_students} students have fee assigned`}
        defaultOpen={true}
        accent={fa.students_without_fee > 0 ? 'border-amber-200' : 'border-neutral-100'}
        badge={
          fa.students_without_fee > 0
            ? <span className="ml-2 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">
                {fa.students_without_fee} unassigned
              </span>
            : <span className="ml-2 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                All assigned ✓
              </span>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          {/* Assignment donut */}
          <div>
            <p className="text-[9px] font-semibold text-neutral-500 mb-2 uppercase tracking-wide">Students</p>
            <div className="flex items-center gap-2">
              <MiniDonut data={feeAssignPie} size={80} />
              <div className="flex flex-col gap-1">
                {feeAssignPie.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    <p className="text-[9px] text-neutral-600">{d.name}</p>
                    <p className="text-[9px] font-bold text-neutral-800 ml-auto">{d.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Collection donut */}
          <div>
            <p className="text-[9px] font-semibold text-neutral-500 mb-2 uppercase tracking-wide">Fee Status</p>
            <div className="flex items-center gap-2">
              <MiniDonut data={feeStatusPie} size={80} />
              <div className="flex flex-col gap-1">
                {feeStatusPie.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    <p className="text-[9px] text-neutral-600">{d.name}</p>
                    <p className="text-[9px] font-bold text-neutral-800 ml-auto">{fmt(d.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Total Assigned', value: fmt(fa.total_assigned), color: '#6366f1' },
            { label: 'Collected',      value: fmt(fa.total_collected), color: '#10b981' },
            { label: 'Outstanding',    value: fmt(fa.total_outstanding), color: '#f87171' },
          ].map(k => (
            <div key={k.label} className="bg-neutral-50 rounded-xl p-2.5 text-center border border-neutral-100">
              <p className="text-xs font-black" style={{ color: k.color }}>{k.value}</p>
              <p className="text-[9px] text-neutral-400 mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>

        {fa.students_without_fee > 0 && (
          <Link href="/principal/finance/fee-structures"
            className="mt-3 flex items-center justify-between px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors">
            <p className="text-xs font-semibold text-amber-800">
              {fa.students_without_fee} students have no fee assigned
            </p>
            <span className="text-xs text-amber-600 font-bold">Fix &rarr;</span>
          </Link>
        )}
      </Section>

      {/* ── 2. Instalment Status ── */}
      {instalments.length > 0 && (
        <Section
          title="Instalment Schedule"
          subtitle={`${instalments.length} instalments across all fee heads`}
        >
          <div style={{ height: 150 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={instBar} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 8 }} />
                <YAxis tick={{ fontSize: 8 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }}
                  formatter={(v: any, _: any, p: any) => [fmt(v), p.payload.head]} />
                <Bar dataKey="due" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto">
            {instalments.map((inst, i) => (
              <div key={i} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-neutral-50 border border-neutral-100">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-neutral-700 truncate">{inst.label}</p>
                  <p className="text-[9px] text-neutral-400">{inst.fee_head_name} · {inst.student_count} students</p>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-[10px] font-bold text-indigo-600">{fmt(inst.total_due)}</p>
                  {inst.due_date && (
                    <p className="text-[9px] text-neutral-400">
                      Due {new Date(inst.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── 3. Concessions ── */}
      <Section
        title="Concessions"
        subtitle={`${concessions.approved + concessions.pending + concessions.rejected} total · ${fmt(concessions.approved_amount)} approved`}
        accent={concessions.pending > 0 ? 'border-amber-200' : 'border-neutral-100'}
        badge={
          concessions.pending > 0
            ? <span className="ml-2 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">
                {concessions.pending} pending
              </span>
            : undefined
        }
      >
        <div className="flex items-center gap-4">
          <MiniDonut data={concPie} size={90} />
          <div className="flex-1 space-y-1.5">
            {[
              { label: 'Approved', value: concessions.approved, amount: fmt(concessions.approved_amount), color: '#10b981' },
              { label: 'Pending',  value: concessions.pending,  amount: '—',                              color: '#f59e0b' },
              { label: 'Rejected', value: concessions.rejected, amount: '—',                              color: '#f87171' },
            ].map(c => (
              <div key={c.label} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                <p className="text-[10px] text-neutral-600 flex-1">{c.label}</p>
                <p className="text-[10px] font-bold text-neutral-800">{c.value}</p>
                <p className="text-[9px] text-neutral-400 w-12 text-right">{c.amount}</p>
              </div>
            ))}
          </div>
        </div>
        {concessions.pending > 0 && (
          <Link href="/principal/finance/concessions"
            className="mt-3 flex items-center justify-between px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors">
            <p className="text-xs font-semibold text-amber-800">
              {concessions.pending} concession{concessions.pending !== 1 ? 's' : ''} awaiting your approval
            </p>
            <span className="text-xs text-amber-600 font-bold">Review →</span>
          </Link>
        )}
      </Section>

      {/* ── 4. Parent Activity ── */}
      <Section
        title="Parent App Activity"
        subtitle={`${parents.active} of ${parents.total} parents active in last 30 days`}
        accent={(parents.never_logged_in ?? 0) > 0 ? 'border-red-100' : 'border-neutral-100'}
        badge={
          <span className="ml-2 text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0"
            style={{ background: parentActivePct >= 60 ? '#d1fae5' : '#fee2e2', color: parentActivePct >= 60 ? '#065f46' : '#991b1b' }}>
            {parentActivePct}% active
          </span>
        }
      >
        <div className="flex items-center gap-4 mb-3">
          <MiniDonut data={parentPie} size={90} />
          <Legend items={parentPie} />
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'Active',          value: parents.active,              color: '#10b981' },
            { label: 'Inactive',        value: parents.inactive,            color: '#f87171' },
            { label: 'Never logged in', value: parents.never_logged_in ?? 0, color: '#9ca3af' },
          ].map(s => (
            <div key={s.label} className="bg-neutral-50 rounded-xl p-2 text-center border border-neutral-100">
              <p className="text-sm font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[9px] text-neutral-400 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Drill-down list */}
        <DrillList items={parents.list} type="parent" />
      </Section>

      {/* ── 5. Teacher Activity ── */}
      <Section
        title="Teacher App Activity"
        subtitle={`${teachers.active} active · ${teachers.inactive} inactive · ${teachers.low ?? 0} low activity`}
        accent={teachers.inactive > 0 ? 'border-red-100' : 'border-neutral-100'}
        badge={
          <span className="ml-2 text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0"
            style={{ background: teacherActivePct >= 70 ? '#d1fae5' : '#fee2e2', color: teacherActivePct >= 70 ? '#065f46' : '#991b1b' }}>
            {teacherActivePct}% active
          </span>
        }
      >
        <div className="flex items-center gap-4 mb-3">
          <MiniDonut data={teacherPie} size={90} />
          <Legend items={teacherPie} />
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'Active',       value: teachers.active,   color: '#10b981' },
            { label: 'Low activity', value: teachers.low ?? 0, color: '#f59e0b' },
            { label: 'Inactive',     value: teachers.inactive, color: '#f87171' },
          ].map(s => (
            <div key={s.label} className="bg-neutral-50 rounded-xl p-2 text-center border border-neutral-100">
              <p className="text-sm font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[9px] text-neutral-400 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Drill-down list */}
        <DrillList items={teachers.list} type="teacher" />
      </Section>
    </div>
  );
}
