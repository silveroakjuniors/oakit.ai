'use client';

import { useState, useEffect } from 'react';
import { Button, Card, Badge } from '@/components/ui';
import { API_BASE, apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

interface PlanMonth { plan_year: number; plan_month: number; days_count: number; }
interface SupportingTeacher { id: string; name: string; }
interface SectionPlan {
  section_id: string; section_label: string;
  class_id: string; class_name: string;
  class_teacher_name: string | null;
  supporting_teachers: SupportingTeacher[];
  curriculum_filename: string | null; total_chunks: number | null; curriculum_status: string | null;
  plans: PlanMonth[];
}
interface Holiday { id: string; holiday_date: string; event_name: string; }
interface SpecialDayGroup {
  ids: string[]; from_date: string; to_date: string;
  day_type: string; label: string; count: number;
}
interface Chunk { id: string; chunk_index: number; topic_label: string; content: string; }
interface DayPlan { plan_date: string; status: string; chunks: { topic_label: string }[]; }

function parseDate(iso: string) {
  const [y, m, d] = (iso || '').split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}
function fmtShort(iso: string) {
  const parts = (iso || '').split('T')[0].split('-');
  if (parts.length < 3) return iso;
  const [y, m, d] = parts.map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[m - 1]} ${y}`;
}
function fmtDay(iso: string) {
  const [y, m, d] = (iso || '').split('T')[0].split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ── Plan Generator ────────────────────────────────────────────────────────────
function PlanGenerator({ classId, className, hasCurriculum, onClose }: {
  classId: string; className: string; hasCurriculum: boolean; onClose: () => void;
}) {
  const token = getToken() || '';
  const [calData, setCalData] = useState<{ academic_year: string; start_date: string; end_date: string } | null>(null);
  const [mode, setMode] = useState<'month' | 'year'>('month');
  const [selectedKey, setSelectedKey] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteStep, setDeleteStep] = useState<'idle' | 'loading' | 'confirm'>('idle');
  const [deleteStats, setDeleteStats] = useState<{ plans: number; completions: number; first_date: string | null; last_date: string | null } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState<{ label: string; key: string } | null>(null);
  const [genProgress, setGenProgress] = useState(0);
  const [msg, setMsg] = useState('');
  const [conflict, setConflict] = useState<{ message: string } | null>(null);

  useEffect(() => {
    apiGet<any[]>('/api/v1/admin/calendar', token).then(rows => {
      if (rows.length > 0) {
        const r = rows[0];
        const sd = r.start_date?.split('T')[0];
        const ed = r.end_date?.split('T')[0];
        setCalData({ academic_year: r.academic_year, start_date: sd, end_date: ed });
        if (sd) {
          const s = new Date(sd + 'T12:00:00');
          setSelectedKey(`${s.getFullYear()}-${s.getMonth() + 1}`);
        }
      }
    }).catch(() => {});
  }, []);

  // Animate progress bar while generating, poll for completion
  useEffect(() => {
    if (!generating) { setGenProgress(0); return; }
    setGenProgress(5);
    // Animate to 85% over ~20s
    const interval = setInterval(() => {
      setGenProgress(p => p < 85 ? p + (85 - p) * 0.08 : p);
    }, 800);
    // Poll plan-status every 4s to detect completion
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/admin/calendar/plan-status/${classId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const rows = await res.json();
        const hasPlans = rows.some((r: any) => parseInt(r.plans_count) > 0);
        if (hasPlans) {
          setGenProgress(100);
          setTimeout(() => { setGenerating(null); setGenProgress(0); }, 1200);
          clearInterval(poll);
          clearInterval(interval);
        }
      } catch { /* ignore */ }
    }, 4000);
    return () => { clearInterval(interval); clearInterval(poll); };
  }, [generating]);

  const validMonths: { month: number; year: number; label: string; key: string }[] = [];
  if (calData?.start_date && calData?.end_date) {
    const start = new Date(calData.start_date + 'T12:00:00');
    const end = new Date(calData.end_date + 'T12:00:00');
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      const key = `${cur.getFullYear()}-${cur.getMonth() + 1}`;
      validMonths.push({ month: cur.getMonth() + 1, year: cur.getFullYear(), label: `${MONTHS_FULL[cur.getMonth()]} ${cur.getFullYear()}`, key });
      cur.setMonth(cur.getMonth() + 1);
    }
  }

  const selected = validMonths.find(m => m.key === selectedKey);

  async function generate(force = false) {
    if (!calData) return;
    if (mode === 'month' && !selected) { setMsg('Please select a valid month.'); return; }
    setLoading(true); setMsg(''); setConflict(null);
    try {
      const body: any = { class_id: classId, academic_year: calData.academic_year };
      if (mode === 'month' && selected) { body.month = selected.month; body.plan_year = selected.year; }
      if (force) body.force = true;
      const res = await fetch(`${API_BASE}/api/v1/admin/calendar/generate-plans`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 409 && data.plans_exist) { setConflict({ message: data.message }); return; }
      if (!res.ok) throw new Error(data.error);
      const label = mode === 'month' && selected ? `${selected.label}` : 'full year';
      setMsg(`✓ Generating ${label} plans for ${data.sections} section(s). Runs in the background.`);
      setGenerating({ label, key: selectedKey });
    } catch (e: any) { setMsg(e.message); }
    finally { setLoading(false); }
  }

  async function refresh() {
    if (!calData) return;
    setRefreshing(true); setMsg('');
    try {
      const res = await apiPost<any>('/api/v1/admin/calendar/refresh-planner', { class_id: classId, academic_year: calData.academic_year }, token);
      setMsg(`✓ ${res.message}`);
    } catch (e: any) { setMsg(e.message); }
    finally { setRefreshing(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 sticky top-0 bg-white">
          <div>
            <h2 className="text-base font-semibold text-neutral-800">Daily Planner — {className}</h2>
            {calData && <p className="text-xs text-neutral-400 mt-0.5">{calData.academic_year} · {fmtShort(calData.start_date)} → {fmtShort(calData.end_date)}</p>}
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 text-xl">✕</button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          {!hasCurriculum ? (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl">📄</div>
              <div>
                <p className="text-sm font-semibold text-neutral-800">No curriculum uploaded for {className}</p>
                <p className="text-xs text-neutral-500 mt-1">Upload a curriculum PDF before generating day plans.</p>
              </div>
              <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-left w-full">
                <p className="text-xs font-semibold text-neutral-700 mb-2">Setup steps:</p>
                <ol className="text-xs text-neutral-500 flex flex-col gap-1.5 list-decimal list-inside">
                  <li>Go to <strong>Curriculum</strong> → upload PDF for {className}</li>
                  <li>Go to <strong>Calendar</strong> → set academic year, working days, holidays</li>
                  <li>Come back here → click <strong>Assign Daily Planner</strong></li>
                  <li>Choose Monthly or Full Year → Generate</li>
                </ol>
              </div>
              <Button variant="secondary" onClick={onClose} className="w-full">Close</Button>
            </div>
          ) : !calData ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
              ⚠ No academic year found. Go to <strong>Calendar</strong> and set up your academic year first.
            </div>
          ) : (
            <>
              <div className="bg-primary-50 border border-primary-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-primary-700 mb-2">How day plans work</p>
                <ul className="text-xs text-primary-600 flex flex-col gap-1">
                  <li>• <strong>Monthly</strong> — generates one month, picks up from where the last month left off</li>
                  <li>• <strong>Full Year</strong> — generates all plans for the entire academic year at once</li>
                  <li>• <strong>Refresh</strong> — use after adding holidays or special days to shift plans forward</li>
                </ul>
              </div>
              <div className="flex gap-1 bg-neutral-100 rounded-xl p-1">
                {(['month', 'year'] as const).map(m => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === m ? 'bg-white text-primary-600 shadow-sm' : 'text-neutral-500'}`}>
                    {m === 'month' ? 'Monthly' : 'Full Year'}
                  </button>
                ))}
              </div>
              {mode === 'month' && (
                <div>
                  <label className="text-xs font-medium text-neutral-600 block mb-1.5">Select Month (within {calData.academic_year})</label>
                  <select value={selectedKey} onChange={e => { setSelectedKey(e.target.value); if (generating?.key !== e.target.value) setGenerating(null); }}
                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:border-primary-400">
                    {validMonths.map(vm => <option key={vm.key} value={vm.key}>{vm.label}</option>)}
                  </select>
                  {validMonths.length === 0 && <p className="text-xs text-red-500 mt-1">No valid months. Check your academic year dates in Calendar.</p>}
                </div>
              )}
              {msg && <p className={`text-sm px-3 py-2 rounded-lg ${msg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg}</p>}
              {generating && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500">Generating {generating.label} plans…</span>
                    <span className="text-primary-600 font-medium">{Math.round(genProgress)}%</span>
                  </div>
                  <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 rounded-full bg-primary-500 transition-all duration-700"
                      style={{ width: `${genProgress}%` }}
                    />
                  </div>
                  {genProgress < 100 && (
                    <p className="text-xs text-neutral-400">Buttons will re-enable when done, or change the month to generate another.</p>
                  )}
                  {genProgress >= 100 && (
                    <p className="text-xs text-emerald-600 font-medium">✓ Plans generated successfully!</p>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Button onClick={() => generate(false)} loading={loading} disabled={loading || refreshing || !!generating || deleting || (mode === 'month' && !selected)} className="w-full">
                  {mode === 'month' ? 'Generate Month Plans' : 'Generate Full Year Plans'}
                </Button>
                <Button variant="secondary" onClick={refresh} loading={refreshing} disabled={loading || refreshing || !!generating || deleting} className="w-full">🔄 Refresh Planner</Button>
                <div className="border-t border-neutral-100 pt-2 mt-1">
                  {deleteStep === 'idle' && (
                    <button onClick={async () => {
                      setDeleteStep('loading');
                      try {
                        const res = await fetch(`${API_BASE}/api/v1/admin/calendar/plans/class/${classId}/stats`, {
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        const data = await res.json();
                        setDeleteStats(data);
                        setDeleteConfirmText('');
                        setDeleteStep('confirm');
                      } catch { setDeleteStep('idle'); }
                    }}
                      className="w-full text-xs text-red-500 hover:text-red-700 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                      🗑 Delete All Plans for {className}
                    </button>
                  )}
                  {deleteStep === 'loading' && (
                    <p className="text-xs text-neutral-400 text-center py-2">Loading stats...</p>
                  )}
                  {deleteStep === 'confirm' && deleteStats && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col gap-3">
                      <div>
                        <p className="text-sm font-semibold text-red-800 mb-1">⚠ Delete all plans for {className}?</p>
                        <p className="text-xs text-red-600">This action cannot be undone. You will lose:</p>
                      </div>
                      <div className="bg-white border border-red-200 rounded-lg px-3 py-2 flex flex-col gap-1 text-xs">
                        <div className="flex justify-between"><span className="text-neutral-600">Day plans</span><span className="font-semibold text-red-700">{deleteStats.plans}</span></div>
                        <div className="flex justify-between"><span className="text-neutral-600">Teacher completion records</span><span className="font-semibold text-red-700">{deleteStats.completions}</span></div>
                        {deleteStats.first_date && <div className="flex justify-between"><span className="text-neutral-600">Date range</span><span className="font-medium text-neutral-700">{fmtShort(deleteStats.first_date)} → {fmtShort(deleteStats.last_date || '')}</span></div>}
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                        <p className="font-medium mb-1">After deletion you will need to:</p>
                        <ul className="list-disc list-inside flex flex-col gap-0.5">
                          <li>Re-generate plans for {className}</li>
                          <li>Teachers will lose their completion history</li>
                        </ul>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-red-700 block mb-1">Type <strong>{className}</strong> to confirm</label>
                        <input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)}
                          placeholder={className}
                          className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setDeleteStep('idle'); setDeleteStats(null); setDeleteConfirmText(''); }}
                          disabled={deleting}
                          className="flex-1 py-2 text-xs border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-40">Cancel</button>
                        <button disabled={deleteConfirmText !== className || deleting}
                          onClick={async () => {
                            setDeleting(true); setDeleteProgress(10); setMsg('');
                            // Animate progress while waiting
                            const timer = setInterval(() => setDeleteProgress(p => p < 85 ? p + 12 : p), 200);
                            try {
                              const res = await fetch(`${API_BASE}/api/v1/admin/calendar/plans/class/${classId}`, {
                                method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
                              });
                              const data = await res.json();
                              clearInterval(timer);
                              if (!res.ok) throw new Error(data.error);
                              setDeleteProgress(100);
                              setTimeout(() => {
                                setMsg(`✓ ${data.message}`);
                                setDeleteStep('idle'); setDeleteStats(null); setDeleteConfirmText('');
                                setDeleteProgress(0);
                              }, 600);
                            } catch (e: any) { clearInterval(timer); setDeleteProgress(0); setMsg(e.message); }
                            finally { setDeleting(false); }
                          }}
                          className="flex-1 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium">
                          {deleting ? 'Deleting...' : 'Delete All Plans'}
                        </button>
                      </div>
                      {deleting && (
                        <div className="flex flex-col gap-1 mt-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-red-600">Deleting plans…</span>
                            <span className="text-red-600 font-medium">{Math.round(deleteProgress)}%</span>
                          </div>
                          <div className="w-full bg-red-100 rounded-full h-1.5 overflow-hidden">
                            <div className="h-1.5 rounded-full bg-red-500 transition-all duration-200"
                              style={{ width: `${deleteProgress}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {conflict && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-sm font-medium text-red-800 mb-1">Plans Already Exist</p>
                  <p className="text-xs text-red-600 mb-3">{conflict.message}</p>
                  <p className="text-xs text-red-500 mb-3">⚠ Regenerating will delete all completion records for this period.</p>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setConflict(null)} className="flex-1">Cancel</Button>
                    <Button variant="danger" size="sm" onClick={() => { setConflict(null); generate(true); }} className="flex-1">Regenerate</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Plan Viewer (week-wise with edit) ─────────────────────────────────────────
interface RichDayPlan {
  plan_date: string;
  status: string;
  chunk_ids: string[];
  chunks: { id: string; topic_label: string; original_label: string; content: string; chunk_index: number }[];
  special_day_label: string | null;
  special_day_type: string | null;
  special_day_note: string | null;
  admin_note: string | null;
  completion_id: string | null;
  completed_at: string | null;
  completed_by: string | null;
}

const SPECIAL_DAY_ICONS: Record<string, string> = {
  settling: '🌱', revision: '📝', exam: '📋', event: '🎉',
  sports_day: '🏃', annual_day: '🎭', field_trip: '🚌', default: '📌',
};

function PlanViewer({ sectionId, sectionLabel, className, month, year, onClose }: {
  sectionId: string; sectionLabel: string; className: string;
  month: number; year: number; onClose: () => void;
}) {
  const token = getToken() || '';
  const [plans, setPlans] = useState<RichDayPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMonth, setViewMonth] = useState(month);
  const [viewYear, setViewYear] = useState(year);
  const [weekIndex, setWeekIndex] = useState(0);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<'note' | 'chunks'>('note');
  const [editNote, setEditNote] = useState('');
  const [editChunks, setEditChunks] = useState<{ id: string; topic_label: string; original_label: string; content: string; chunk_index: number }[]>([]);
  const [showChunkWarning, setShowChunkWarning] = useState(false);
  const [showChunkConfirm, setShowChunkConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [exporting, setExporting] = useState(false);
  const [deletingMonth, setDeletingMonth] = useState(false);
  const [deleteMonthConfirm, setDeleteMonthConfirm] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => { loadPlans(); setWeekIndex(0); }, [viewMonth, viewYear]);

  async function loadPlans() {
    setLoading(true);
    try {
      const data = await apiGet<RichDayPlan[]>(
        `/api/v1/admin/calendar/plans/${sectionId}?month=${viewMonth}&year=${viewYear}`, token
      );
      // Filter strictly to the viewed month — guards against timezone-shifted dates from backend
      const filtered = data.filter(p => {
        const parts = p.plan_date.split('T')[0].split('-').map(Number);
        return parts[0] === viewYear && parts[1] === viewMonth;
      });
      setPlans(filtered);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  // Group into ISO weeks (Mon–Sun). Each plan gets a week key = Monday of that week.
  function isoWeekKey(dateStr: string): string {
    const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const dow = dt.getDay(); // 0=Sun..6=Sat
    // Days since Monday: Sun→6, Mon→0, Tue→1 ... Sat→5
    const daysSinceMon = (dow + 6) % 7;
    const mon = new Date(dt);
    mon.setDate(dt.getDate() - daysSinceMon);
    return mon.toISOString().split('T')[0];
  }

  const weekMap = new Map<string, RichDayPlan[]>();
  const weekOrder: string[] = [];
  for (const plan of plans) {
    const key = isoWeekKey(plan.plan_date);
    if (!weekMap.has(key)) { weekMap.set(key, []); weekOrder.push(key); }
    weekMap.get(key)!.push(plan);
  }
  const weeks = weekOrder.map(k => weekMap.get(k)!);

  const currentWeek = weeks[weekIndex] || [];

  function canEdit(plan: RichDayPlan): boolean {
    const dateStr = plan.plan_date.split('T')[0];
    if (plan.completion_id) return false; // teacher completed
    if (dateStr < today) return false;    // past date
    return true;
  }

  function startEdit(plan: RichDayPlan, mode: 'note' | 'chunks') {
    setEditingDate(plan.plan_date.split('T')[0]);
    setEditMode(mode);
    setEditNote(plan.admin_note || plan.special_day_note || '');
    setEditChunks(plan.chunks.map(c => ({ ...c, original_label: c.original_label ?? c.topic_label })));
    setSaveMsg('');
    setShowChunkWarning(false);
    setShowChunkConfirm(false);
  }

  async function saveNote(plan: RichDayPlan) {
    const dateStr = plan.plan_date.split('T')[0];
    setSaving(true); setSaveMsg('');
    try {
      const body: any = { admin_note: editNote };
      if (editMode === 'chunks') {
        const overrides: Record<string, string> = {};
        for (const edited of editChunks) {
          const origLabel = (edited.original_label ?? '').trim() || edited.topic_label.trim();
          if (edited.topic_label.trim() !== origLabel) {
            overrides[edited.id] = edited.topic_label.trim();
          }
        }
        // Always send overrides (even empty) to allow clearing previous overrides
        // But only if user actually changed something — check by comparing with current plan overrides
        body.chunk_label_overrides = overrides;
      }
      const res = await fetch(`${API_BASE}/api/v1/admin/calendar/plans/${sectionId}/${dateStr}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSaveMsg('✓ Saved');
      setEditingDate(null);
      setShowChunkConfirm(false);
      await loadPlans();
    } catch (e: any) { setSaveMsg(e.message); setShowChunkConfirm(false); }
    finally { setSaving(false); }
  }

  async function exportPdf() {
    setExporting(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/calendar/plans/${sectionId}/export?month=${viewMonth}&year=${viewYear}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `plan-${className}-${sectionLabel}-${viewYear}-${viewMonth}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } catch (e: any) { alert(e.message); }
    finally { setExporting(false); }
  }

  function navMonth(dir: number) {
    const d = new Date(viewYear, viewMonth - 1 + dir, 1);
    setViewMonth(d.getMonth() + 1);
    setViewYear(d.getFullYear());
  }

  async function deleteMonth() {
    setDeletingMonth(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/admin/calendar/plans/${sectionId}/month?month=${viewMonth}&year=${viewYear}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDeleteMonthConfirm(false);
      await loadPlans();
    } catch (e: any) { alert(e.message); }
    finally { setDeletingMonth(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col" style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-neutral-800">{className} – Section {sectionLabel}</h2>
            <p className="text-xs text-neutral-400 mt-0.5">Day Plans · {MONTHS_FULL[viewMonth - 1]} {viewYear}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={exportPdf} loading={exporting}>Export PDF</Button>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 text-xl ml-1">✕</button>
          </div>
        </div>

        {/* Month nav */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-neutral-100 shrink-0">
          <button onClick={() => navMonth(-1)} className="px-3 py-1.5 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50">← Prev</button>
          <span className="text-sm font-medium text-neutral-700 flex-1 text-center">{MONTHS_FULL[viewMonth - 1]} {viewYear}</span>
          <button onClick={() => navMonth(1)} className="px-3 py-1.5 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50">Next →</button>
        </div>

        {/* Week pagination */}
        {weeks.length > 1 && (
          <div className="flex items-center gap-2 px-6 py-2 border-b border-neutral-100 shrink-0 bg-neutral-50">
            <button onClick={() => setWeekIndex(w => Math.max(0, w - 1))} disabled={weekIndex === 0}
              className="px-2 py-1 text-xs border border-neutral-200 rounded-lg disabled:opacity-40 hover:bg-white">‹</button>
            <span className="text-xs text-neutral-600 flex-1 text-center font-medium">
              Week {weekIndex + 1} of {weeks.length}
              {currentWeek.length > 0 && ` · ${fmtShort(currentWeek[0].plan_date)} – ${fmtShort(currentWeek[currentWeek.length - 1].plan_date)}`}
            </span>
            <button onClick={() => setWeekIndex(w => Math.min(weeks.length - 1, w + 1))} disabled={weekIndex === weeks.length - 1}
              className="px-2 py-1 text-xs border border-neutral-200 rounded-lg disabled:opacity-40 hover:bg-white">›</button>
          </div>
        )}

        {/* Plan cards */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
          {loading ? <p className="text-sm text-neutral-400 text-center py-8">Loading...</p>
          : plans.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-neutral-500">No plans generated for this month.</p>
              <p className="text-xs text-neutral-400 mt-1">Use "Assign Daily Planner" to generate plans first.</p>
            </div>
          ) : currentWeek.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-8">No plans in this week.</p>
          ) : currentWeek.map(plan => {
            const dateStr = plan.plan_date.split('T')[0];
            const [y, m, d] = dateStr.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            const dayLabel = dateObj.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
            const isSpecial = !!plan.special_day_label;
            const isCompleted = !!plan.completion_id;
            const isPast = dateStr < today;
            const editable = canEdit(plan);
            const isEditing = editingDate === dateStr;
            const specialIcon = SPECIAL_DAY_ICONS[plan.special_day_type || ''] || SPECIAL_DAY_ICONS.default;

            return (
              <div key={plan.plan_date}
                className={`rounded-2xl border p-4 ${
                  isCompleted ? 'border-emerald-200 bg-emerald-50/40' :
                  isSpecial ? 'border-blue-200 bg-blue-50/40' :
                  isPast ? 'border-neutral-200 bg-neutral-50/60 opacity-75' :
                  'border-neutral-200 bg-white'
                }`}>

                {/* Day header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">{dayLabel}</p>
                    {isSpecial && (
                      <p className="text-xs text-blue-700 mt-0.5 font-medium">
                        {specialIcon} {plan.special_day_label}
                        {plan.special_day_type && <span className="ml-1 text-blue-500 capitalize">({plan.special_day_type})</span>}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {isCompleted && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                        ✓ Done
                      </span>
                    )}
                    {isPast && !isCompleted && (
                      <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full">Past</span>
                    )}
                    {editable && !isEditing && (
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(plan, 'note')}
                          className="text-xs text-primary-600 hover:text-primary-700 font-medium px-2 py-1 rounded-lg hover:bg-primary-50">
                          ✏️ Note
                        </button>
                        {plan.chunks.length > 0 && (
                          <button onClick={() => startEdit(plan, 'chunks')}
                            className="text-xs text-amber-600 hover:text-amber-700 font-medium px-2 py-1 rounded-lg hover:bg-amber-50">
                            📚 Edit Topics
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Planned topics */}
                {plan.chunks.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-neutral-500 mb-1.5">📚 Planned Topics</p>
                    <div className="flex flex-col gap-1">
                      {plan.chunks.map((c, ci) => (
                        <div key={c.id} className="flex items-start gap-2 text-xs">
                          <span className="text-neutral-400 shrink-0 mt-0.5">{ci + 1}.</span>
                          <span className="text-neutral-700">{c.topic_label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Special day note / instructions */}
                {isSpecial && (plan.special_day_note || plan.admin_note) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 mb-3">
                    <p className="text-xs font-medium text-blue-700 mb-0.5">📋 Instructions</p>
                    <p className="text-xs text-blue-600">{plan.admin_note || plan.special_day_note}</p>
                  </div>
                )}

                {/* Edit form */}
                {isEditing && (
                  <div className="mt-3 flex flex-col gap-3 border-t border-neutral-100 pt-3">
                    {editMode === 'note' ? (
                      <>
                        <div>
                          <label className="text-xs font-medium text-neutral-600 block mb-1">
                            {isSpecial ? 'Instructions for this special day' : 'Admin note for teachers'}
                          </label>
                          <textarea value={editNote} onChange={e => setEditNote(e.target.value)} rows={3}
                            placeholder={isSpecial
                              ? `e.g. "Settling day — focus on classroom routines, name games, and making children comfortable."`
                              : `e.g. "Focus on revision of last week's topics"`}
                            className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary-400 resize-none" />
                        </div>
                        {saveMsg && <p className={`text-xs ${saveMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>{saveMsg}</p>}
                        <div className="flex gap-2">
                          <Button size="xs" variant="secondary" onClick={() => setEditingDate(null)} className="flex-1">Cancel</Button>
                          <Button size="xs" onClick={() => saveNote(plan)} loading={saving} className="flex-1">Save Note</Button>
                        </div>
                      </>
                    ) : (
                      <>
                        {!showChunkWarning ? (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <p className="text-xs font-semibold text-amber-800 mb-1">⚠ Editing topics affects the teacher's plan</p>
                            <ul className="text-xs text-amber-700 flex flex-col gap-0.5 list-disc list-inside mb-3">
                              <li>Changes apply only to <strong>this section</strong> — other sections are not affected</li>
                              <li>The teacher will immediately see the updated topic labels for this day</li>
                              <li>The original curriculum chunks are not modified — only this day's display is overridden</li>
                              <li>No refresh or regeneration needed — changes take effect instantly</li>
                            </ul>
                            <div className="flex gap-2">
                              <Button size="xs" variant="secondary" onClick={() => setEditingDate(null)} className="flex-1">Cancel</Button>
                              <Button size="xs" onClick={() => { setShowChunkWarning(true); }} className="flex-1">I understand, continue</Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {!showChunkConfirm ? (
                              <div>
                                <p className="text-xs font-medium text-neutral-600 mb-2">
                                  Edit topics for this day
                                  <span className="text-neutral-400 font-normal ml-1">({editChunks.length} topic{editChunks.length !== 1 ? 's' : ''})</span>
                                </p>
                                <div className="flex flex-col gap-3">
                                  {editChunks.map((c, ci) => (
                                    <div key={c.id} className="border border-neutral-200 rounded-xl p-3">
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs text-neutral-400 shrink-0 font-medium">#{ci + 1}</span>
                                        <input
                                          value={c.topic_label}
                                          onChange={e => setEditChunks(prev => prev.map((x, i) => i === ci ? { ...x, topic_label: e.target.value } : x))}
                                          placeholder="Topic label"
                                          className="flex-1 border border-neutral-200 rounded-lg px-2 py-1 text-xs font-medium focus:outline-none focus:border-primary-400"
                                        />
                                      </div>
                                      <textarea
                                        value={c.content}
                                        onChange={e => setEditChunks(prev => prev.map((x, i) => i === ci ? { ...x, content: e.target.value } : x))}
                                        rows={4}
                                        placeholder="Curriculum content for this day..."
                                        className="w-full border border-neutral-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary-400 resize-y"
                                      />
                                    </div>
                                  ))}
                                </div>
                                {saveMsg && <p className={`text-xs mt-2 ${saveMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>{saveMsg}</p>}
                                <div className="flex gap-2 mt-3">
                                  <Button size="xs" variant="secondary" onClick={() => setEditingDate(null)} className="flex-1">Cancel</Button>
                                  <Button size="xs" onClick={() => setShowChunkConfirm(true)}
                                    disabled={editChunks.some(c => !c.topic_label.trim())} className="flex-1">
                                    Review &amp; Save
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                                <p className="text-xs font-semibold text-amber-800 mb-2">Confirm topic changes</p>
                                <div className="flex flex-col gap-3 mb-3 max-h-64 overflow-y-auto">
                                  {editChunks.map((c, ci) => {
                                    const origLabel = (c.original_label ?? c.topic_label) || '';
                                    const labelChanged = c.topic_label.trim() !== origLabel.trim();
                                    return (
                                      <div key={c.id} className="text-xs border border-amber-200 rounded-lg p-2 bg-white">
                                        <div className="flex items-start gap-1 mb-1">
                                          <span className="text-amber-400 shrink-0">{ci + 1}.</span>
                                          <div className="flex-1">
                                            {labelChanged && (
                                              <p className="text-neutral-400 line-through text-xs mb-0.5">{origLabel}</p>
                                            )}
                                            <p className="font-semibold text-amber-800">{c.topic_label}</p>
                                          </div>
                                          {labelChanged && <span className="text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-medium shrink-0">changed</span>}
                                        </div>
                                        {c.content && (
                                          <p className="text-neutral-600 mt-1 pl-3 whitespace-pre-wrap text-xs leading-relaxed">{c.content}</p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                                <p className="text-xs text-amber-600 mb-3">The teacher will see these updated topics immediately — no refresh needed. Only this section is affected.</p>
                                {saveMsg && <p className={`text-xs mb-2 ${saveMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>{saveMsg}</p>}
                                <div className="flex gap-2">
                                  <Button size="xs" variant="secondary" onClick={() => setShowChunkConfirm(false)} className="flex-1">Back</Button>
                                  <Button size="xs" onClick={() => saveNote(plan)} loading={saving} className="flex-1">Confirm Save</Button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Completion info */}
                {isCompleted && plan.completed_by && (
                  <div className="mt-2 pt-2 border-t border-emerald-200 flex items-center gap-2 text-xs text-emerald-600">
                    <span>✓ Completed by {plan.completed_by}</span>
                    {plan.completed_at && (
                      <span className="text-emerald-500">
                        · {new Date(plan.completed_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-100 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-xs text-neutral-400">
              {plans.length} plans · {plans.filter(p => p.completion_id).length} completed
            </p>
            {plans.length > 0 && !deleteMonthConfirm && (
              <button onClick={() => setDeleteMonthConfirm(true)}
                className="text-xs text-red-400 hover:text-red-600 hover:underline">
                🗑 Delete {MONTHS_FULL[viewMonth - 1]} plans
              </button>
            )}
            {deleteMonthConfirm && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 font-medium">Delete all {plans.length} plans for {MONTHS_FULL[viewMonth - 1]}?</span>
                <button onClick={() => setDeleteMonthConfirm(false)} className="text-xs text-neutral-400 hover:text-neutral-600">Cancel</button>
                <button onClick={deleteMonth} disabled={deletingMonth}
                  className="text-xs bg-red-600 text-white px-2 py-1 rounded-lg hover:bg-red-700 disabled:opacity-50">
                  {deletingMonth ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

// ── Chunk Editor ──────────────────────────────────────────────────────────────
function ChunkEditor({ classId, onClose }: { classId: string; onClose: () => void }) {
  const token = getToken() || '';
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [edits, setEdits] = useState<Record<string, { topic_label: string; content: string }>>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  useEffect(() => { loadPage(page); }, [page]);

  async function loadPage(p: number) {
    setLoading(true); setError('');
    try {
      const data = await apiGet<{ chunks: Chunk[]; total: number; total_pages: number }>(
        `/api/v1/admin/curriculum/by-class/${classId}/chunks?page=${p}`, token
      );
      setChunks(data.chunks); setTotalPages(data.total_pages); setTotal(data.total);
      const init: Record<string, { topic_label: string; content: string }> = {};
      data.chunks.forEach(c => { init[c.id] = { topic_label: c.topic_label, content: c.content }; });
      setEdits(prev => ({ ...prev, ...init }));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function saveChunk(chunkId: string) {
    setSaving(chunkId); setError('');
    try {
      const edit = edits[chunkId];
      const res = await fetch(`${API_BASE}/api/v1/admin/curriculum/chunks/${chunkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ topic_label: edit.topic_label, content: edit.content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSavedIds(prev => new Set([...prev, chunkId]));
      setChunks(prev => prev.map(c => c.id === chunkId ? { ...c, ...data } : c));
    } catch (e: any) { setError(e.message); }
    finally { setSaving(null); }
  }

  async function saveAll() {
    for (const chunk of chunks) {
      const edit = edits[chunk.id];
      if (edit && (edit.topic_label !== chunk.topic_label || edit.content !== chunk.content)) {
        await saveChunk(chunk.id);
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div>
            <h2 className="text-lg font-semibold text-neutral-800">Edit Curriculum Chunks</h2>
            <p className="text-xs text-neutral-400 mt-0.5">{total} total chunks · 5 per page · Page {page} of {totalPages}</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 text-xl">✕</button>
        </div>
        {error && <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">{error}</div>}
        <div className="px-6 py-4 flex flex-col gap-4">
          {loading ? <p className="text-center text-neutral-400 py-8">Loading...</p>
          : chunks.map((chunk, i) => {
            const edit = edits[chunk.id] || { topic_label: chunk.topic_label, content: chunk.content };
            const isDirty = edit.topic_label !== chunk.topic_label || edit.content !== chunk.content;
            const isSaved = savedIds.has(chunk.id);
            return (
              <div key={chunk.id} className="border border-neutral-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-neutral-400">Day {(page - 1) * 5 + i + 1} · Chunk #{chunk.chunk_index + 1}</span>
                  <div className="flex items-center gap-2">
                    {isSaved && <span className="text-xs text-emerald-600">✓ Saved</span>}
                    {isDirty && !isSaved && <Button size="xs" onClick={() => saveChunk(chunk.id)} loading={saving === chunk.id}>Save</Button>}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div>
                    <label className="text-xs text-neutral-500 mb-1 block">Topic / Day Label</label>
                    <input value={edit.topic_label}
                      onChange={e => setEdits(prev => ({ ...prev, [chunk.id]: { ...edit, topic_label: e.target.value } }))}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300/30" />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-500 mb-1 block">Content</label>
                    <textarea value={edit.content}
                      onChange={e => setEdits(prev => ({ ...prev, [chunk.id]: { ...edit, content: e.target.value } }))}
                      rows={4} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300/30 resize-y" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-100">
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-neutral-200 rounded-lg disabled:opacity-40 hover:bg-neutral-50">← Prev</button>
            <span className="text-sm text-neutral-500">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-neutral-200 rounded-lg disabled:opacity-40 hover:bg-neutral-50">Next →</button>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button onClick={saveAll}>Save All on Page</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Plans Page ───────────────────────────────────────────────────────────
export default function PlansPage() {
  const token = getToken() || '';
  const [sections, setSections] = useState<SectionPlan[]>([]);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [academicYear, setAcademicYear] = useState('');
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [specialDays, setSpecialDays] = useState<SpecialDayGroup[]>([]);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [generatingClass, setGeneratingClass] = useState<{ id: string; name: string; hasCurriculum: boolean } | null>(null);
  const [viewingPlan, setViewingPlan] = useState<{ sectionId: string; sectionLabel: string; className: string; month: number; year: number } | null>(null);

  useEffect(() => {
    apiGet<any[]>('/api/v1/admin/calendar', token)
      .then(rows => { if (rows.length > 0) setAcademicYear(rows[0].academic_year); })
      .catch(console.error);
    apiGet<SectionPlan[]>('/api/v1/admin/calendar/plans', token)
      .then(setSections).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!academicYear) return;
    apiGet<Holiday[]>(`/api/v1/admin/calendar/${academicYear}/holidays`, token).then(setHolidays).catch(console.error);
    apiGet<SpecialDayGroup[]>(`/api/v1/admin/calendar/${academicYear}/special-days`, token).then(setSpecialDays).catch(console.error);
  }, [academicYear]);

  function holidaysInMonth(month: number, year: number) {
    return holidays.filter(h => { const d = parseDate(h.holiday_date); return d.getMonth() + 1 === month && d.getFullYear() === year; });
  }
  function specialDaysInMonth(month: number, year: number) {
    return specialDays.filter(g => {
      const from = parseDate(g.from_date); const to = parseDate(g.to_date);
      const mStart = new Date(year, month - 1, 1); const mEnd = new Date(year, month, 0);
      return from <= mEnd && to >= mStart;
    });
  }
  function toggleMonth(key: string) {
    setExpandedMonths(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  }

  async function exportPdf(sectionId: string, month: number, year: number, className: string, label: string) {
    const key = `${sectionId}-${month}-${year}`;
    setExportingId(key);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/calendar/plans/${sectionId}/export?month=${month}&year=${year}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const blob = await res.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `plan-${className}-${label}-${year}-${month}.pdf`; a.click(); URL.revokeObjectURL(url);
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Export failed'); }
    finally { setExportingId(null); }
  }

  const byClass = sections.reduce<Record<string, SectionPlan[]>>((acc, s) => {
    if (!acc[s.class_id]) acc[s.class_id] = [];
    acc[s.class_id].push(s);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-neutral-900 tracking-tight mb-2">Plans</h1>
      <p className="text-sm text-neutral-500 mb-6">Manage curriculum day plans by class and section.</p>

      {loading && <p className="text-sm text-neutral-400">Loading...</p>}
      {!loading && sections.length === 0 && (
        <Card className="text-center py-12 text-neutral-400">No plans generated yet. Use "Assign Daily Planner" on each class.</Card>
      )}

      <div className="flex flex-col gap-6">
        {Object.values(byClass).map(classSections => {
          const className = classSections[0].class_name;
          const curriculum = classSections[0].curriculum_filename;
          const curriculumStatus = classSections[0].curriculum_status;
          const hasCurriculum = curriculumStatus === 'ready';

          return (
            <Card key={classSections[0].class_id}>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-100">
                <div>
                  <h2 className="text-base font-semibold text-neutral-800">{className}</h2>
                  {curriculum ? (
                    <p className="text-xs text-neutral-400 mt-0.5">
                      📄 {curriculum}
                      {classSections[0].total_chunks && ` · ${classSections[0].total_chunks} chunks`}
                      {curriculumStatus && <Badge label={curriculumStatus} variant={hasCurriculum ? 'success' : 'warning'} />}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-500 mt-0.5">⚠ No curriculum uploaded</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {hasCurriculum && (
                    <Button size="sm" variant="ghost" onClick={() => setEditingClassId(classSections[0].class_id)}>
                      ✏️ Edit Chunks
                    </Button>
                  )}
                  <Button size="sm" variant="secondary"
                    onClick={() => setGeneratingClass({ id: classSections[0].class_id, name: className, hasCurriculum })}>
                    📅 Assign Daily Planner
                  </Button>
                  <span className="text-xs text-neutral-400">{classSections.length} section{classSections.length > 1 ? 's' : ''}</span>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {classSections.map(sec => (
                  <div key={sec.section_id} className="bg-neutral-50 rounded-xl p-4">
                    <div className="flex flex-wrap gap-3 mb-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-neutral-500">Class Teacher:</span>
                        {sec.class_teacher_name
                          ? <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{sec.class_teacher_name}</span>
                          : <span className="text-amber-500">Not assigned</span>}
                      </div>
                      {sec.supporting_teachers.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-neutral-500">Supporting:</span>
                          {sec.supporting_teachers.map(t => (
                            <span key={t.id} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{t.name}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {sec.plans.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        <p className="text-xs text-neutral-500 mb-1">Generated Plans</p>
                        {sec.plans.map(p => {
                          const key = `${sec.section_id}-${p.plan_month}-${p.plan_year}`;
                          const mHolidays = holidaysInMonth(p.plan_month, p.plan_year);
                          const mSpecial = specialDaysInMonth(p.plan_month, p.plan_year);
                          const totalSpecial = mSpecial.reduce((s, g) => s + g.count, 0);
                          const expanded = expandedMonths.has(key);
                          return (
                            <div key={key} className="bg-white rounded-lg border border-neutral-100 overflow-hidden">
                              <div className="flex items-center justify-between px-3 py-2">
                                <div className="flex items-center gap-3 flex-wrap">
                                  <span className="text-sm font-medium text-neutral-700">{MONTHS[p.plan_month - 1]} {p.plan_year}</span>
                                  <span className="text-xs text-neutral-400">· {p.days_count} working days</span>
                                  {mHolidays.length > 0 && <span className="text-xs text-red-500">🎉 {mHolidays.length} holiday{mHolidays.length > 1 ? 's' : ''}</span>}
                                  {totalSpecial > 0 && <span className="text-xs text-blue-500">📌 {totalSpecial} special day{totalSpecial > 1 ? 's' : ''}</span>}
                                  {(mHolidays.length > 0 || mSpecial.length > 0) && (
                                    <button onClick={() => toggleMonth(key)} className="text-xs text-neutral-400 hover:text-neutral-600 underline">
                                      {expanded ? 'hide' : 'details'}
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button size="sm" variant="ghost"
                                    onClick={() => setViewingPlan({ sectionId: sec.section_id, sectionLabel: sec.section_label, className, month: p.plan_month, year: p.plan_year })}>
                                    👁 View
                                  </Button>
                                  <Button size="sm" variant="ghost" loading={exportingId === key}
                                    onClick={() => exportPdf(sec.section_id, p.plan_month, p.plan_year, sec.class_name, sec.section_label)}>
                                    Export PDF
                                  </Button>
                                </div>
                              </div>
                              {expanded && (
                                <div className="border-t border-neutral-100 px-3 py-2 flex flex-col gap-2">
                                  {mHolidays.length > 0 && (
                                    <div>
                                      <p className="text-xs font-medium text-neutral-500 mb-1">Holidays</p>
                                      {mHolidays.map(h => (
                                        <div key={h.id} className="flex items-center gap-2 text-xs">
                                          <span className="text-red-400 w-16 shrink-0">{fmtShort(h.holiday_date)}</span>
                                          <span className="text-neutral-700">{h.event_name}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {mSpecial.length > 0 && (
                                    <div>
                                      <p className="text-xs font-medium text-neutral-500 mb-1">Special Days</p>
                                      {mSpecial.map((g, i) => (
                                        <div key={i} className="flex items-center gap-2 text-xs">
                                          <span className="text-neutral-700">{g.label}</span>
                                          <span className="text-neutral-400">{fmtShort(g.from_date)}{g.count > 1 ? ` · ${g.count} days` : ''}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-400">No plans generated yet for this section.</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {editingClassId && <ChunkEditor classId={editingClassId} onClose={() => setEditingClassId(null)} />}
      {generatingClass && <PlanGenerator classId={generatingClass.id} className={generatingClass.name} hasCurriculum={generatingClass.hasCurriculum} onClose={() => setGeneratingClass(null)} />}
      {viewingPlan && <PlanViewer sectionId={viewingPlan.sectionId} sectionLabel={viewingPlan.sectionLabel} className={viewingPlan.className} month={viewingPlan.month} year={viewingPlan.year} onClose={() => setViewingPlan(null)} />}
    </div>
  );
}
