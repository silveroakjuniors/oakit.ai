'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE, apiGet, apiPost } from '@/lib/api';
import { getToken, clearToken } from '@/lib/auth';
import OakitLogo from '@/components/OakitLogo';
import { X, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';

interface Student { id: string; name: string; class_name: string; section_label: string; photo_url?: string; }
interface Section { section_id: string; section_label: string; class_name: string; role: string; }
interface Observation { id: string; obs_text: string | null; categories: string[]; share_with_parent: boolean; obs_date: string; created_at: string; teacher_name: string; }
interface Milestone { id: string; domain: string; description: string; position: number; is_custom: boolean; achieved_at: string | null; achieved_by: string | null; }
interface MilestoneData { class_level: string; milestones: Milestone[]; total: number; achieved: number; completion_pct: number; }

const CATEGORY_CONFIG = [
  { id: 'Cognitive Skills',         label: 'Cognitive Skills',         icon: '🧠', color: 'text-pink-700',    bg: 'bg-pink-50',    border: 'border-pink-200' },
  { id: 'Language & Communication', label: 'Language & Communication', icon: '🗣️', color: 'text-purple-700',  bg: 'bg-purple-50',  border: 'border-purple-200' },
  { id: 'Social Interaction',       label: 'Social Interaction',       icon: '🤝', color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  { id: 'Motor Skills',             label: 'Motor Skills',             icon: '🏃', color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  { id: 'Emotional Development',    label: 'Emotional Development',    icon: '💛', color: 'text-yellow-700',  bg: 'bg-yellow-50',  border: 'border-yellow-200' },
  { id: 'Creative Expression',      label: 'Creative Expression',      icon: '🎨', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { id: 'Academic Progress',        label: 'Academic Progress',        icon: '📚', color: 'text-indigo-700',  bg: 'bg-indigo-50',  border: 'border-indigo-200' },
  { id: 'Behavior',                 label: 'Behavior',                 icon: '⭐', color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200' },
  { id: 'Physical Health',          label: 'Physical Health',          icon: '💪', color: 'text-teal-700',    bg: 'bg-teal-50',    border: 'border-teal-200' },
  { id: 'Other',                    label: 'Other',                    icon: '📌', color: 'text-neutral-700', bg: 'bg-neutral-50', border: 'border-neutral-200' },
] as const;

type CategoryConfig = typeof CATEGORY_CONFIG[number];

const DOMAIN_ICONS: Record<string, string> = { Cognitive: '🧠', Social: '🤝', Motor: '🏃', Language: '🗣️', Other: '📌' };

const AI_PROMPTS: Record<string, string[]> = {
  'Cognitive Skills':         ['Shows strong problem-solving ability', 'Needs support with memory and recall', 'Excellent pattern recognition', 'Struggles with abstract concepts'],
  'Language & Communication': ['Communicates clearly and confidently', 'Vocabulary is expanding well', 'Needs encouragement to speak up', 'Excellent listening skills'],
  'Social Interaction':       ['Works well in group activities', 'Needs support sharing with peers', 'Shows leadership qualities', 'Prefers to work independently'],
  'Motor Skills':             ['Fine motor skills are developing well', 'Needs support with pencil grip', 'Excellent coordination and balance', 'Struggles with cutting and pasting'],
  'Emotional Development':    ['Manages emotions well', 'Gets frustrated easily, needs calming strategies', 'Shows empathy towards classmates', 'Separation anxiety observed'],
  'Creative Expression':      ['Shows great imagination in art', 'Loves storytelling and role play', 'Excellent musical sense', 'Needs encouragement to try new activities'],
  'Academic Progress':        ['Performing above grade level', 'Needs additional support in reading', 'Excellent number sense', 'Making steady progress'],
  'Behavior':                 ['Follows classroom rules consistently', 'Needs reminders about classroom expectations', 'Positive attitude and enthusiasm', 'Disruptive during group time'],
  'Physical Health':          ['Active and energetic', 'Tires easily, may need rest breaks', 'Good appetite and hydration habits', 'Needs support with self-care routines'],
  'Other':                    ['General positive progress noted', 'Parent meeting recommended', 'Requires follow-up next week', 'Showing improvement overall'],
};

function ObservationModal({ student, category, token, onClose, onSaved }: {
  student: Student; category: CategoryConfig; token: string; onClose: () => void; onSaved: () => void;
}) {
  const [obsText, setObsText] = useState('');
  const [obsShare, setObsShare] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const suggestions = AI_PROMPTS[category.id] || AI_PROMPTS['Other'];

  async function save() {
    if (!obsText.trim()) { setError('Please write an observation note.'); return; }
    setSaving(true); setError('');
    try {
      await apiPost('/api/v1/teacher/observations', {
        student_id: student.id, obs_text: obsText.trim(),
        categories: [category.id], share_with_parent: obsShare,
      }, token);
      onSaved(); onClose();
    } catch (e: any) { setError(e.message || 'Failed to save'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full lg:w-[480px] bg-white rounded-t-3xl lg:rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 ${category.bg} border-b ${category.border}`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{category.icon}</span>
            <div>
              <p className="text-sm font-bold text-neutral-800">{category.label}</p>
              <p className="text-xs text-neutral-500">{student.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/60 hover:bg-white flex items-center justify-center text-neutral-500 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles size={13} className="text-primary-500" />
              <p className="text-xs font-semibold text-neutral-600">Oakie suggestions — tap to use</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => setObsText(s)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all text-left ${
                    obsText === s ? `${category.bg} ${category.border} ${category.color} font-semibold` : 'border-neutral-200 text-neutral-600 hover:border-primary-300 hover:bg-primary-50'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-neutral-600 mb-1.5">Your observation</p>
            <textarea value={obsText} onChange={e => setObsText(e.target.value.slice(0, 500))}
              placeholder={`Write your observation about ${student.name.split(' ')[0]}...`}
              rows={4} autoFocus
              className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 resize-none" />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-neutral-400">{obsText.length}/500</span>
              {obsText.length > 0 && <button onClick={() => setObsText('')} className="text-xs text-neutral-400 hover:text-neutral-600">Clear</button>}
            </div>
          </div>

          <div className="flex items-center justify-between px-3 py-2.5 bg-neutral-50 rounded-xl border border-neutral-100">
            <div>
              <p className="text-xs font-semibold text-neutral-700">Share with parent</p>
              <p className="text-[10px] text-neutral-400">Parent will see this in their portal</p>
            </div>
            <button onClick={() => setObsShare(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${obsShare ? 'bg-primary-600' : 'bg-neutral-200'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${obsShare ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-neutral-200 rounded-xl text-sm text-neutral-600 hover:bg-neutral-50 transition-colors">Cancel</button>
          <button onClick={save} disabled={saving || !obsText.trim()}
            className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-xl disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            {saving ? 'Saving…' : 'Save Observation'}
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const [togglingMilestone, setTogglingMilestone] = useState<string | null>(null);
  const [modalCategory, setModalCategory] = useState<CategoryConfig | null>(null);

  useEffect(() => { if (!token) { router.push('/login'); return; } loadSections(); }, []);

  async function loadSections() {
    try {
      const data = await apiGet<Section[]>('/api/v1/teacher/sections', token);
      setSections(data);
      if (data.length > 0) { setActiveSection(data[0].section_id); loadStudents(data[0].section_id); }
    } catch {}
  }

  async function loadStudents(sectionId: string) {
    try { setStudents(await apiGet<Student[]>(`/api/v1/teacher/sections/${sectionId}/students`, token)); } catch {}
  }

  async function openStudent(student: Student) {
    setActiveStudent(student);
    setStudentTab('observations');
    await Promise.all([loadObservations(student.id), loadMilestones(student.id)]);
  }

  async function loadObservations(studentId: string) {
    try { setObservations(await apiGet<Observation[]>(`/api/v1/teacher/observations/${studentId}`, token)); } catch {}
  }

  async function loadMilestones(studentId: string) {
    try { setMilestoneData(await apiGet<MilestoneData>(`/api/v1/teacher/milestones/${studentId}`, token)); } catch {}
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

  const obsByCategory = observations.reduce((acc: Record<string, number>, obs) => {
    obs.categories.forEach(c => { acc[c] = (acc[c] || 0) + 1; });
    return acc;
  }, {});

  const coveredCategories = Object.keys(obsByCategory).length;

  const groupedMilestones = milestoneData?.milestones.reduce((acc: Record<string, Milestone[]>, m) => {
    if (!acc[m.domain]) acc[m.domain] = [];
    acc[m.domain].push(m);
    return acc;
  }, {}) ?? {};

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {modalCategory && activeStudent && (
        <ObservationModal student={activeStudent} category={modalCategory} token={token}
          onClose={() => setModalCategory(null)} onSaved={() => loadObservations(activeStudent.id)} />
      )}

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
                {/* Summary */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-100">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-neutral-800">{activeStudent.name}</p>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      coveredCategories === 0 ? 'bg-red-100 text-red-600' :
                      coveredCategories < CATEGORY_CONFIG.length / 2 ? 'bg-amber-100 text-amber-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {coveredCategories}/{CATEGORY_CONFIG.length} categories covered
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">Tap any category below to add an observation</p>
                </div>

                {/* Category grid */}
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORY_CONFIG.map(cat => {
                    const count = obsByCategory[cat.id] || 0;
                    return (
                      <button key={cat.id} onClick={() => setModalCategory(cat)}
                        className={`flex items-center gap-2.5 px-3 py-3 rounded-2xl border-2 text-left transition-all hover:shadow-sm active:scale-95 ${
                          count > 0 ? `${cat.bg} ${cat.border}` : 'bg-white border-neutral-200 hover:border-neutral-300'
                        }`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-base ${count > 0 ? cat.bg : 'bg-neutral-100'}`}>
                          {cat.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-semibold leading-tight ${count > 0 ? cat.color : 'text-neutral-700'}`}>{cat.label}</p>
                          {count > 0 && <p className={`text-[10px] font-medium mt-0.5 ${cat.color} opacity-70`}>{count} note{count > 1 ? 's' : ''}</p>}
                        </div>
                        {count === 0 ? (
                          <div className="w-5 h-5 rounded-full border-2 border-neutral-200 shrink-0" />
                        ) : (
                          <CheckCircle2 size={16} className={`${cat.color} shrink-0`} />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* History */}
                {observations.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">All Observations ({observations.length})</p>
                    {observations.map(obs => {
                      const catConfig = CATEGORY_CONFIG.find(c => obs.categories.includes(c.id));
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
                              {obs.obs_text && <p className="text-sm text-neutral-700 leading-relaxed">{obs.obs_text}</p>}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-neutral-400">{obs.obs_date} · {obs.teacher_name}</p>
                            <button onClick={() => toggleObsShare(obs.id, obs.share_with_parent)}
                              className={`text-xs px-2.5 py-1 rounded-lg transition-colors font-medium ${obs.share_with_parent ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-neutral-50 text-neutral-500 border border-neutral-200'}`}>
                              {obs.share_with_parent ? '👁 Shared' : 'Share'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {observations.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-2xl mb-2">📝</p>
                    <p className="text-sm text-neutral-500 font-medium">No observations yet</p>
                    <p className="text-xs text-neutral-400 mt-1">Tap any category above to add your first observation</p>
                  </div>
                )}
              </>
            )}

            {studentTab === 'milestones' && milestoneData && (
              <>
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
                          {m.achieved_at && <p className="text-xs text-green-500 mt-0.5">Achieved {m.achieved_at}</p>}
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
