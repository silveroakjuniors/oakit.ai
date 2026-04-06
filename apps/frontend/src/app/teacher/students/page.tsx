'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE, apiGet, apiPost } from '@/lib/api';
import { getToken, clearToken } from '@/lib/auth';
import OakitLogo from '@/components/OakitLogo';

interface Student { id: string; name: string; class_name: string; section_label: string; photo_url?: string; }
interface Section { section_id: string; section_label: string; class_name: string; role: string; }
interface Observation { id: string; obs_text: string | null; categories: string[]; share_with_parent: boolean; obs_date: string; created_at: string; teacher_name: string; }
interface Milestone { id: string; domain: string; description: string; position: number; is_custom: boolean; achieved_at: string | null; achieved_by: string | null; }
interface MilestoneData { class_level: string; milestones: Milestone[]; total: number; achieved: number; completion_pct: number; }

const CATEGORIES = ['Behavior', 'Social Skills', 'Academic Progress', 'Motor Skills', 'Language', 'Other'];
const DOMAIN_ICONS: Record<string, string> = { Cognitive: '🧠', Social: '🤝', Motor: '🏃', Language: '🗣️', Other: '📌' };

export default function TeacherStudentsPage() {
  const router = useRouter();
  const token = getToken() || '';
  const [sections, setSections] = useState<Section[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [activeSection, setActiveSection] = useState('');
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [studentTab, setStudentTab] = useState<'observations' | 'milestones'>('observations');
  const [observations, setObservations] = useState<Observation[]>([]);
  const [milestoneData, setMilestoneData] = useState<MilestoneData | null>(null);
  const [obsText, setObsText] = useState('');
  const [obsCategories, setObsCategories] = useState<string[]>([]);
  const [obsShare, setObsShare] = useState(false);
  const [savingObs, setSavingObs] = useState(false);
  const [obsError, setObsError] = useState('');
  const [obsMsg, setObsMsg] = useState('');
  const [togglingMilestone, setTogglingMilestone] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    loadSections();
  }, []);

  async function loadSections() {
    try {
      const data = await apiGet<Section[]>('/api/v1/teacher/sections', token);
      setSections(data);
      if (data.length > 0) { setActiveSection(data[0].section_id); loadStudents(data[0].section_id); }
    } catch {}
  }

  async function loadStudents(sectionId: string) {
    try {
      const data = await apiGet<Student[]>(`/api/v1/teacher/sections/${sectionId}/students`, token);
      setStudents(data);
    } catch {}
  }

  async function openStudent(student: Student) {
    setActiveStudent(student);
    setStudentTab('observations');
    setObsText(''); setObsCategories([]); setObsShare(false); setObsError(''); setObsMsg('');
    await Promise.all([loadObservations(student.id), loadMilestones(student.id)]);
  }

  async function loadObservations(studentId: string) {
    try { setObservations(await apiGet<Observation[]>(`/api/v1/teacher/observations/${studentId}`, token)); } catch {}
  }

  async function loadMilestones(studentId: string) {
    try { setMilestoneData(await apiGet<MilestoneData>(`/api/v1/teacher/milestones/${studentId}`, token)); } catch {}
  }

  async function saveObservation() {
    if (!obsText.trim() && obsCategories.length === 0) { setObsError('Please add a note or select a category.'); return; }
    if (obsText.length > 500) { setObsError('Note must be 500 characters or less.'); return; }
    setSavingObs(true); setObsError(''); setObsMsg('');
    try {
      await apiPost('/api/v1/teacher/observations', {
        student_id: activeStudent!.id, obs_text: obsText.trim() || null,
        categories: obsCategories, share_with_parent: obsShare,
      }, token);
      setObsText(''); setObsCategories([]); setObsShare(false);
      setObsMsg('✓ Observation saved');
      await loadObservations(activeStudent!.id);
    } catch (e: any) { setObsError(e.message || 'Failed to save'); }
    finally { setSavingObs(false); }
  }

  async function toggleMilestone(milestoneId: string, achieved: boolean) {
    if (!activeStudent) return;
    setTogglingMilestone(milestoneId);
    try {
      if (achieved) {
        await fetch(`${API_BASE}/api/v1/teacher/milestones/${activeStudent.id}/${milestoneId}/achieve`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      } else {
        await apiPost(`/api/v1/teacher/milestones/${activeStudent.id}/${milestoneId}/achieve`, {}, token);
      }
      await loadMilestones(activeStudent.id);
    } catch {}
    finally { setTogglingMilestone(null); }
  }

  async function toggleObsShare(obsId: string, current: boolean) {
    try {
      await fetch(`${API_BASE}/api/v1/teacher/observations/${obsId}`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ share_with_parent: !current }),
      });
      await loadObservations(activeStudent!.id);
    } catch {}
  }

  const groupedMilestones = milestoneData?.milestones.reduce((acc: Record<string, Milestone[]>, m) => {
    if (!acc[m.domain]) acc[m.domain] = [];
    acc[m.domain].push(m);
    return acc;
  }, {}) ?? {};

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="text-white px-4 py-3 flex items-center justify-between shrink-0"
        style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 100%)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => activeStudent ? setActiveStudent(null) : router.back()} className="text-white/60 hover:text-white text-lg">←</button>
          <OakitLogo size="xs" variant="light" />
          <span className="text-sm text-white/80 font-medium">{activeStudent ? activeStudent.name : 'Students'}</span>
        </div>
        <button onClick={() => { clearToken(); router.push('/login'); }} className="text-white/50 text-xs">Sign out</button>
      </header>

      {!activeStudent ? (
        <div className="p-4 max-w-2xl mx-auto w-full">
          {/* Section selector */}
          {sections.length > 1 && (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {sections.map(s => (
                <button key={s.section_id} onClick={() => { setActiveSection(s.section_id); loadStudents(s.section_id); }}
                  className={`px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${activeSection === s.section_id ? 'bg-primary-600 text-white' : 'bg-white border border-neutral-200 text-neutral-600'}`}>
                  {s.class_name} {s.section_label}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {students.length === 0 && (
              <div className="text-center py-12">
                <p className="text-3xl mb-2">🎒</p>
                <p className="text-sm text-neutral-500">No students found</p>
                <p className="text-xs text-neutral-400 mt-1">Students are loaded from your section&apos;s attendance records</p>
              </div>
            )}
            {students.map(s => (
              <button key={s.id} onClick={() => openStudent(s)}
                className="bg-white border border-neutral-200 rounded-2xl p-4 flex items-center gap-3 text-left hover:bg-neutral-50 transition-colors shadow-sm">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center font-bold text-primary-700 shrink-0 overflow-hidden">
                  {s.photo_url ? <img src={`${API_BASE}${s.photo_url}`} alt={s.name} className="w-full h-full object-contain" /> : s.name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-800">{s.name}</p>
                  <p className="text-xs text-neutral-500">{s.class_name} · {s.section_label}</p>
                </div>
                <span className="ml-auto text-neutral-300 text-lg">›</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
          {/* Student tab bar */}
          <div className="flex bg-white border-b border-neutral-200 px-4">
            {(['observations', 'milestones'] as const).map(t => (
              <button key={t} onClick={() => setStudentTab(t)}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-all capitalize ${studentTab === t ? 'border-primary-600 text-primary-700' : 'border-transparent text-neutral-400'}`}>
                {t === 'observations' ? '📝 Observations' : '🏆 Milestones'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-8">
            {studentTab === 'observations' && (
              <>
                {/* Add observation form */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-100">
                  <p className="text-sm font-semibold text-neutral-700 mb-3">Add Observation</p>
                  <textarea value={obsText} onChange={e => setObsText(e.target.value.slice(0, 500))}
                    placeholder="Write a note about this student... (optional if category selected)"
                    rows={3} className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 resize-none mb-2" />
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-neutral-400">{obsText.length}/500</span>
                  </div>
                  {/* Category chips */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {CATEGORIES.map(cat => (
                      <button key={cat} onClick={() => setObsCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${obsCategories.includes(cat) ? 'bg-primary-600 text-white border-primary-600' : 'border-neutral-200 text-neutral-600 hover:border-primary-300'}`}>
                        {cat}
                      </button>
                    ))}
                  </div>
                  {/* Share toggle */}
                  <label className="flex items-center gap-2 cursor-pointer mb-3">
                    <div onClick={() => setObsShare(!obsShare)}
                      className={`w-10 h-6 rounded-full transition-colors relative ${obsShare ? 'bg-primary-600' : 'bg-neutral-200'}`}>
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${obsShare ? 'left-5' : 'left-1'}`} />
                    </div>
                    <span className="text-xs text-neutral-600">Share with parent</span>
                  </label>
                  {obsError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl mb-2">{obsError}</p>}
                  {obsMsg && <p className="text-xs text-green-600 mb-2">{obsMsg}</p>}
                  <button onClick={saveObservation} disabled={savingObs}
                    className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors">
                    {savingObs ? 'Saving...' : 'Save Observation'}
                  </button>
                </div>

                {/* Observation history */}
                {observations.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">History</p>
                    {observations.map(obs => (
                      <div key={obs.id} className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-100">
                        {obs.obs_text && <p className="text-sm text-neutral-700 mb-2">{obs.obs_text}</p>}
                        {obs.categories.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {obs.categories.map(c => <span key={c} className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">{c}</span>)}
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-neutral-400">{obs.obs_date} · {obs.teacher_name}</p>
                          <button onClick={() => toggleObsShare(obs.id, obs.share_with_parent)}
                            className={`text-xs px-2 py-1 rounded-lg transition-colors ${obs.share_with_parent ? 'bg-green-50 text-green-700' : 'bg-neutral-50 text-neutral-500'}`}>
                            {obs.share_with_parent ? '👁 Shared' : 'Share'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {observations.length === 0 && <p className="text-sm text-neutral-400 text-center py-4">No observations yet</p>}
              </>
            )}

            {studentTab === 'milestones' && milestoneData && (
              <>
                {/* Progress */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-neutral-700">{milestoneData.class_level} Milestones</p>
                    <span className="text-lg font-bold text-primary-700">{milestoneData.completion_pct}%</span>
                  </div>
                  <div className="w-full bg-neutral-100 rounded-full h-2.5">
                    <div className="h-2.5 rounded-full bg-primary-500 transition-all" style={{ width: `${milestoneData.completion_pct}%` }} />
                  </div>
                  <p className="text-xs text-neutral-400 mt-1.5">{milestoneData.achieved} of {milestoneData.total} achieved</p>
                </div>

                {/* Milestones by domain */}
                {Object.entries(groupedMilestones).map(([domain, items]) => (
                  <div key={domain} className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
                    <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-100">
                      <p className="text-sm font-semibold text-neutral-700">{DOMAIN_ICONS[domain] ?? '📌'} {domain}</p>
                    </div>
                    {items.map(m => (
                      <button key={m.id} onClick={() => toggleMilestone(m.id, !!m.achieved_at)} disabled={togglingMilestone === m.id}
                        className={`w-full flex items-center gap-3 px-4 py-3 border-b border-neutral-50 last:border-0 text-left transition-colors ${m.achieved_at ? 'bg-green-50/50' : 'hover:bg-neutral-50'}`}>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${m.achieved_at ? 'bg-green-500 border-green-500' : 'border-neutral-300'}`}>
                          {m.achieved_at && <span className="text-white text-xs">✓</span>}
                          {togglingMilestone === m.id && <span className="text-neutral-400 text-xs">⏳</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${m.achieved_at ? 'text-green-700' : 'text-neutral-700'}`}>{m.description}</p>
                          {m.achieved_at && <p className="text-xs text-green-500 mt-0.5">Achieved {m.achieved_at} by {m.achieved_by}</p>}
                        </div>
                      </button>
                    ))}
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
