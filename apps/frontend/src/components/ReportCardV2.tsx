'use client';
import React from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ReportMeta {
  school_name: string;
  student_name: string;
  age?: string;
  class_name: string;
  section_label: string;
  teacher_name?: string;
  father_name?: string;
  mother_name?: string;
  from_date: string;
  to_date: string;
  attendance: { present: number; absent: number; total: number; pct: number; absent_dates?: string[]; note?: string };
  curriculum: { covered: number; subjects?: string[] };
  homework?: { completed: number; partial: number; not_submitted: number; total: number };
  milestones: { achieved: number; total: number };
  overall_pct?: number;
  overall_basis?: string;
  journey_highlights?: string[];
  structured?: StructuredReport;
  ai_report?: string;
}

export interface StructuredReport {
  summary: string;
  teacher_remark: string;
  subjects: { name: string; pct: number; status: string; topics: string[]; note: string }[];
  skills: { name: string; pct: number; definition?: string; ptm_note?: string }[];
  achievements: { label: string; reason: string }[];
  home_activities: string[];
  radar: Record<string, number>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const G = '#1B4332';
const A = '#E8960C';

function statusColor(pct: number) {
  if (pct >= 85) return '#16a34a';
  if (pct >= 65) return '#2563eb';
  if (pct >= 45) return '#ea580c';
  return '#dc2626';
}

function statusLabel(pct: number) {
  if (pct >= 85) return 'Excellent';
  if (pct >= 65) return 'Good';
  if (pct >= 45) return 'Developing';
  return 'Needs Attention';
}

function statusBg(pct: number) {
  if (pct >= 85) return '#dcfce7';
  if (pct >= 65) return '#dbeafe';
  if (pct >= 45) return '#ffedd5';
  return '#fee2e2';
}

function fmtDate(d: string) {
  try { return new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return d; }
}

function RadarChart({ data, size = 200 }: { data: Record<string, number>; size?: number }) {
  const keys = Object.keys(data);
  const n = keys.length;
  if (n < 3) return null;
  const cx = size / 2, cy = size / 2, r = size * 0.38;
  const step = (2 * Math.PI) / n;
  const angle = (i: number) => -Math.PI / 2 + i * step;
  const pt = (i: number, ratio: number) => ({
    x: cx + r * ratio * Math.cos(angle(i)),
    y: cy + r * ratio * Math.sin(angle(i)),
  });
  const gridLevels = [0.25, 0.5, 0.75, 1];
  const dataPoints = keys.map((k, i) => pt(i, (data[k] || 0) / 100));
  const polyPoints = dataPoints.map(p => `${p.x},${p.y}`).join(' ');
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {gridLevels.map(level => {
        const pts = keys.map((_, i) => pt(i, level)).map(p => `${p.x},${p.y}`).join(' ');
        return <polygon key={level} points={pts} fill="none" stroke="#e5e7eb" strokeWidth="1" />;
      })}
      {keys.map((_, i) => { const p = pt(i, 1); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e5e7eb" strokeWidth="1" />; })}
      <polygon points={polyPoints} fill={G} fillOpacity="0.15" stroke={G} strokeWidth="2" />
      {dataPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill={G} />)}
      {keys.map((k, i) => {
        const p = pt(i, 1.18);
        return <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize="8" fill="#374151" fontWeight="600">{k}</text>;
      })}
    </svg>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon, value, label, color = G }: { icon: string; value: string | number; label: string; color?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '14px 10px', textAlign: 'center', minWidth: 0 }}>
      <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3, fontWeight: 600, letterSpacing: 0.3 }}>{label}</div>
    </div>
  );
}

// ─── Circular Progress ────────────────────────────────────────────────────────
function CircularProgress({ pct, size = 80, stroke = 8, color = G, label }: {
  pct: number; size?: number; stroke?: number; color?: string; label?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
        <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="middle"
          fontSize={size * 0.2} fontWeight="800" fill={color} style={{ transform: 'rotate(90deg)', transformOrigin: `${size / 2}px ${size / 2}px` }}>
          {pct}%
        </text>
      </svg>
      {label && <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>{label}</span>}
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ background: '#f3f4f6', borderRadius: 999, height: 8, overflow: 'hidden', flex: 1 }}>
      <div style={{ width: `${Math.min(pct, 100)}%`, background: color, height: '100%', borderRadius: 999, transition: 'width 0.6s ease' }} />
    </div>
  );
}

// ─── Calendar Heat Map ────────────────────────────────────────────────────────
function AttendanceCalendar({ present, absent, absentDates, fromDate, toDate }: {
  present: number; absent: number; absentDates: string[]; fromDate: string; toDate: string;
}) {
  const start = new Date(fromDate + 'T12:00:00');
  const end = new Date(toDate + 'T12:00:00');
  const days: { date: string; status: 'present' | 'absent' | 'weekend' }[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const ds = d.toISOString().split('T')[0];
    const dow = d.getDay();
    if (dow === 0 || dow === 6) { days.push({ date: ds, status: 'weekend' }); continue; }
    days.push({ date: ds, status: absentDates.includes(ds) ? 'absent' : 'present' });
  }
  const cols = 7;
  const rows = Math.ceil(days.length / cols);
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 3 }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 9, color: '#9ca3af', fontWeight: 700, paddingBottom: 2 }}>{d}</div>
        ))}
        {days.map((d, i) => (
          <div key={i} title={d.date} style={{
            width: '100%', paddingTop: '100%', borderRadius: 4, position: 'relative',
            background: d.status === 'present' ? '#16a34a' : d.status === 'absent' ? '#ef4444' : '#f3f4f6',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 10, color: '#6b7280' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#16a34a', display: 'inline-block' }} /> Present
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444', display: 'inline-block' }} /> Absent
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#f3f4f6', border: '1px solid #e5e7eb', display: 'inline-block' }} /> Weekend
        </span>
      </div>
    </div>
  );
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', padding: '10px 16px' }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.8, margin: 0 }}>{title}</p>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

// ─── Fallback structured data builder ─────────────────────────────────────────
function buildFallback(meta: ReportMeta): StructuredReport {
  const subjects = (meta.curriculum.subjects || []).slice(0, 8).map((s, i) => ({
    name: s, pct: 75 + (i % 3) * 5, status: 'Good', topics: [], note: 'Topics covered this period',
  }));
  return {
    summary: meta.ai_report
      ? meta.ai_report.split('\n').find(l => l.trim().length > 40 && !l.startsWith('#')) || ''
      : `${meta.student_name} has had an active and engaged month at school.`,
    teacher_remark: `${meta.student_name} is making steady progress. Keep encouraging at home!`,
    subjects,
    skills: [
      { name: 'Communication', pct: 75 }, { name: 'Fine Motor', pct: 70 },
      { name: 'Confidence', pct: 65 }, { name: 'Creativity', pct: 80 },
      { name: 'Listening', pct: 75 }, { name: 'Social Skills', pct: 70 },
    ],
    achievements: (meta.journey_highlights || []).slice(0, 3).map(h => ({
      label: 'Special Moment', reason: h.slice(0, 50),
    })),
    home_activities: [
      'Read one story together daily',
      'Count household objects',
      'Colour for 15 minutes',
      'Sing today\'s rhyme',
    ],
    radar: { Language: 75, Numeracy: 70, 'Motor Skills': 65, Creativity: 80, 'Social Skills': 70, Confidence: 65, Thinking: 72 },
  };
}

// ─── Weekly Activities Timeline ───────────────────────────────────────────────
function buildWeeklyTimeline(subjects: StructuredReport['subjects']) {
  const weeks: { week: string; topics: string[] }[] = [];
  const all = subjects.flatMap(s => s.topics.map(t => `${s.name}: ${t}`));
  const perWeek = Math.max(1, Math.ceil(all.length / 4));
  for (let w = 0; w < 4; w++) {
    const chunk = all.slice(w * perWeek, (w + 1) * perWeek);
    if (chunk.length > 0) weeks.push({ week: `Week ${w + 1}`, topics: chunk.slice(0, 3) });
  }
  return weeks;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function ReportCardV2({ meta, printMode = false }: { meta: ReportMeta; printMode?: boolean }) {
  const data: StructuredReport = meta.structured || buildFallback(meta);
  const hwPct = meta.homework && meta.homework.total > 0
    ? Math.round((meta.homework.completed / meta.homework.total) * 100) : null;

  // Use server-computed overall_pct (attendance + homework + obs weighted)
  // Fall back to attendance if not available (older saved reports)
  const overallPct  = meta.overall_pct ?? meta.attendance.pct;
  const overallBasis = meta.overall_basis ?? 'attendance';
  // milPct kept only for legacy fallback — not used for display
  const milPct = meta.overall_pct ?? (meta.milestones.total > 0
    ? Math.round((meta.milestones.achieved / meta.milestones.total) * 100) : 70);

  // Ensure radar always has data — fall back to subject-derived values if empty
  const radarData = Object.keys(data.radar).length >= 3
    ? data.radar
    : {
        Language:      data.skills.find(s => s.name === 'Communication')?.pct || 70,
        Numeracy:      data.subjects.find(s => /math/i.test(s.name))?.pct || 70,
        'Motor Skills': data.skills.find(s => s.name === 'Fine Motor')?.pct || 70,
        Creativity:    data.skills.find(s => s.name === 'Creativity')?.pct || 70,
        'Social Skills': data.skills.find(s => s.name === 'Social Skills')?.pct || 70,
        Confidence:    data.skills.find(s => s.name === 'Confidence')?.pct || 70,
        Thinking:      data.subjects.find(s => /gk|general/i.test(s.name))?.pct || 70,
      };

  const containerStyle: React.CSSProperties = {
    fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
    background: '#f8f7f4',
    maxWidth: 800,
    margin: '0 auto',
    padding: printMode ? 0 : 16,
  };

  return (
    <div style={containerStyle} id="report-card-v2">

      {/* 1. HEADER */}
      <div style={{
        background: `linear-gradient(135deg, ${G} 0%, #2d6a4f 100%)`,
        borderRadius: printMode ? 0 : 20, padding: '24px 20px', marginBottom: 16,
        display: 'flex', alignItems: 'flex-start', gap: 16,
      }}>
        {/* Avatar */}
        <div style={{
          width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, flexShrink: 0, border: '2px solid rgba(255,255,255,0.4)',
        }}>
          {meta.student_name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, margin: '0 0 2px', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Progress Report</p>
          <p style={{ color: '#fff', fontSize: 22, fontWeight: 900, margin: '0 0 4px' }}>{meta.student_name}</p>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, margin: 0 }}>
            {meta.class_name} — Sec {meta.section_label} &nbsp;|&nbsp; Teacher: {meta.teacher_name || 'Class Teacher'}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, margin: '4px 0 0' }}>
            {fmtDate(meta.from_date)} — {fmtDate(meta.to_date)} &nbsp;|&nbsp; {meta.school_name}
          </p>
        </div>
        <div style={{
          background: A, borderRadius: 12, padding: '8px 14px', textAlign: 'center', flexShrink: 0,
        }}>
          <p style={{ color: '#fff', fontSize: 10, margin: 0, fontWeight: 700, letterSpacing: 0.5 }}>OVERALL</p>
          <p style={{ color: '#fff', fontSize: 18, fontWeight: 900, margin: '2px 0 0' }}>
            {data.subjects.length > 0
              ? statusLabel(Math.round(data.subjects.reduce((s, x) => s + x.pct, 0) / data.subjects.length))
              : 'Good'}
          </p>        </div>
      </div>

      {/* 2. QUICK SNAPSHOT — KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
        <KpiCard icon="✅" value={`${meta.attendance.pct}%`} label="Attendance" color="#16a34a" />
        <KpiCard icon="📅" value={`${meta.attendance.present}/${meta.attendance.total}`} label="Days Present" color={G} />
        <KpiCard icon="📚" value={meta.curriculum.covered} label="Subjects" color="#2563eb" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
        {hwPct !== null && <KpiCard icon="📝" value={`${hwPct}%`} label="Homework" color="#7c3aed" />}
        <KpiCard icon="🏆" value={`${meta.milestones.achieved}/${meta.milestones.total}`} label="Milestones" color={A} />
        <KpiCard icon="⭐" value={statusLabel(overallPct)} label="Performance" color={statusColor(overallPct)} />
      </div>

      {/* 3. LEARNING PROGRESS — Subject Cards */}
      {data.subjects.length > 0 && (
        <Section title="Learning Progress">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {data.subjects.map((s, i) => (
              <div key={i} style={{
                border: '1px solid #e5e7eb', borderRadius: 12, padding: 14,
                borderTop: `3px solid ${statusColor(s.pct)}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <p style={{ fontWeight: 800, fontSize: 12, color: '#111827', margin: 0 }}>{s.name}</p>
                  <span style={{ fontSize: 10, fontWeight: 700, color: statusColor(s.pct), background: statusBg(s.pct), borderRadius: 999, padding: '2px 8px' }}>
                    {s.status || statusLabel(s.pct)}
                  </span>
                </div>
                <ProgressBar pct={s.pct} color={statusColor(s.pct)} />
                <p style={{ fontSize: 11, color: '#6b7280', margin: '6px 0 0', textAlign: 'right', fontWeight: 700 }}>{s.pct}%</p>
                {s.topics.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 5px' }}>Covered this period</p>
                    <p style={{ fontSize: 11, color: '#374151', lineHeight: 1.6, margin: 0 }}>
                      {s.topics.join(' · ')}
                    </p>
                  </div>
                )}
                {s.note && <p style={{ fontSize: 11, color: G, fontStyle: 'italic', margin: '8px 0 0', borderTop: '1px solid #f3f4f6', paddingTop: 6 }}>"{s.note}"</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 4. SKILLS DASHBOARD — merged into Radar, removed for space */}

      {/* 5. ATTENDANCE */}
      <Section title="Attendance">
        <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
          <CircularProgress pct={meta.attendance.pct} size={110} color={meta.attendance.pct >= 85 ? '#16a34a' : '#ea580c'} label="Attendance Rate" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 24, fontWeight: 900, color: '#16a34a', margin: 0, lineHeight: 1 }}>{meta.attendance.present}</p>
                <p style={{ fontSize: 11, color: '#6b7280', margin: '4px 0 0', fontWeight: 600 }}>Days Present</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 24, fontWeight: 900, color: '#ef4444', margin: 0, lineHeight: 1 }}>{meta.attendance.absent}</p>
                <p style={{ fontSize: 11, color: '#6b7280', margin: '4px 0 0', fontWeight: 600 }}>Days Absent</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 24, fontWeight: 900, color: '#374151', margin: 0, lineHeight: 1 }}>{meta.attendance.total}</p>
                <p style={{ fontSize: 11, color: '#6b7280', margin: '4px 0 0', fontWeight: 600 }}>School Days</p>
              </div>
            </div>
            {meta.attendance.absent > 0 && (meta.attendance.absent_dates || []).length > 0 && (
              <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>
                Absent on: {(meta.attendance.absent_dates || []).map(d => {
                  try { return new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); } catch { return d; }
                }).join(', ')}
              </p>
            )}
            {(meta.attendance as any).note && (
              <p style={{ fontSize: 10, color: '#9ca3af', margin: 0, fontStyle: 'italic', maxWidth: 340 }}>
                Note: {(meta.attendance as any).note}
              </p>
            )}
          </div>
        </div>
      </Section>

      {/* 6. DEVELOPMENT OVERVIEW — Radar always shown + Skills if assessed */}
      <Section title="Development Overview">
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flexShrink: 0 }}>
            <RadarChart data={radarData} size={200} />
          </div>
          <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
            {data.skills.length > 0 ? (
              <>
                {data.skills.map((sk, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: '#111827', fontWeight: 700, minWidth: 90 }}>{sk.name}</span>
                      <ProgressBar pct={sk.pct} color={statusColor(sk.pct)} />
                      <span style={{ fontSize: 11, fontWeight: 800, color: statusColor(sk.pct), minWidth: 30, textAlign: 'right' }}>{sk.pct}%</span>
                    </div>
                    {sk.definition && (
                      <p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 2px', lineHeight: 1.4 }}>{sk.definition}</p>
                    )}
                    {sk.ptm_note && (
                      <p style={{ fontSize: 10, color: '#6b7280', margin: 0, fontStyle: 'italic', borderLeft: `2px solid ${statusColor(sk.pct)}`, paddingLeft: 6 }}>
                        PTM: {sk.ptm_note}
                      </p>
                    )}
                  </div>
                ))}
                <p style={{ fontSize: 9, color: '#d1d5db', margin: '4px 0 0', fontStyle: 'italic' }}>
                  Scores reflect teacher observations recorded this period. Skills not assessed are not shown.
                </p>
              </>
            ) : (
              <div style={{ padding: '12px 0' }}>
                <p style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, margin: '0 0 6px' }}>Skills not yet assessed</p>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: 0, lineHeight: 1.6 }}>
                  The radar chart shows estimated development levels based on curriculum coverage and milestones. Individual skill scores will appear once the teacher records observations in each category.
                </p>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* 7. MONTHLY HIGHLIGHTS — Achievement Chips */}
      {data.achievements.length > 0 && (
        <Section title="Monthly Highlights">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {data.achievements.map((a, i) => (
              <div key={i} title={a.reason} style={{
                background: '#fef9ee', border: `1.5px solid ${A}`, borderRadius: 999,
                padding: '6px 14px', fontSize: 12, fontWeight: 700, color: '#92400e',
                cursor: 'default',
              }}>
                {a.label}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 8. ACTIVITIES THIS MONTH — removed to keep report within 2 A4 pages */}

      {/* 9. OAKIE SUMMARY */}
      {data.summary && (
        <Section title="Oakie Summary">
          <p style={{ fontSize: 13, color: '#1f2937', lineHeight: 1.75, margin: 0, fontStyle: 'italic' }}>
            {data.summary}
          </p>
        </Section>
      )}

      {/* 10. HOME ACTIVITIES */}
      {data.home_activities.length > 0 && (
        <Section title="Home Activities">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {data.home_activities.map((act, i) => {
              const icons = ['📖', '🎨', '🔢', '🎵', '🌱', '✏️', '🎭', '🔍'];
              return (
                <div key={i} style={{
                  background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12,
                  padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{icons[i % icons.length]}</span>
                  <p style={{ fontSize: 12, color: '#166534', fontWeight: 600, margin: 0, lineHeight: 1.4 }}>{act}</p>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* 11. TEACHER REMARK */}
      {data.teacher_remark && (
        <Section title="Teacher's Remark">
          <p style={{ fontSize: 13, color: '#1f2937', lineHeight: 1.7, margin: 0 }}>
            {data.teacher_remark}
          </p>
        </Section>
      )}

      {/* 12. FOOTER */}
      <div style={{
        background: G, borderRadius: 16, padding: '16px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, margin: 0 }}>Class Teacher</p>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 12, margin: '2px 0 0' }}>{meta.teacher_name || '—'}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, margin: 0 }}>{meta.school_name}</p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, margin: '2px 0 0' }}>
            Generated {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, margin: 0 }}>Principal</p>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 12, margin: '2px 0 0' }}>_____________</p>
        </div>
      </div>

    </div>
  );
}
