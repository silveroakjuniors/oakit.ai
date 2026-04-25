'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE, apiGet, apiPost } from '@/lib/api';
import { getToken, signOut } from '@/lib/auth';
import OakitLogo from '@/components/OakitLogo';
import { X, Loader2, Sparkles, CheckCircle2, Plus, Pencil, Trash2, Wand2 } from 'lucide-react';

interface Student { id: string; name: string; class_name: string; section_label: string; photo_url?: string; }
interface Section { section_id: string; section_label: string; class_name: string; role: string; }
interface Observation { id: string; obs_text: string | null; categories: string[]; share_with_parent: boolean; obs_date: string; created_at: string; teacher_name: string; }
interface Milestone {
  id: string; domain: string; description: string; position: number;
  is_custom: boolean; term: string | null;
  achieved_at: string | null; achieved_by: string | null; achievement_comment: string | null;
}
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

const DOMAIN_ICONS: Record<string, string> = { Cognitive: '🧠', Social: '🤝', Motor: '🏃', Language: '🗣️', Other: '📌' };

// All skill domains mapped to their display label and suggestions
const SKILL_DOMAINS = [
  { key: 'Cognitive',   label: 'Cognitive Skills',         icon: '🧠' },
  { key: 'Language',    label: 'Language & Communication', icon: '🗣️' },
  { key: 'Social',      label: 'Social Interaction',       icon: '🤝' },
  { key: 'Emotional',   label: 'Emotional Development',    icon: '💛' },
  { key: 'GrossMotor',  label: 'Gross Motor Skills',       icon: '🏃' },
  { key: 'FineMotor',   label: 'Fine Motor Skills',        icon: '✏️' },
  { key: 'Creativity',  label: 'Creativity & Expression',  icon: '🎨' },
  { key: 'Participation', label: 'Classroom Participation', icon: '🙋' },
  { key: 'Peer',        label: 'Peer Interaction',         icon: '👫' },
  { key: 'Behaviour',   label: 'Behavioral Observations',  icon: '⭐' },
  { key: 'Other',       label: 'Other',                    icon: '📌' },
];

// Class-level-aware suggestions per domain
const CLASS_SUGGESTIONS: Record<string, Record<string, string[]>> = {
  // Play Group / Nursery (youngest)
  playgroup: {
    Cognitive:    ['Recognises familiar faces and objects', 'Responds to their own name', 'Shows curiosity by exploring objects', 'Begins to match simple shapes'],
    Language:     ['Uses single words to communicate needs', 'Points to objects when named', 'Enjoys listening to simple rhymes', 'Babbles and vocalises expressively'],
    Social:       ['Plays alongside other children (parallel play)', 'Responds to simple social cues', 'Enjoys interaction with familiar adults', 'Beginning to share with prompting'],
    Emotional:    ['Shows attachment to primary caregiver', 'Expresses basic emotions (happy, sad, upset)', 'Needs comfort when distressed', 'Beginning to self-soothe with support'],
    GrossMotor:   ['Walks steadily without support', 'Climbs low steps with help', 'Kicks a ball with one foot', 'Runs with increasing confidence'],
    FineMotor:    ['Holds crayon with fist grip', 'Turns pages of a board book', 'Stacks 3–4 blocks', 'Scribbles spontaneously'],
    Creativity:   ['Enjoys sensory play (sand, water, clay)', 'Participates in simple music and movement', 'Shows interest in art materials', 'Engages in simple pretend play'],
    Participation:['Sits for short circle time activities', 'Follows one-step instructions', 'Attends to a story for 2–3 minutes', 'Participates in group songs'],
    Peer:         ['Notices other children and smiles', 'Plays near peers without conflict', 'Offers toys occasionally', 'Watches and imitates peers'],
    Behaviour:    ['Follows simple classroom routines with support', 'Responds to redirection', 'Transitions between activities with help', 'Shows positive response to praise'],
    Other:        ['Demonstrates age-appropriate self-care (drinking, eating)', 'Recognises personal belongings', 'Shows interest in the environment'],
  },
  nursery: {
    Cognitive:    ['Sorts objects by colour or shape', 'Completes simple 4-piece puzzles', 'Understands concepts of big/small, more/less', 'Remembers simple sequences'],
    Language:     ['Uses 2–3 word phrases', 'Names common objects and pictures', 'Follows two-step instructions', 'Enjoys simple stories and retells parts'],
    Social:       ['Engages in simple cooperative play', 'Takes turns with prompting', 'Greets familiar adults and peers', 'Seeks help from teacher when needed'],
    Emotional:    ['Separates from parent with minimal distress', 'Identifies own feelings', 'Shows empathy when peers are upset', 'Manages frustration with adult support'],
    GrossMotor:   ['Jumps with both feet', 'Pedals a tricycle', 'Throws and catches a large ball', 'Balances on one foot briefly'],
    FineMotor:    ['Holds pencil with emerging tripod grip', 'Cuts along a straight line', 'Draws circles and crosses', 'Strings large beads'],
    Creativity:   ['Creates simple drawings with intention', 'Engages in role play with peers', 'Experiments with paint and collage', 'Sings simple songs from memory'],
    Participation:['Sits attentively for 10 minutes', 'Raises hand to contribute', 'Follows classroom rules with reminders', 'Completes tasks with minimal prompting'],
    Peer:         ['Plays cooperatively in small groups', 'Shares materials willingly', 'Resolves minor conflicts with guidance', 'Shows kindness to classmates'],
    Behaviour:    ['Follows classroom routines independently', 'Responds well to positive reinforcement', 'Transitions smoothly between activities', 'Shows self-control in group settings'],
    Other:        ['Recognises own name in print', 'Counts objects up to 5', 'Knows basic colours and shapes'],
  },
  lkg: {
    Cognitive:    ['Counts objects up to 10 accurately', 'Identifies letters of the alphabet', 'Solves simple addition with objects', 'Understands cause and effect'],
    Language:     ['Speaks in complete sentences', 'Retells a story in sequence', 'Asks and answers questions confidently', 'Vocabulary is expanding rapidly'],
    Social:       ['Initiates play with peers', 'Negotiates roles in group play', 'Shows awareness of others\' feelings', 'Participates actively in group discussions'],
    Emotional:    ['Manages emotions with minimal adult support', 'Shows confidence in new situations', 'Demonstrates resilience after setbacks', 'Expresses feelings using words'],
    GrossMotor:   ['Hops on one foot', 'Catches a small ball', 'Skips with alternating feet', 'Rides a bicycle with training wheels'],
    FineMotor:    ['Writes letters with guidance', 'Cuts along curved lines', 'Colours within boundaries', 'Folds paper into simple shapes'],
    Creativity:   ['Creates detailed drawings with story', 'Engages in imaginative play scenarios', 'Composes simple songs or rhymes', 'Uses art to express ideas'],
    Participation:['Listens attentively during lessons', 'Completes tasks independently', 'Asks relevant questions', 'Contributes ideas in group activities'],
    Peer:         ['Maintains friendships over time', 'Supports peers who need help', 'Resolves conflicts independently', 'Shows leadership in group activities'],
    Behaviour:    ['Follows multi-step instructions', 'Takes responsibility for belongings', 'Shows self-discipline during activities', 'Demonstrates respect for classroom rules'],
    Other:        ['Recognises and writes own name', 'Identifies numbers 1–20', 'Reads simple CVC words'],
  },
  ukg: {
    Cognitive:    ['Solves simple word problems', 'Reads simple sentences independently', 'Demonstrates logical reasoning', 'Applies learning to new situations'],
    Language:     ['Reads simple books with fluency', 'Writes simple sentences', 'Communicates ideas clearly in group', 'Uses descriptive language effectively'],
    Social:       ['Collaborates effectively in team tasks', 'Shows leadership and initiative', 'Demonstrates empathy and inclusion', 'Resolves peer conflicts constructively'],
    Emotional:    ['Demonstrates strong self-regulation', 'Shows confidence in public speaking', 'Handles disappointment maturely', 'Motivates peers positively'],
    GrossMotor:   ['Demonstrates good balance and coordination', 'Participates actively in sports', 'Shows agility in physical activities', 'Follows rules in team games'],
    FineMotor:    ['Writes legibly with correct grip', 'Draws detailed pictures with proportion', 'Uses scissors with precision', 'Completes craft projects neatly'],
    Creativity:   ['Creates original stories and artwork', 'Performs confidently in class presentations', 'Shows innovation in problem-solving', 'Expresses creativity across subjects'],
    Participation:['Leads group discussions', 'Completes all tasks on time', 'Shows enthusiasm for learning', 'Asks insightful questions'],
    Peer:         ['Mentors younger or struggling peers', 'Builds positive relationships across groups', 'Shows fairness and sportsmanship', 'Celebrates peers\' achievements'],
    Behaviour:    ['Consistently follows school values', 'Takes initiative without prompting', 'Shows accountability for actions', 'Models positive behaviour for peers'],
    Other:        ['Reads chapter books independently', 'Solves 2-digit addition and subtraction', 'Demonstrates school readiness skills'],
  },
};

// Map class name to suggestion tier
function getClassTier(classLevel: string): string {
  const cl = classLevel.toLowerCase();
  if (cl.includes('ukg') || cl.includes('upper kg') || cl.includes('kg 2') || cl.includes('sr kg') || cl.includes('senior kg')) return 'ukg';
  if (cl.includes('lkg') || cl.includes('lower kg') || cl.includes('kg 1') || cl.includes('jr kg') || cl.includes('junior kg')) return 'lkg';
  if (cl.includes('nursery') || cl.includes('nur')) return 'nursery';
  return 'playgroup'; // play group, toddler, etc.
}

const DOMAINS = SKILL_DOMAINS.map(d => d.key);
const TERMS = ['Term 1', 'Term 2', 'Term 3', 'Annual'];

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
      const res = await fetch(`${API_BASE}/api/v1/ai/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `Rewrite this milestone achievement note as a warm, professional 1-2 sentence observation for a school report: "${comment}"` }),
      });
      const data = await res.json();
      const refined = data.response || data.result || data.answer || data.text || '';
      if (refined) setComment(refined);
    } catch { /* silent */ }
    finally { setAiLoading(false); }
  }

  async function save() {
    setSaving(true); setError('');
    try {
      await fetch(`${API_BASE}/api/v1/teacher/milestones/${student.id}/${milestone.id}/achieve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
            <p className="text-xs text-neutral-500">{milestone.description}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/60 hover:bg-white flex items-center justify-center text-neutral-500"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-neutral-600">How did {student.name.split(' ')[0]} achieve this? <span className="text-neutral-400 font-normal">(optional)</span></p>
              <button onClick={askOakie} disabled={aiLoading || !comment.trim()}
                className="flex items-center gap-1 text-xs px-2.5 py-1 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 rounded-lg font-medium transition-colors disabled:opacity-40">
                {aiLoading ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                Ask Oakie
              </button>
            </div>
            <textarea value={comment} onChange={e => setComment(e.target.value.slice(0, 400))}
              placeholder={`e.g. ${student.name.split(' ')[0]} demonstrated this during circle time by...`}
              rows={4} autoFocus
              className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 resize-none" />
            <p className="text-xs text-neutral-400 mt-1">{comment.length}/400</p>
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

// ── Add/Edit Custom Milestone Modal ───────────────────────────────────────────
function MilestoneFormModal({ classLevel, existing, token, onClose, onSaved }: {
  classLevel: string; existing?: Milestone; token: string; onClose: () => void; onSaved: () => void;
}) {
  const [description, setDescription] = useState(existing?.description || '');
  const [domain, setDomain] = useState(existing?.domain || 'Cognitive');
  const [term, setTerm] = useState(existing?.term || '');
  const [saving, setSaving] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [error, setError] = useState('');

  const tier = getClassTier(classLevel);
  const suggestions = CLASS_SUGGESTIONS[tier]?.[domain] ?? [];
  const domainInfo = SKILL_DOMAINS.find(d => d.key === domain);

  async function formatWithOakie() {
    if (!description.trim()) return;
    setFormatting(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/ai/format-observation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: description, category: domainInfo?.label || domain, student_name: '' }),
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
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: description.trim(), term: term || null }),
        });
      } else {
        await fetch(`${API_BASE}/api/v1/teacher/milestones/custom`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
                    }`}>
                    <span>{d.icon}</span> {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Class-level suggestions */}
          {!existing && suggestions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-neutral-500 mb-2 flex items-center gap-1.5">
                <Sparkles size={11} className="text-indigo-400" />
                Suggestions for {classLevel} — {domainInfo?.label}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => setDescription(s)}
                    className={`text-xs px-2.5 py-1.5 rounded-full border transition-all text-left ${
                      description === s
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                        : 'border-neutral-200 text-neutral-600 hover:border-indigo-300 hover:bg-indigo-50'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-neutral-600">Milestone Description</label>
              <button onClick={formatWithOakie} disabled={formatting || !description.trim()}
                className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-medium transition-colors disabled:opacity-40">
                {formatting ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                Ask Oakie
              </button>
            </div>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Can write their full name independently"
              rows={3} autoFocus
              className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 resize-none" />
            <p className="text-xs text-neutral-400 mt-1">{description.length} chars</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Term <span className="text-neutral-400 font-normal">(optional)</span></label>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setTerm('')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${!term ? 'bg-neutral-800 text-white border-neutral-800' : 'bg-white border-neutral-200 text-neutral-600'}`}>
                All Terms
              </button>
              {TERMS.map(t => (
                <button key={t} onClick={() => setTerm(t)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${term === t ? 'bg-neutral-800 text-white border-neutral-800' : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400'}`}>
                  {t}
                </button>
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
  const [studentTab, setStudentTab] = useState<'observations' | 'milestones'>('observations');

  // Observations (read-only summary)
  const [observations, setObservations] = useState<Observation[]>([]);

  // Milestones
  const [milestoneData, setMilestoneData] = useState<MilestoneData | null>(null);
  const [achieveModal, setAchieveModal] = useState<Milestone | null>(null);
  const [formModal, setFormModal] = useState<{ existing?: Milestone } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [unachieving, setUnachieving] = useState<string | null>(null);

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

  // Observation summary: count per category
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
      {/* Modals */}
      {achieveModal && activeStudent && (
        <MilestoneAchieveModal milestone={achieveModal} student={activeStudent} token={token}
          onClose={() => setAchieveModal(null)}
          onSaved={() => { loadMilestones(activeStudent.id); }} />
      )}
      {formModal !== null && milestoneData && (
        <MilestoneFormModal classLevel={milestoneData.class_level} existing={formModal.existing} token={token}
          onClose={() => setFormModal(null)}
          onSaved={() => { if (activeStudent) loadMilestones(activeStudent.id); }} />
      )}

      <header className="text-white px-4 py-3 flex items-center justify-between shrink-0"
        style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 100%)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => activeStudent ? setActiveStudent(null) : router.back()} className="text-white/60 hover:text-white text-lg">←</button>
          <OakitLogo size="xs" variant="light" />
          <span className="text-sm text-white/80 font-medium">{activeStudent ? activeStudent.name : 'Students'}</span>
        </div>
        <button onClick={() => signOut().then(() => router.push('/login'))} className="text-white/50 text-xs">Sign out</button>
      </header>

      {/* Student list */}
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
          {/* Tab bar */}
          <div className="flex bg-white border-b border-neutral-200 px-4">
            {(['observations', 'milestones'] as const).map(t => (
              <button key={t} onClick={() => setStudentTab(t)}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-all capitalize ${studentTab === t ? 'border-primary-600 text-primary-700' : 'border-transparent text-neutral-400'}`}>
                {t === 'observations' ? '📝 Observations' : '🏆 Milestones'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-8">

            {/* ── OBSERVATIONS TAB (read-only summary) ── */}
            {studentTab === 'observations' && (
              <>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-100">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-neutral-800">{activeStudent.name}</p>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      coveredCategories === 0 ? 'bg-red-100 text-red-600' :
                      coveredCategories < CATEGORY_CONFIG.length / 2 ? 'bg-amber-100 text-amber-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {coveredCategories}/{CATEGORY_CONFIG.length} categories
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">Observation summary — add observations from the Child Journey page</p>
                </div>

                {/* Read-only category grid */}
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORY_CONFIG.map(cat => {
                    const count = obsByCategory[cat.id] || 0;
                    return (
                      <div key={cat.id}
                        className={`flex items-center gap-2.5 px-3 py-3 rounded-2xl border-2 ${count > 0 ? `${cat.bg} ${cat.border}` : 'bg-white border-neutral-100'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-base ${count > 0 ? cat.bg : 'bg-neutral-100'}`}>
                          {cat.icon}
                        </div>
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

                {/* Observation history */}
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
                          <p className="text-xs text-neutral-400">{obs.obs_date} · {obs.teacher_name} {obs.share_with_parent ? '· 👁 Shared with parent' : ''}</p>
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
                {/* Progress header */}
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

                {/* Add custom milestone button */}
                <button onClick={() => setFormModal({})}
                  className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-indigo-200 rounded-2xl text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors">
                  <Plus size={16} /> Add Custom Milestone
                </button>

                {/* Milestones grouped by domain */}
                {Object.entries(groupedMilestones).map(([domain, items]) => (
                  <div key={domain} className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
                    <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-100">
                      <p className="text-sm font-semibold text-neutral-700">{DOMAIN_ICONS[domain] ?? '📌'} {domain}</p>
                    </div>
                    {items.map(m => {
                      const isAchieved = !!m.achieved_at;
                      const isUnachieving = unachieving === m.id;
                      const isDeleting = deletingId === m.id;
                      return (
                        <div key={m.id} className={`flex items-start gap-3 px-4 py-3 border-b border-neutral-50 last:border-0 transition-colors ${isAchieved ? 'bg-emerald-50/40' : ''}`}>
                          {/* Checkbox */}
                          <button
                            onClick={() => isAchieved ? unachieveMilestone(m.id) : setAchieveModal(m)}
                            disabled={isUnachieving}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${isAchieved ? 'bg-emerald-500 border-emerald-500' : 'border-neutral-300 hover:border-emerald-400'}`}>
                            {isUnachieving ? <Loader2 size={12} className="animate-spin text-neutral-400" /> :
                              isAchieved ? <span className="text-white text-xs">✓</span> : null}
                          </button>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${isAchieved ? 'text-emerald-700' : 'text-neutral-700'}`}>{m.description}</p>
                            {m.term && <span className="text-[10px] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-full mt-0.5 inline-block">{m.term}</span>}
                            {isAchieved && (
                              <div className="mt-1">
                                <p className="text-xs text-emerald-600">✓ Achieved {m.achieved_at} by {m.achieved_by || 'teacher'}</p>
                                {m.achievement_comment && (
                                  <p className="text-xs text-neutral-500 mt-0.5 italic">"{m.achievement_comment}"</p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Actions for custom milestones */}
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
