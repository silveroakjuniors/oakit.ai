'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE, apiGet, apiPost } from '@/lib/api';
import { getToken, signOut } from '@/lib/auth';
import OakitLogo from '@/components/OakitLogo';
import { X, Loader2, Sparkles, CheckCircle2, Plus, Pencil, Trash2, Wand2, Users, TrendingUp, Award, BookOpen, BarChart3, PieChart } from 'lucide-react';
import InlineMicButton from '@/components/InlineMicButton';

interface Student { id: string; name: string; class_name: string; section_label: string; photo_url?: string; }
interface Section { section_id: string; section_label: string; class_name: string; role: string; }
interface Observation { id: string; obs_text: string | null; categories: string[]; share_with_parent: boolean; obs_date: string; created_at: string; teacher_name: string; }
interface Milestone {
  id: string; domain: string; description: string; position: number;
  is_custom: boolean; term: string | null;
  achieved_at: string | null; achieved_by: string | null; achievement_comment: string | null;
  parent_note: string | null; parent_noted_at: string | null;
}
interface MilestoneData { class_level: string; milestones: Milestone[]; total: number; achieved: number; completion_pct: number; }
interface ClassInsights {
  total_students: number;
  section_info: { section_id: string; section_label: string; class_name: string };
  attendance: { present_count: number; absent_count: number; late_count: number; school_days: number; avg_attendance_pct: number };
  attendance_trend: { date: string; present: number; absent: number }[];
  milestones_by_domain: { domain: string; total: number; achieved: number }[];
  observations_by_category: { category: string; count: number }[];
  student_milestone_ranking: { id: string; name: string; achieved_count: number }[];
  journal: { total_entries: number; students_with_entries: number };
}
interface StudentInsights {
  student: { id: string; name: string; date_of_birth: string; photo_url: string; class_name: string; section_label: string };
  attendance: { present: number; absent: number; late: number; total_days: number; pct: number };
  attendance_trend: { date: string; status: string }[];
  milestones_by_domain: { domain: string; total: number; achieved: number }[];
  milestone_summary: { total: number; achieved: number; pct: number };
  observations_by_category: { category: string; count: number }[];
  journal_entries_count: number;
}

const CATEGORY_CONFIG = [
  { id: 'Cognitive Skills',         label: 'Cognitive Skills',         icon: '🧠', color: 'text-pink-700',    bg: 'bg-pink-50',    border: 'border-pink-200', chartColor: '#be185d' },
  { id: 'Language & Communication', label: 'Language & Communication', icon: '🗣️', color: 'text-purple-700',  bg: 'bg-purple-50',  border: 'border-purple-200', chartColor: '#7c3aed' },
  { id: 'Social Interaction',       label: 'Social Interaction',       icon: '🤝', color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200', chartColor: '#d97706' },
  { id: 'Motor Skills',             label: 'Motor Skills',             icon: '🏃', color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200', chartColor: '#1d4ed8' },
  { id: 'Emotional Development',    label: 'Emotional Development',    icon: '💛', color: 'text-yellow-700',  bg: 'bg-yellow-50',  border: 'border-yellow-200', chartColor: '#ca8a04' },
  { id: 'Creative Expression',      label: 'Creative Expression',      icon: '🎨', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', chartColor: '#059669' },
  { id: 'Academic Progress',        label: 'Academic Progress',        icon: '📚', color: 'text-indigo-700',  bg: 'bg-indigo-50',  border: 'border-indigo-200', chartColor: '#4338ca' },
  { id: 'Behavior',                 label: 'Behavior',                 icon: '⭐', color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200', chartColor: '#ea580c' },
  { id: 'Physical Health',          label: 'Physical Health',          icon: '💪', color: 'text-teal-700',    bg: 'bg-teal-50',    border: 'border-teal-200', chartColor: '#0d9488' },
  { id: 'Other',                    label: 'Other',                    icon: '📌', color: 'text-neutral-700', bg: 'bg-neutral-50', border: 'border-neutral-200', chartColor: '#525252' },
] as const;

const DOMAIN_ICONS: Record<string, string> = { Cognitive: '🧠', Social: '🤝', Motor: '🏃', Language: '🗣️', Other: '📌' };
const DOMAIN_COLORS: Record<string, string> = {
  Cognitive: '#be185d', Social: '#d97706', Motor: '#1d4ed8', Language: '#7c3aed',
  Emotional: '#ca8a04', GrossMotor: '#0d9488', FineMotor: '#4338ca', Creativity: '#059669',
  Participation: '#ea580c', Peer: '#6366f1', Behaviour: '#f59e0b', Other: '#525252',
};

// ── SVG Chart Components ──────────────────────────────────────────────────────

function DonutChart({ data, size = 120, strokeWidth = 18 }: { data: { label: string; value: number; color: string }[]; size?: number; strokeWidth?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="flex items-center justify-center" style={{ width: size, height: size }}><p className="text-xs text-neutral-400">No data</p></div>;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {data.map((d, i) => {
        const pct = d.value / total;
        const dashLength = pct * circumference;
        const dashOffset = -offset * circumference;
        offset += pct;
        return (
          <circle key={i} cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={d.color} strokeWidth={strokeWidth}
            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="transition-all duration-500" />
        );
      })}
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" className="text-lg font-bold fill-neutral-800">{total}</text>
    </svg>
  );
}

function BarChart({ data, height = 140 }: { data: { label: string; value: number; max: number; color: string }[]; height?: number }) {
  if (data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => d.max), 1);
  const barWidth = Math.min(32, Math.floor(280 / data.length));

  return (
    <div className="flex items-end justify-center gap-1" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1" style={{ width: barWidth }}>
          <span className="text-[9px] font-bold text-neutral-600">{d.value}/{d.max}</span>
          <div className="w-full rounded-t-md relative" style={{ height: `${Math.max((d.value / maxVal) * (height - 40), 4)}px`, background: d.color, opacity: 0.85 }} />
          <div className="w-full rounded-t-md absolute bottom-0" style={{ height: `${Math.max((d.max / maxVal) * (height - 40), 4)}px`, background: d.color, opacity: 0.15 }} />
          <span className="text-[8px] text-neutral-500 truncate w-full text-center">{d.label.slice(0, 6)}</span>
        </div>
      ))}
    </div>
  );
}

function LineChart({ data, height = 80, color = '#1B4332' }: { data: number[]; height?: number; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const width = 260;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - (v / max) * (height - 10)}`).join(' ');
  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polygon points={areaPoints} fill={color} opacity="0.08" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => (
        <circle key={i} cx={(i / (data.length - 1)) * width} cy={height - (v / max) * (height - 10)} r="3" fill={color} />
      ))}
    </svg>
  );
}

function MiniProgressRing({ pct, size = 44, color = '#1B4332' }: { pct: number; size?: number; color?: string }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="5" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${dash} ${c - dash}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} className="transition-all duration-700" />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" className="text-[10px] font-bold" fill={color}>{pct}%</text>
    </svg>
  );
}

// ── Class Insights Dashboard ──────────────────────────────────────────────────
function ClassInsightsDashboard({ insights }: { insights: ClassInsights }) {
  // Generate distinct colors for observation categories that may not be in CATEGORY_CONFIG
  const CHART_COLORS = ['#4338ca', '#059669', '#be185d', '#d97706', '#1d4ed8', '#7c3aed', '#ea580c', '#0d9488', '#ca8a04', '#6366f1', '#dc2626', '#16a34a'];
  
  const obsDonutData = insights.observations_by_category.slice(0, 8).map((o, i) => {
    const cat = CATEGORY_CONFIG.find(c => c.id === o.category);
    return { label: o.category, value: o.count, color: cat?.chartColor || CHART_COLORS[i % CHART_COLORS.length] };
  });

  const milestoneBarData = insights.milestones_by_domain.map((m, i) => ({
    label: m.domain, value: m.achieved, max: m.total,
    color: DOMAIN_COLORS[m.domain] || CHART_COLORS[i % CHART_COLORS.length],
  }));

  const attendanceTrend = insights.attendance_trend.map(d => d.present);
  const topPerformers = insights.student_milestone_ranking.slice(0, 5);
  const needsAttention = [...insights.student_milestone_ranking].reverse().slice(0, 3);

  return (
    <div className="flex flex-col gap-4">
      {/* Stat cards row */}
      <div className="grid grid-cols-2 gap-3 isolate">
        <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl p-4 text-white shadow-lg overflow-hidden">
          <Users className="w-5 h-5 opacity-70 mb-1" />
          <p className="text-2xl font-bold">{insights.total_students}</p>
          <p className="text-xs opacity-80">Total Students</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-4 text-white shadow-lg overflow-hidden">
          <TrendingUp className="w-5 h-5 opacity-70 mb-1" />
          <p className="text-2xl font-bold">{insights.attendance.avg_attendance_pct}%</p>
          <p className="text-xs opacity-80">Avg Attendance</p>
        </div>
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl p-4 text-white shadow-lg overflow-hidden">
          <Award className="w-5 h-5 opacity-70 mb-1" />
          <p className="text-2xl font-bold">{insights.milestones_by_domain.reduce((s, m) => s + m.achieved, 0)}</p>
          <p className="text-xs opacity-80">Milestones Achieved</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-700 rounded-2xl p-4 text-white shadow-lg overflow-hidden">
          <BookOpen className="w-5 h-5 opacity-70 mb-1" />
          <p className="text-2xl font-bold">{insights.journal.total_entries}</p>
          <p className="text-xs opacity-80">Journal Entries</p>
        </div>
      </div>

      {/* Attendance trend line chart */}
      {insights.attendance_trend.length > 1 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-100">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <p className="text-sm font-bold text-neutral-800">Attendance Trend (Last 7 Days)</p>
          </div>
          <LineChart data={attendanceTrend} color="#059669" />
          <div className="flex justify-between mt-2">
            {insights.attendance_trend.map((d, i) => (
              <span key={i} className="text-[8px] text-neutral-400">
                {new Date(d.date + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Milestone progress bar chart */}
      {milestoneBarData.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-100">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            <p className="text-sm font-bold text-neutral-800">Milestones by Domain</p>
          </div>
          <BarChart data={milestoneBarData} />
          <div className="flex flex-wrap gap-2 mt-3">
            {milestoneBarData.map(d => (
              <span key={d.label} className="flex items-center gap-1 text-[9px] text-neutral-600">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                {d.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Observations donut chart */}
      {obsDonutData.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-100">
          <div className="flex items-center gap-2 mb-3">
            <PieChart className="w-4 h-4 text-pink-600" />
            <p className="text-sm font-bold text-neutral-800">Observations by Category</p>
          </div>
          <div className="flex items-center gap-4">
            <DonutChart data={obsDonutData} size={130} />
            <div className="flex flex-col gap-1.5 flex-1">
              {obsDonutData.map(d => (
                <div key={d.label} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-[10px] text-neutral-600 flex-1 truncate">{d.label}</span>
                  <span className="text-[10px] font-bold text-neutral-800">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top performers */}
      {topPerformers.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-100 overflow-hidden">
          <p className="text-sm font-bold text-neutral-800 mb-3">🏆 Top Milestone Achievers</p>
          <div className="flex flex-col gap-2">
            {topPerformers.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-neutral-200 text-neutral-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-neutral-100 text-neutral-500'
                }`}>{i + 1}</span>
                <span className="text-sm text-neutral-700 flex-1">{s.name}</span>
                <span className="text-xs font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full">{s.achieved_count} ✓</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Needs attention */}
      {needsAttention.length > 0 && needsAttention[0].achieved_count < topPerformers[0]?.achieved_count && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 overflow-hidden">
          <p className="text-sm font-bold text-amber-800 mb-2">💡 May Need Extra Support</p>
          <div className="flex flex-col gap-1.5">
            {needsAttention.map(s => (
              <div key={s.id} className="flex items-center gap-2">
                <span className="text-xs text-amber-700 flex-1">{s.name}</span>
                <span className="text-[10px] text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">{s.achieved_count} milestones</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Student Insights Panel ────────────────────────────────────────────────────
function StudentInsightsPanel({ insights }: { insights: StudentInsights }) {
  const milestoneDonut = insights.milestones_by_domain.map(m => ({
    label: m.domain, value: m.achieved, color: DOMAIN_COLORS[m.domain] || '#525252',
  }));

  const obsDonut = insights.observations_by_category.map(o => {
    const cat = CATEGORY_CONFIG.find(c => c.id === o.category);
    return { label: o.category, value: o.count, color: cat?.chartColor || '#525252' };
  });

  // Attendance sparkline: 1 = present, 0 = absent
  const attSparkline = insights.attendance_trend.map(d => d.status === 'present' ? 1 : 0);

  // Calculate age
  let ageText = '';
  if (insights.student.date_of_birth) {
    const dob = new Date(insights.student.date_of_birth);
    const now = new Date();
    const months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
    const y = Math.floor(months / 12);
    const m = months % 12;
    ageText = y > 0 ? `${y}y ${m}m` : `${m}m`;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-2xl p-3 text-center">
          <MiniProgressRing pct={insights.attendance.pct} color="#059669" />
          <p className="text-[10px] font-semibold text-emerald-700 mt-1">Attendance</p>
        </div>
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 rounded-2xl p-3 text-center">
          <MiniProgressRing pct={insights.milestone_summary.pct} color="#4338ca" />
          <p className="text-[10px] font-semibold text-indigo-700 mt-1">Milestones</p>
        </div>
        <div className="bg-gradient-to-br from-pink-50 to-pink-100 border border-pink-200 rounded-2xl p-3 text-center">
          <div className="w-11 h-11 mx-auto rounded-full bg-pink-200 flex items-center justify-center">
            <span className="text-sm font-bold text-pink-700">{insights.observations_by_category.reduce((s, o) => s + o.count, 0)}</span>
          </div>
          <p className="text-[10px] font-semibold text-pink-700 mt-1">Observations</p>
        </div>
      </div>

      {/* Info row */}
      <div className="flex items-center gap-3 bg-white rounded-2xl p-3 border border-neutral-100">
        <div className="flex flex-wrap gap-3 text-xs text-neutral-600">
          {ageText && <span className="bg-neutral-100 px-2 py-0.5 rounded-full">🎂 {ageText}</span>}
          <span className="bg-neutral-100 px-2 py-0.5 rounded-full">📚 {insights.student.class_name}</span>
          <span className="bg-neutral-100 px-2 py-0.5 rounded-full">📝 {insights.journal_entries_count} journal entries</span>
          <span className="bg-neutral-100 px-2 py-0.5 rounded-full">📅 {insights.attendance.total_days} school days</span>
        </div>
      </div>

      {/* Attendance sparkline */}
      {attSparkline.length > 3 && (
        <div className="bg-white rounded-2xl p-3 border border-neutral-100">
          <p className="text-[10px] font-semibold text-neutral-500 mb-2 uppercase tracking-wide">Last 30 Days Attendance</p>
          <div className="flex gap-0.5">
            {insights.attendance_trend.map((d, i) => (
              <div key={i} className={`flex-1 h-4 rounded-sm ${d.status === 'present' ? 'bg-emerald-400' : d.status === 'late' ? 'bg-amber-400' : 'bg-red-300'}`}
                title={`${d.date}: ${d.status}`} />
            ))}
          </div>
          <div className="flex gap-3 mt-2">
            <span className="flex items-center gap-1 text-[9px] text-neutral-500"><span className="w-2 h-2 rounded-sm bg-emerald-400" />Present</span>
            <span className="flex items-center gap-1 text-[9px] text-neutral-500"><span className="w-2 h-2 rounded-sm bg-amber-400" />Late</span>
            <span className="flex items-center gap-1 text-[9px] text-neutral-500"><span className="w-2 h-2 rounded-sm bg-red-300" />Absent</span>
          </div>
        </div>
      )}

      {/* Milestone progress by domain */}
      {insights.milestones_by_domain.length > 0 && (
        <div className="bg-white rounded-2xl p-3 border border-neutral-100">
          <p className="text-[10px] font-semibold text-neutral-500 mb-2 uppercase tracking-wide">Milestone Progress</p>
          <div className="flex flex-col gap-2">
            {insights.milestones_by_domain.map(m => {
              const pct = m.total > 0 ? Math.round((m.achieved / m.total) * 100) : 0;
              return (
                <div key={m.domain} className="flex items-center gap-2">
                  <span className="text-xs w-16 truncate text-neutral-600">{DOMAIN_ICONS[m.domain] || '📌'} {m.domain}</span>
                  <div className="flex-1 bg-neutral-100 rounded-full h-2.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: DOMAIN_COLORS[m.domain] || '#4338ca' }} />
                  </div>
                  <span className="text-[10px] font-bold text-neutral-600 w-10 text-right">{m.achieved}/{m.total}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Observation coverage donut */}
      {obsDonut.length > 0 && (
        <div className="bg-white rounded-2xl p-3 border border-neutral-100">
          <p className="text-[10px] font-semibold text-neutral-500 mb-2 uppercase tracking-wide">Observation Coverage</p>
          <div className="flex items-center gap-3">
            <DonutChart data={obsDonut} size={90} strokeWidth={14} />
            <div className="flex flex-col gap-1 flex-1">
              {obsDonut.slice(0, 5).map(d => (
                <div key={d.label} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-[9px] text-neutral-600 flex-1 truncate">{d.label}</span>
                  <span className="text-[9px] font-bold text-neutral-700">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Milestone Achievement Modal ───────────────────────────────────────────────
function MilestoneAchieveModal({ milestone, student, token, onClose, onSaved }: {
  milestone: Milestone; student: Student; token: string; onClose: () => void; onSaved: () => void;
}) {
  const [comment, setComment] = useState(milestone.achievement_comment || '');
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');

  async function askOakie() {
    if (!comment.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/ai/format-observation`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: comment, student_name: student.name, category: milestone.description.replace(/\[Student'?s? ?Name\]/gi, student.name.split(' ')[0]), class_name: '' }),
      });
      const data = await res.json();
      if (data.formatted) setComment(data.formatted);
    } catch { /* silent */ }
    finally { setAiLoading(false); }
  }

  async function save() {
    setSaving(true); setError('');
    try {
      await fetch(`${API_BASE}/api/v1/teacher/milestones/${student.id}/${milestone.id}/achieve`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ achievement_comment: comment.trim() || null }),
      });
      onSaved(); onClose();
    } catch (e: any) { setError(e.message || 'Failed'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full lg:w-[480px] bg-white rounded-t-3xl lg:rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 bg-emerald-50 border-b border-emerald-100">
          <div>
            <p className="text-sm font-bold text-neutral-800">Mark as Achieved</p>
            <p className="text-xs text-neutral-500">{milestone.description.replace(/\[Student'?s? ?Name\]/gi, student.name.split(' ')[0])}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/60 hover:bg-white flex items-center justify-center text-neutral-500"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-neutral-600">How did {student.name.split(' ')[0]} achieve this? <span className="text-neutral-400 font-normal">(optional)</span></p>
              <button onClick={askOakie} disabled={aiLoading || !comment.trim()}
                className="flex items-center gap-1 text-xs px-2.5 py-1 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 rounded-lg font-medium disabled:opacity-40">
                {aiLoading ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />} Ask Oakie
              </button>
            </div>
            <div className="flex gap-2 items-start">
              <textarea value={comment} onChange={e => setComment(e.target.value.slice(0, 400))}
                placeholder={`e.g. ${student.name.split(' ')[0]} demonstrated this during circle time by...`}
                rows={4} autoFocus className="flex-1 px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 resize-none" />
              <InlineMicButton token={token} onTranscript={t => setComment(prev => prev ? prev + ' ' + t : t)} />
            </div>
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-neutral-200 rounded-xl text-sm text-neutral-600 hover:bg-neutral-50">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            {saving ? 'Saving…' : 'Mark Achieved'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Custom Milestone Modal (simplified) ───────────────────────────────────
function MilestoneFormModal({ classLevel, existing, token, onClose, onSaved }: {
  classLevel: string; existing?: Milestone; token: string; onClose: () => void; onSaved: () => void;
}) {
  const SKILL_DOMAINS = [
    { key: 'Cognitive', label: 'Cognitive Skills', icon: '🧠' },
    { key: 'Language', label: 'Language & Communication', icon: '🗣️' },
    { key: 'Social', label: 'Social Interaction', icon: '🤝' },
    { key: 'Emotional', label: 'Emotional Development', icon: '💛' },
    { key: 'GrossMotor', label: 'Gross Motor Skills', icon: '🏃' },
    { key: 'FineMotor', label: 'Fine Motor Skills', icon: '✏️' },
    { key: 'Creativity', label: 'Creativity & Expression', icon: '🎨' },
    { key: 'Participation', label: 'Classroom Participation', icon: '🙋' },
    { key: 'Peer', label: 'Peer Interaction', icon: '👫' },
    { key: 'Behaviour', label: 'Behavioral Observations', icon: '⭐' },
    { key: 'Other', label: 'Other', icon: '📌' },
  ];
  const TERMS = ['Term 1', 'Term 2', 'Term 3', 'Annual'];

  const [description, setDescription] = useState(existing?.description || '');
  const [domain, setDomain] = useState(existing?.domain || 'Cognitive');
  const [term, setTerm] = useState(existing?.term || '');
  const [saving, setSaving] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [error, setError] = useState('');

  async function formatWithOakie() {
    if (!description.trim()) return;
    setFormatting(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/ai/format-observation`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: description, category: domain, student_name: '' }),
      });
      const data = await res.json();
      if (data.formatted) setDescription(data.formatted);
    } catch { /* silently fail */ }
    finally { setFormatting(false); }
  }

  async function save() {
    if (!description.trim()) { setError('Description is required'); return; }
    setSaving(true); setError('');
    try {
      if (existing) {
        await fetch(`${API_BASE}/api/v1/teacher/milestones/custom/${existing.id}`, {
          method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: description.trim(), term: term || null }),
        });
      } else {
        await fetch(`${API_BASE}/api/v1/teacher/milestones/custom`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ class_level: classLevel, domain, description: description.trim(), term: term || null }),
        });
      }
      onSaved(); onClose();
    } catch (e: any) { setError(e.message || 'Failed'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full lg:w-[520px] bg-white rounded-t-3xl lg:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 bg-indigo-50 border-b border-indigo-100 shrink-0">
          <div>
            <p className="text-sm font-bold text-neutral-800">{existing ? 'Edit Milestone' : 'Add Custom Milestone'}</p>
            <p className="text-xs text-neutral-500 mt-0.5">{classLevel}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/60 hover:bg-white flex items-center justify-center text-neutral-500"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {!existing && (
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-2 block">Skill Domain</label>
              <div className="flex flex-wrap gap-1.5">
                {SKILL_DOMAINS.map(d => (
                  <button key={d.key} onClick={() => setDomain(d.key)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                      domain === d.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-neutral-200 text-neutral-600 hover:border-indigo-300'
                    }`}><span>{d.icon}</span> {d.label}</button>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-neutral-600">Milestone Description</label>
              <button onClick={formatWithOakie} disabled={formatting || !description.trim()}
                className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-medium disabled:opacity-40">
                {formatting ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />} Ask Oakie
              </button>
            </div>
            <div className="flex gap-2 items-start">
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Can write their full name independently" rows={3} autoFocus
                className="flex-1 px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 resize-none" />
              <InlineMicButton token={token} onTranscript={t => setDescription(prev => prev ? prev + ' ' + t : t)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Term <span className="text-neutral-400 font-normal">(optional)</span></label>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setTerm('')} className={`px-3 py-1.5 rounded-xl text-xs font-medium border ${!term ? 'bg-neutral-800 text-white border-neutral-800' : 'bg-white border-neutral-200 text-neutral-600'}`}>All Terms</button>
              {TERMS.map(t => (
                <button key={t} onClick={() => setTerm(t)} className={`px-3 py-1.5 rounded-xl text-xs font-medium border ${term === t ? 'bg-neutral-800 text-white border-neutral-800' : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400'}`}>{t}</button>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
        </div>
        <div className="px-5 pb-5 pt-3 flex gap-3 border-t border-neutral-100 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-neutral-200 rounded-xl text-sm text-neutral-600 hover:bg-neutral-50">Cancel</button>
          <button onClick={save} disabled={saving || !description.trim()}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            {saving ? 'Saving…' : existing ? 'Save Changes' : 'Add Milestone'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TeacherStudentsPage() {
  const router = useRouter();
  const token = getToken() || '';
  const [sections, setSections] = useState<Section[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [activeSection, setActiveSection] = useState('');
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [studentTab, setStudentTab] = useState<'insights' | 'observations' | 'milestones'>('observations');

  // Class insights
  const [classInsights, setClassInsights] = useState<ClassInsights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Student insights
  const [studentInsights, setStudentInsights] = useState<StudentInsights | null>(null);

  // Observations
  const [observations, setObservations] = useState<Observation[]>([]);
  const [editingObsId, setEditingObsId] = useState<string | null>(null);
  const [editObsText, setEditObsText] = useState('');
  const [editObsSaving, setEditObsSaving] = useState(false);
  const [deletingObsId, setDeletingObsId] = useState<string | null>(null);

  // Milestones
  const [milestoneData, setMilestoneData] = useState<MilestoneData | null>(null);
  const [achieveModal, setAchieveModal] = useState<Milestone | null>(null);
  const [formModal, setFormModal] = useState<{ existing?: Milestone } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [unachieving, setUnachieving] = useState<string | null>(null);
  const [milestoneTermFilter, setMilestoneTermFilter] = useState<string>('all');

  useEffect(() => { if (!token) { router.push('/login'); return; } loadSections(); }, []);

  async function loadSections() {
    try {
      const data = await apiGet<Section[]>('/api/v1/teacher/sections', token);
      setSections(data);
      if (data.length > 0) {
        setActiveSection(data[0].section_id);
        loadStudents(data[0].section_id);
        loadClassInsights();
      }
    } catch {}
  }

  async function loadStudents(sectionId: string) {
    try { setStudents(await apiGet<Student[]>(`/api/v1/teacher/sections/${sectionId}/students`, token)); } catch {}
  }

  async function loadClassInsights() {
    setLoadingInsights(true);
    try { setClassInsights(await apiGet<ClassInsights>('/api/v1/teacher/insights/class-summary', token)); }
    catch { setClassInsights(null); }
    finally { setLoadingInsights(false); }
  }

  async function openStudent(student: Student) {
    setActiveStudent(student);
    setStudentTab('observations');
    setAchieveModal(null);
    loadObservations(student.id);
    loadMilestones(student.id);
    loadStudentInsights(student.id);
  }

  async function loadStudentInsights(studentId: string) {
    try { setStudentInsights(await apiGet<StudentInsights>(`/api/v1/teacher/insights/student/${studentId}`, token)); }
    catch { 
      // If insights fail, set a minimal fallback so the page doesn't stay stuck
      setStudentInsights({
        student: { id: studentId, name: '', date_of_birth: '', photo_url: '', class_name: '', section_label: '' },
        attendance: { present: 0, absent: 0, late: 0, total_days: 0, pct: 0 },
        attendance_trend: [],
        milestones_by_domain: [],
        milestone_summary: { total: 0, achieved: 0, pct: 0 },
        observations_by_category: [],
        journal_entries_count: 0,
      });
    }
  }

  async function loadObservations(studentId: string) {
    try { setObservations(await apiGet<Observation[]>(`/api/v1/teacher/observations/${studentId}`, token)); } catch {}
  }

  async function loadMilestones(studentId: string) {
    try { setMilestoneData(await apiGet<MilestoneData>(`/api/v1/teacher/milestones/${studentId}`, token)); } catch {}
  }

  // ── Observation edit/delete ──
  function startEditObs(obs: Observation) {
    setEditingObsId(obs.id);
    setEditObsText(obs.obs_text || '');
  }

  async function saveEditObs(obs: Observation) {
    if (!editObsText.trim()) return;
    setEditObsSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/v1/teacher/observations/${obs.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ obs_text: editObsText.trim() }),
      }).then(r => r.json());
      if (r.error) throw new Error(r.error);
      setObservations(prev => prev.map(o => o.id === obs.id ? { ...o, obs_text: editObsText.trim() } : o));
      setEditingObsId(null);
    } catch (e: any) { alert(e.message || 'Failed to update'); }
    finally { setEditObsSaving(false); }
  }

  async function deleteObs(obsId: string) {
    if (!confirm('Delete this observation? This cannot be undone.')) return;
    setDeletingObsId(obsId);
    try {
      const r = await fetch(`${API_BASE}/api/v1/teacher/observations/${obsId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json());
      if (r.error) throw new Error(r.error);
      setObservations(prev => prev.filter(o => o.id !== obsId));
    } catch (e: any) { alert(e.message || 'Failed to delete'); }
    finally { setDeletingObsId(null); }
  }

  async function unachieveMilestone(milestoneId: string) {
    if (!activeStudent) return;
    setUnachieving(milestoneId);
    try {
      await fetch(`${API_BASE}/api/v1/teacher/milestones/${activeStudent.id}/${milestoneId}/achieve`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      await loadMilestones(activeStudent.id);
    } catch {}
    finally { setUnachieving(null); }
  }

  async function deleteCustomMilestone(milestoneId: string) {
    if (!confirm('Delete this custom milestone?')) return;
    setDeletingId(milestoneId);
    try {
      await fetch(`${API_BASE}/api/v1/teacher/milestones/custom/${milestoneId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      if (activeStudent) await loadMilestones(activeStudent.id);
    } catch {}
    finally { setDeletingId(null); }
  }

  const obsByCategory = observations.reduce((acc: Record<string, number>, obs) => {
    obs.categories.forEach(c => { acc[c] = (acc[c] || 0) + 1; });
    return acc;
  }, {});
  const coveredCategories = Object.keys(obsByCategory).length;

  const TERMS_FILTER = ['all', 'Term 1', 'Term 2', 'Term 3', 'Annual', 'untagged'];
  const groupedMilestones = milestoneData?.milestones
    .filter(m => milestoneTermFilter === 'all' ? true : milestoneTermFilter === 'untagged' ? !m.term : m.term === milestoneTermFilter)
    .reduce((acc: Record<string, Milestone[]>, m) => {
      if (!acc[m.domain]) acc[m.domain] = [];
      acc[m.domain].push(m);
      return acc;
    }, {}) ?? {};

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Modals */}
      {achieveModal && activeStudent && (
        <MilestoneAchieveModal milestone={achieveModal} student={activeStudent} token={token}
          onClose={() => setAchieveModal(null)} onSaved={() => { loadMilestones(activeStudent.id); }} />
      )}
      {formModal !== null && milestoneData && (
        <MilestoneFormModal classLevel={milestoneData.class_level} existing={formModal.existing} token={token}
          onClose={() => setFormModal(null)} onSaved={() => { if (activeStudent) loadMilestones(activeStudent.id); }} />
      )}

      <header className="text-white px-4 py-3 flex items-center justify-between shrink-0"
        style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, #0f2e23 100%)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => activeStudent ? setActiveStudent(null) : router.back()} className="text-white/60 hover:text-white text-lg">←</button>
          <OakitLogo size="xs" variant="light" />
          <span className="text-sm text-white/80 font-medium">{activeStudent ? activeStudent.name : 'Students & Insights'}</span>
        </div>
        <button onClick={() => signOut().then(() => router.push('/login'))} className="text-white/50 text-xs">Sign out</button>
      </header>

      {/* Student list + class insights */}
      {!activeStudent ? (
        <div className="p-4 max-w-2xl mx-auto w-full flex flex-col gap-4">
          {sections.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {sections.map(s => (
                <button key={s.section_id} onClick={() => { setActiveSection(s.section_id); loadStudents(s.section_id); }}
                  className={`px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${activeSection === s.section_id ? 'bg-primary-600 text-white' : 'bg-white border border-neutral-200 text-neutral-600'}`}>
                  {s.class_name} {s.section_label}
                </button>
              ))}
            </div>
          )}

          {/* Class insights dashboard */}
          {classInsights && <ClassInsightsDashboard insights={classInsights} />}
          {loadingInsights && !classInsights && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          )}

          {/* Student list */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-primary-600" />
                All Students
              </p>
              <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-semibold">{students.length} total</span>
            </div>
            <div className="flex flex-col gap-2">
              {students.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-3xl mb-2">🎒</p>
                  <p className="text-sm text-neutral-500">No students found</p>
                </div>
              )}
              {students.map((s, i) => {
                const ranking = classInsights?.student_milestone_ranking.find(r => r.id === s.id);
                return (
                  <button key={s.id} onClick={() => openStudent(s)}
                    className="bg-white border border-neutral-200 rounded-2xl p-4 flex items-center gap-3 text-left hover:bg-neutral-50 hover:border-primary-200 transition-all shadow-sm group">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center font-bold text-primary-700 shrink-0 overflow-hidden text-sm">
                      {s.photo_url ? <img src={`${API_BASE}${s.photo_url}`} alt={s.name} className="w-full h-full object-contain" /> : s.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-800 group-hover:text-primary-700 transition-colors">{s.name}</p>
                      <p className="text-xs text-neutral-500">{s.class_name} · {s.section_label}</p>
                    </div>
                    {ranking && ranking.achieved_count > 0 && (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium shrink-0">
                        {ranking.achieved_count} ✓
                      </span>
                    )}
                    <span className="ml-1 text-neutral-300 text-lg group-hover:text-primary-400 transition-colors">›</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
          {/* Tab bar */}
          <div className="flex bg-white border-b border-neutral-200 px-2">
            {(['insights', 'observations', 'milestones'] as const).map(t => (
              <button key={t} onClick={() => setStudentTab(t)}
                className={`flex-1 py-3 text-xs font-medium border-b-2 transition-all capitalize ${studentTab === t ? 'border-primary-600 text-primary-700' : 'border-transparent text-neutral-400'}`}>
                {t === 'insights' ? '📊 Insights' : t === 'observations' ? '📝 Observations' : '🏆 Milestones'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-8">

            {/* ── INSIGHTS TAB ── */}
            {studentTab === 'insights' && (
              studentInsights ? <StudentInsightsPanel insights={studentInsights} /> : (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                  <p className="text-xs text-neutral-400">Loading insights…</p>
                </div>
              )
            )}

            {/* ── OBSERVATIONS TAB ── */}
            {studentTab === 'observations' && (
              <>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-100">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-neutral-800">{activeStudent.name}</p>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      coveredCategories === 0 ? 'bg-red-100 text-red-600' :
                      coveredCategories < CATEGORY_CONFIG.length / 2 ? 'bg-amber-100 text-amber-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>{coveredCategories}/{CATEGORY_CONFIG.length} categories</span>
                  </div>
                  <p className="text-xs text-neutral-400">Observation summary — add observations from the Child Journey page</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {CATEGORY_CONFIG.map(cat => {
                    const count = obsByCategory[cat.id] || 0;
                    return (
                      <div key={cat.id} className={`flex items-center gap-2.5 px-3 py-3 rounded-2xl border-2 ${count > 0 ? `${cat.bg} ${cat.border}` : 'bg-white border-neutral-100'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-base ${count > 0 ? cat.bg : 'bg-neutral-100'}`}>{cat.icon}</div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-semibold leading-tight ${count > 0 ? cat.color : 'text-neutral-500'}`}>{cat.label}</p>
                          <p className={`text-[10px] mt-0.5 ${count > 0 ? `${cat.color} opacity-70` : 'text-neutral-400'}`}>
                            {count > 0 ? `${count} note${count > 1 ? 's' : ''}` : 'No notes yet'}
                          </p>
                        </div>
                        {count > 0 && <CheckCircle2 size={15} className={`${cat.color} shrink-0`} />}
                      </div>
                    );
                  })}
                </div>

                {observations.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">All Observations ({observations.length})</p>
                    {observations.map(obs => {
                      const catConfig = CATEGORY_CONFIG.find(c => obs.categories.includes(c.id));
                      const isEditing = editingObsId === obs.id;
                      return (
                        <div key={obs.id} className={`bg-white rounded-2xl p-4 shadow-sm border ${catConfig?.border || 'border-neutral-100'}`}>
                          <div className="flex items-start gap-2 mb-2">
                            {catConfig && <span className="text-base shrink-0">{catConfig.icon}</span>}
                            <div className="flex-1 min-w-0">
                              {obs.categories.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-1.5">
                                  {obs.categories.map(c => {
                                    const cc = CATEGORY_CONFIG.find(x => x.id === c);
                                    return <span key={c} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cc?.bg || 'bg-neutral-100'} ${cc?.color || 'text-neutral-600'}`}>{c}</span>;
                                  })}
                                </div>
                              )}
                              {isEditing ? (
                                <div className="flex flex-col gap-2">
                                  <textarea value={editObsText} onChange={e => setEditObsText(e.target.value)} rows={3}
                                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 resize-none" autoFocus />
                                  <div className="flex gap-2">
                                    <button onClick={() => setEditingObsId(null)} className="px-3 py-1.5 text-xs border border-neutral-200 rounded-lg text-neutral-600 hover:bg-neutral-50">Cancel</button>
                                    <button onClick={() => saveEditObs(obs)} disabled={editObsSaving || !editObsText.trim()}
                                      className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg font-medium disabled:opacity-40 flex items-center gap-1">
                                      {editObsSaving ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                obs.obs_text && <p className="text-sm text-neutral-700 leading-relaxed">{obs.obs_text}</p>
                              )}
                            </div>
                            {!isEditing && (
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => startEditObs(obs)}
                                  className="w-7 h-7 rounded-lg bg-neutral-100 hover:bg-primary-50 hover:text-primary-600 flex items-center justify-center text-neutral-400 transition-colors"
                                  title="Edit observation">
                                  <Pencil size={12} />
                                </button>
                                <button onClick={() => deleteObs(obs.id)} disabled={deletingObsId === obs.id}
                                  className="w-7 h-7 rounded-lg bg-neutral-100 hover:bg-red-50 hover:text-red-600 flex items-center justify-center text-neutral-400 transition-colors disabled:opacity-40"
                                  title="Delete observation">
                                  {deletingObsId === obs.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                </button>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-neutral-400">{obs.obs_date} · {obs.teacher_name} {obs.share_with_parent ? '· 👁 Shared' : ''}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
                {observations.length === 0 && (
                  <div className="text-center py-6 bg-white rounded-2xl border border-neutral-100">
                    <p className="text-2xl mb-2">📝</p>
                    <p className="text-sm text-neutral-500 font-medium">No observations yet</p>
                    <p className="text-xs text-neutral-400 mt-1">Add observations from the Child Journey page</p>
                  </div>
                )}
              </>
            )}

            {/* ── MILESTONES TAB ── */}
            {studentTab === 'milestones' && milestoneData && (
              <>
                {/* Progress header with donut */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-100">
                  <div className="flex items-center gap-4">
                    <MiniProgressRing pct={milestoneData.completion_pct} size={56} color="#4338ca" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-neutral-700">{milestoneData.class_level} Milestones</p>
                      <p className="text-xs text-neutral-400 mt-0.5">{milestoneData.achieved} of {milestoneData.total} achieved</p>
                      <div className="w-full bg-neutral-100 rounded-full h-2 mt-2">
                        <div className="h-2 rounded-full bg-indigo-500 transition-all" style={{ width: `${milestoneData.completion_pct}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Add custom milestone */}
                <button onClick={() => setFormModal({})}
                  className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-indigo-200 rounded-2xl text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors">
                  <Plus size={16} /> Add Custom Milestone
                </button>

                {/* Term filter */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                  {TERMS_FILTER.map(f => {
                    const label = f === 'all' ? 'All' : f === 'untagged' ? 'No term' : f;
                    const count = f === 'all' ? milestoneData.total
                      : f === 'untagged' ? milestoneData.milestones.filter(m => !m.term).length
                      : milestoneData.milestones.filter(m => m.term === f).length;
                    if (count === 0 && f !== 'all') return null;
                    return (
                      <button key={f} onClick={() => setMilestoneTermFilter(f)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors shrink-0 ${
                          milestoneTermFilter === f ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-neutral-200 text-neutral-600 hover:border-indigo-300'
                        }`}>{label} {count > 0 && <span className="opacity-70">({count})</span>}</button>
                    );
                  })}
                </div>

                {/* Milestones grouped by domain */}
                {Object.entries(groupedMilestones).map(([domain, items]) => (
                  <div key={domain} className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
                    <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-100 flex items-center gap-2">
                      <span className="text-base">{DOMAIN_ICONS[domain] ?? '📌'}</span>
                      <p className="text-sm font-semibold text-neutral-700">{domain}</p>
                      <span className="text-[10px] bg-neutral-200 text-neutral-600 px-1.5 py-0.5 rounded-full ml-auto">
                        {items.filter(m => m.achieved_at).length}/{items.length}
                      </span>
                    </div>
                    {items.map(m => {
                      const isAchieved = !!m.achieved_at;
                      const isUnachieving = unachieving === m.id;
                      const isDeleting = deletingId === m.id;
                      return (
                        <div key={m.id} className={`flex items-start gap-3 px-4 py-3 border-b border-neutral-50 last:border-0 transition-colors ${isAchieved ? 'bg-emerald-50/40' : ''}`}>
                          <button
                            onClick={() => isAchieved ? unachieveMilestone(m.id) : setAchieveModal(m)}
                            disabled={isUnachieving}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${isAchieved ? 'bg-emerald-500 border-emerald-500' : 'border-neutral-300 hover:border-emerald-400'}`}>
                            {isUnachieving ? <Loader2 size={12} className="animate-spin text-neutral-400" /> :
                              isAchieved ? <span className="text-white text-xs">✓</span> : null}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${isAchieved ? 'text-emerald-700' : 'text-neutral-700'}`}>
                              {m.description.replace(/\[Student'?s? ?Name\]/gi, activeStudent.name.split(' ')[0])}
                            </p>
                            {m.term && <span className="text-[10px] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-full mt-0.5 inline-block">{m.term}</span>}
                            {isAchieved && (
                              <div className="mt-1">
                                <p className="text-xs text-emerald-600">✓ Achieved {m.achieved_at} by {m.achieved_by || 'teacher'}</p>
                                {m.achievement_comment && <p className="text-xs text-neutral-500 mt-0.5 italic">"{m.achievement_comment}"</p>}
                              </div>
                            )}
                            {m.parent_note && (
                              <div className="mt-1.5 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5">
                                <p className="text-[10px] font-semibold text-blue-500 mb-0.5">Parent note</p>
                                <p className="text-xs text-blue-700">{m.parent_note}</p>
                              </div>
                            )}
                          </div>
                          {m.is_custom && (
                            <div className="flex items-center gap-1 shrink-0">
                              {!isAchieved && (
                                <button onClick={() => setFormModal({ existing: m })}
                                  className="w-7 h-7 rounded-lg bg-neutral-100 hover:bg-indigo-100 flex items-center justify-center text-neutral-400 hover:text-indigo-600 transition-colors">
                                  <Pencil size={12} />
                                </button>
                              )}
                              <button onClick={() => deleteCustomMilestone(m.id)} disabled={isDeleting}
                                className="w-7 h-7 rounded-lg bg-neutral-100 hover:bg-red-100 flex items-center justify-center text-neutral-400 hover:text-red-500 transition-colors">
                                {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
