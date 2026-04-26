'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from '@/lib/api';
import { getToken } from '@/lib/auth';
import {
  ChevronLeft, FileText, CalendarDays, CheckCircle2, XCircle,
  Plus, Download, Users, Loader2, Settings, Archive,
  LogOut, Sparkles, Eye, Edit2, Trash2, Send, AlertCircle,
} from 'lucide-react';

// ── Interfaces ──────────────────────────────────────────────────────────────
interface StaffUser { id: string; name: string; email: string; mobile: string; role_name: string; }
interface Template { id: string; name: string; body: string; created_at: string; }
interface OfferLetter {
  id: string; staff_name: string; staff_email: string; role: string;
  start_date: string; gross_salary: number;
  components: { name: string; amount: number }[];
  employment_terms: string | null; pdf_url: string | null; preview_pdf_url: string | null;
  status: 'pending' | 'signed' | 'declined'; signed_at: string | null;
  created_by_name: string | null; created_at: string;
}
interface LeaveRequest {
  id: string; staff_name: string; staff_email: string;
  leave_type: string; from_date: string; to_date: string; days: number;
  reason: string | null; status: 'pending' | 'approved' | 'rejected';
  review_note: string | null; reviewed_at: string | null; created_at: string;
}
interface EmploymentRecord {
  id: string; event_type: string; event_date: string; last_working_day?: string;
  notice_period_days?: number; resignation_reason?: string; resignation_status?: string;
  termination_reason?: string; notes?: string; created_at: string;
  staff_name?: string; staff_email?: string;
}
interface HRSettings { default_notice_period: number; }
interface SignedCopy {
  id: string; staff_name: string; role: string; signed_at: string; signed_pdf_url: string | null;
}

type Tab = 'leaves' | 'offers' | 'templates' | 'signed' | 'resignations' | 'settings';

// ── Helpers ──────────────────────────────────────────────────────────────────
const statusBadge = (status: string) => {
  if (status === 'approved' || status === 'signed' || status === 'acknowledged') return 'bg-emerald-100 text-emerald-700';
  if (status === 'rejected' || status === 'declined') return 'bg-red-100 text-red-600';
  return 'bg-amber-100 text-amber-700';
};

const detectVariables = (text: string): string[] => {
  const matches: string[] = [];
  const re = /\{\{([^}]+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (!matches.includes(m[1])) matches.push(m[1]);
  }
  return matches;
};

// ── Main Page ────────────────────────────────────────────────────────────────
export default function PrincipalHRPage() {
  const router = useRouter();
  const token = getToken() || '';
  const [tab, setTab] = useState<Tab>('leaves');

  // ── Data ──
  const [offers, setOffers] = useState<OfferLetter[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [signedCopies, setSignedCopies] = useState<SignedCopy[]>([]);
  const [resignations, setResignations] = useState<EmploymentRecord[]>([]);
  const [hrSettings, setHrSettings] = useState<HRSettings>({ default_notice_period: 30 });
  const [loading, setLoading] = useState(true);

  // ── Leave review ──
  const [reviewing, setReviewing] = useState<string | null>(null);

  // ── Offer form ──
  const [offerStep, setOfferStep] = useState<'form' | 'preview' | 'sent'>('form');
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [offerForm, setOfferForm] = useState({
    user_id: '', role: '', start_date: '', gross_salary: '',
    employment_terms: 'This offer is subject to satisfactory completion of background verification. Standard school policies apply.',
    template_id: '',
    components: [{ name: 'Basic', amount: '' }, { name: 'HRA', amount: '' }, { name: 'Other Allowances', amount: '' }],
  });
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState('');
  const [creatingOffer, setCreatingOffer] = useState(false);
  const [offerMsg, setOfferMsg] = useState('');
  const [askingOakieOffer, setAskingOakieOffer] = useState(false);

  // ── Template form ──
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: '', body: '' });
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateMsg, setTemplateMsg] = useState('');
  const [deletingTemplate, setDeletingTemplate] = useState<string | null>(null);
  const [askingOakieTpl, setAskingOakieTpl] = useState(false);

  // ── Signed copies filter ──
  const [signedFilterName, setSignedFilterName] = useState('');
  const [signedFilterRole, setSignedFilterRole] = useState('');

  // ── Resignations ──
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  // ── Settings ──
  const [settingsForm, setSettingsForm] = useState({ default_notice_period: 30 });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  // ── Termination modal ──
  const [terminateTarget, setTerminateTarget] = useState<StaffUser | null>(null);
  const [terminateReason, setTerminateReason] = useState('');
  const [terminating, setTerminating] = useState(false);
  const [terminateMsg, setTerminateMsg] = useState('');

  // ── Employment history ──
  const [historyTarget, setHistoryTarget] = useState<StaffUser | null>(null);
  const [historyRecords, setHistoryRecords] = useState<EmploymentRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  async function openHistory(s: StaffUser) {
    setHistoryTarget(s);
    setLoadingHistory(true);
    try {
      const records = await apiGet<EmploymentRecord[]>(`/api/v1/principal/hr/staff/${s.id}/employment-history`, token);
      setHistoryRecords(records);
    } catch { setHistoryRecords([]); }
    finally { setLoadingHistory(false); }
  }

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    Promise.all([
      apiGet<OfferLetter[]>('/api/v1/principal/hr/offer-letters', token).then(setOffers).catch(() => {}),
      apiGet<LeaveRequest[]>('/api/v1/staff/hr/leaves', token).then(setLeaves).catch(() => {}),
      apiGet<StaffUser[]>('/api/v1/principal/hr/staff', token).then(setStaff).catch(() => {}),
      apiGet<Template[]>('/api/v1/principal/hr/templates', token).then(setTemplates).catch(() => {}),
      apiGet<SignedCopy[]>('/api/v1/principal/hr/offer-letters/signed', token).then(setSignedCopies).catch(() => {}),
      apiGet<EmploymentRecord[]>('/api/v1/principal/hr/resignations', token).then(setResignations).catch(() => {}),
      apiGet<HRSettings>('/api/v1/principal/hr/settings', token).then(s => {
        setHrSettings(s);
        setSettingsForm({ default_notice_period: s.default_notice_period });
      }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  // ── Derived ──
  const pendingLeaves = leaves.filter(l => l.status === 'pending');
  const detectedVars = detectVariables(offerForm.employment_terms);
  const filteredSigned = signedCopies.filter(s =>
    (!signedFilterName || s.staff_name.toLowerCase().includes(signedFilterName.toLowerCase())) &&
    (!signedFilterRole || s.role.toLowerCase().includes(signedFilterRole.toLowerCase()))
  );

  // ── Leave review ──
  async function reviewLeave(id: string, status: 'approved' | 'rejected') {
    setReviewing(id);
    try {
      const updated = await apiPatch<LeaveRequest>(`/api/v1/staff/hr/leaves/${id}`, { status, review_note: null }, token);
      setLeaves(prev => prev.map(l => l.id === id ? updated : l));
    } catch { /* ignore */ } finally { setReviewing(null); }
  }

  // ── Template select → pre-fill terms ──
  function onTemplateSelect(templateId: string) {
    setOfferForm(f => ({ ...f, template_id: templateId }));
    if (templateId) {
      const tpl = templates.find(t => t.id === templateId);
      if (tpl) setOfferForm(f => ({ ...f, employment_terms: tpl.body }));
    }
  }

  // ── Ask Oakie (offer) ──
  async function askOakieOffer() {
    setAskingOakieOffer(true);
    try {
      const res = await apiPost<{ terms: string }>('/api/v1/ai/hr-terms', {
        school_name: '',
        designation: offerForm.role,
        salary: offerForm.gross_salary,
        context: '',
      }, token);
      setOfferForm(f => ({ ...f, employment_terms: res.terms }));
    } catch (e: any) {
      if (e.message?.includes('503') || e.message?.includes('unavailable')) {
        setOfferMsg('Oakie is unavailable right now. Please try again later.');
      }
    } finally { setAskingOakieOffer(false); }
  }

  // ── Preview offer ──
  async function previewOffer() {
    setCreatingOffer(true); setOfferMsg('');
    try {
      const components = offerForm.components.filter(c => c.name && c.amount).map(c => ({ name: c.name, amount: parseFloat(c.amount) }));
      const res = await apiPost<{ preview_pdf_url: string }>('/api/v1/principal/hr/offer-letters/preview', {
        user_id: offerForm.user_id,
        role: offerForm.role,
        start_date: offerForm.start_date,
        gross_salary: parseFloat(offerForm.gross_salary),
        components,
        employment_terms: offerForm.employment_terms,
        template_id: offerForm.template_id || undefined,
      }, token);
      setPreviewUrl(res.preview_pdf_url);
      setOfferStep('preview');
    } catch (e: any) { setOfferMsg(e.message || 'Preview failed'); }
    finally { setCreatingOffer(false); }
  }

  // ── Approve & Send ──
  async function approveAndSend() {
    setCreatingOffer(true); setOfferMsg('');
    try {
      const components = offerForm.components.filter(c => c.name && c.amount).map(c => ({ name: c.name, amount: parseFloat(c.amount) }));
      const newOffer = await apiPost<OfferLetter>('/api/v1/principal/hr/offer-letters', {
        user_id: offerForm.user_id,
        role: offerForm.role,
        start_date: offerForm.start_date,
        gross_salary: parseFloat(offerForm.gross_salary),
        components,
        employment_terms: offerForm.employment_terms,
        template_id: offerForm.template_id || undefined,
      }, token);
      setOffers(prev => [newOffer, ...prev]);
      setOfferMsg('Offer letter sent successfully.');
      setOfferStep('sent');
      setShowOfferForm(false);
    } catch (e: any) { setOfferMsg(e.message || 'Failed to send offer letter'); }
    finally { setCreatingOffer(false); }
  }

  // ── Template CRUD ──
  function openNewTemplate() {
    setEditingTemplate(null);
    setTemplateForm({ name: '', body: '' });
    setTemplateMsg('');
    setShowTemplateForm(true);
  }

  function openEditTemplate(t: Template) {
    setEditingTemplate(t);
    setTemplateForm({ name: t.name, body: t.body });
    setTemplateMsg('');
    setShowTemplateForm(true);
  }

  async function saveTemplate() {
    if (!templateForm.name || !templateForm.body) return;
    setSavingTemplate(true); setTemplateMsg('');
    try {
      if (editingTemplate) {
        const updated = await apiPut<Template>(`/api/v1/principal/hr/templates/${editingTemplate.id}`, templateForm, token);
        setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? updated : t));
      } else {
        const created = await apiPost<Template>('/api/v1/principal/hr/templates', templateForm, token);
        setTemplates(prev => [created, ...prev]);
      }
      setShowTemplateForm(false);
      setTemplateMsg('Template saved.');
    } catch (e: any) { setTemplateMsg(e.message || 'Failed to save template'); }
    finally { setSavingTemplate(false); }
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Delete this template?')) return;
    setDeletingTemplate(id);
    try {
      await apiDelete(`/api/v1/principal/hr/templates/${id}`, token);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch { /* ignore */ } finally { setDeletingTemplate(null); }
  }

  async function askOakieTemplate() {
    setAskingOakieTpl(true);
    try {
      const res = await apiPost<{ terms: string }>('/api/v1/ai/hr-terms', {
        school_name: '',
        designation: templateForm.name,
        salary: '',
        context: '',
      }, token);
      setTemplateForm(f => ({ ...f, body: res.terms }));
    } catch (e: any) {
      if (e.message?.includes('503') || e.message?.includes('unavailable')) {
        setTemplateMsg('Oakie is unavailable right now.');
      }
    } finally { setAskingOakieTpl(false); }
  }

  // ── Acknowledge resignation ──
  async function acknowledgeResignation(id: string) {
    setAcknowledgingId(id);
    try {
      const updated = await apiPatch<EmploymentRecord>(`/api/v1/principal/hr/resignations/${id}/acknowledge`, {}, token);
      setResignations(prev => prev.map(r => r.id === id ? updated : r));
    } catch { /* ignore */ } finally { setAcknowledgingId(null); }
  }

  // ── Save settings ──
  async function saveSettings() {
    setSavingSettings(true); setSettingsMsg('');
    try {
      const updated = await apiPut<HRSettings>('/api/v1/principal/hr/settings', settingsForm, token);
      setHrSettings(updated);
      setSettingsMsg('Settings saved.');
    } catch (e: any) { setSettingsMsg(e.message || 'Failed to save settings'); }
    finally { setSavingSettings(false); }
  }

  // ── Terminate staff ──
  async function terminateStaff() {
    if (!terminateTarget || !terminateReason.trim()) return;
    setTerminating(true); setTerminateMsg('');
    try {
      await apiPost(`/api/v1/principal/hr/staff/${terminateTarget.id}/terminate`, { reason: terminateReason }, token);
      setStaff(prev => prev.filter(s => s.id !== terminateTarget.id));
      setTerminateTarget(null);
      setTerminateReason('');
    } catch (e: any) {
      if (e.message?.includes('409') || e.message?.toLowerCase().includes('inactive')) {
        setTerminateMsg('This staff member is already inactive.');
      } else {
        setTerminateMsg(e.message || 'Failed to terminate staff member');
      }
    } finally { setTerminating(false); }
  }

  // ── Tabs config ──
  const TABS: { id: Tab; label: string; Icon: any; badge?: number }[] = [
    { id: 'leaves',       label: 'Leave Requests', Icon: CalendarDays,  badge: pendingLeaves.length },
    { id: 'offers',       label: 'Offer Letters',  Icon: FileText },
    { id: 'templates',    label: 'Templates',      Icon: Archive },
    { id: 'signed',       label: 'Signed Copies',  Icon: CheckCircle2 },
    { id: 'resignations', label: 'Resignations',   Icon: LogOut },
    { id: 'settings',     label: 'Settings',       Icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Header */}
      <header className="text-white px-4 py-3 flex items-center gap-3 shrink-0"
        style={{ background: 'linear-gradient(135deg, #0a1f14 0%, #1a3c2e 100%)' }}>
        <button onClick={() => router.back()} className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <p className="text-sm font-bold">Staff HR</p>
          <p className="text-xs text-white/70">Offer Letters · Leave · Templates · Settings</p>
        </div>
        {pendingLeaves.length > 0 && (
          <span className="bg-amber-400 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-full">
            {pendingLeaves.length} pending
          </span>
        )}
      </header>

      {/* Tabs */}
      <div className="flex bg-white border-b border-neutral-100 px-2 pt-3 gap-0.5 overflow-x-auto">
        {TABS.map(({ id, label, Icon, badge }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-xs font-semibold border-b-2 transition-all whitespace-nowrap relative shrink-0 ${
              tab === id ? 'border-primary-600 text-primary-700 bg-primary-50' : 'border-transparent text-neutral-400 hover:text-neutral-600'
            }`}>
            <Icon className="w-3.5 h-3.5" /> {label}
            {badge != null && badge > 0 && (
              <span className="ml-1 bg-amber-400 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 p-4 space-y-3 max-w-2xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-neutral-300" />
          </div>
        ) : (
          <>

            {/* ══ LEAVE REQUESTS ══════════════════════════════════════════════ */}
            {tab === 'leaves' && (
              leaves.length === 0 ? (
                <div className="text-center py-16">
                  <CalendarDays className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
                  <p className="text-sm text-neutral-400">No leave requests yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {leaves.map(l => (
                    <div key={l.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${l.status === 'pending' ? 'border-amber-200' : 'border-neutral-100'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-bold text-neutral-800">{l.staff_name}</p>
                          <p className="text-xs text-neutral-400 capitalize">{l.leave_type} leave · {l.days} day{l.days !== 1 ? 's' : ''}</p>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            {new Date(l.from_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} –{' '}
                            {new Date(l.to_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                          {l.reason && <p className="text-xs text-neutral-400 mt-1 italic">"{l.reason}"</p>}
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${statusBadge(l.status)}`}>
                          {l.status}
                        </span>
                      </div>
                      {l.status === 'pending' && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-neutral-100">
                          <button onClick={() => reviewLeave(l.id, 'approved')} disabled={reviewing === l.id}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50">
                            {reviewing === l.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            Approve
                          </button>
                          <button onClick={() => reviewLeave(l.id, 'rejected')} disabled={reviewing === l.id}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-red-200 text-red-600 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors disabled:opacity-50">
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {/* ══ OFFER LETTERS ═══════════════════════════════════════════════ */}
            {tab === 'offers' && (
              <>
                {/* Staff list with Terminate */}
                {staff.length > 0 && (
                  <div className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm">
                    <p className="text-xs font-bold text-neutral-600 mb-3 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Active Staff</p>
                    <div className="space-y-2">
                      {staff.map(s => (
                        <div key={s.id} className="flex items-center justify-between py-1.5">
                          <div>
                            <p className="text-sm font-semibold text-neutral-800">{s.name}</p>
                            <p className="text-xs text-neutral-400 capitalize">{s.role_name}</p>
                          </div>
                          <div className="flex gap-1.5">
                            <button onClick={() => openHistory(s)}
                              className="text-xs px-2.5 py-1.5 border border-neutral-200 text-neutral-600 rounded-xl hover:bg-neutral-50 transition-colors font-medium">
                              History
                            </button>
                            <button onClick={() => { setTerminateTarget(s); setTerminateReason(''); setTerminateMsg(''); }}
                              className="text-xs px-2.5 py-1.5 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-colors font-medium">
                              Terminate
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={() => { setShowOfferForm(v => !v); setOfferStep('form'); setOfferMsg(''); }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl text-sm font-bold transition-colors">
                  <Plus className="w-4 h-4" /> Create Offer Letter
                </button>

                {showOfferForm && offerStep === 'form' && (
                  <div className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm space-y-3">
                    <p className="text-sm font-bold text-neutral-800">New Offer Letter</p>

                    {/* Staff selector */}
                    <div>
                      <label className="text-xs font-medium text-neutral-600 mb-1 block">Staff Member</label>
                      <select value={offerForm.user_id} onChange={e => setOfferForm(f => ({ ...f, user_id: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/30">
                        <option value="">Select staff…</option>
                        {staff.length === 0 && <option disabled>No active staff found</option>}
                        {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role_name})</option>)}
                      </select>
                    </div>

                    {/* Template selector */}
                    <div>
                      <label className="text-xs font-medium text-neutral-600 mb-1 block">Template (optional)</label>
                      <select value={offerForm.template_id} onChange={e => onTemplateSelect(e.target.value)}
                        className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/30">
                        <option value="">No template</option>
                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-neutral-600 mb-1 block">Role / Designation</label>
                        <input value={offerForm.role} onChange={e => setOfferForm(f => ({ ...f, role: e.target.value }))}
                          placeholder="e.g. Class Teacher"
                          className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-neutral-600 mb-1 block">Start Date</label>
                        <input type="date" value={offerForm.start_date} onChange={e => setOfferForm(f => ({ ...f, start_date: e.target.value }))}
                          className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-neutral-600 mb-1 block">Gross Salary (₹/month)</label>
                      <input type="number" value={offerForm.gross_salary} onChange={e => setOfferForm(f => ({ ...f, gross_salary: e.target.value }))}
                        placeholder="0"
                        className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-neutral-600 mb-2 block">Salary Components</label>
                      {offerForm.components.map((c, i) => (
                        <div key={i} className="flex gap-2 mb-2">
                          <input value={c.name}
                            onChange={e => setOfferForm(f => ({ ...f, components: f.components.map((x, j) => j === i ? { ...x, name: e.target.value } : x) }))}
                            placeholder="Component name"
                            className="flex-1 px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                          <input type="number" value={c.amount}
                            onChange={e => setOfferForm(f => ({ ...f, components: f.components.map((x, j) => j === i ? { ...x, amount: e.target.value } : x) }))}
                            placeholder="₹"
                            className="w-24 px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                        </div>
                      ))}
                    </div>

                    {/* Employment terms + Ask Oakie */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-neutral-600">Employment Terms</label>
                        <button onClick={askOakieOffer} disabled={askingOakieOffer}
                          className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50">
                          {askingOakieOffer ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                          Ask Oakie
                        </button>
                      </div>
                      <textarea value={offerForm.employment_terms}
                        onChange={e => setOfferForm(f => ({ ...f, employment_terms: e.target.value }))}
                        rows={4} className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                    </div>

                    {/* Variable substitution inputs */}
                    {detectedVars.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                        <p className="text-xs font-semibold text-amber-700">Fill in template variables</p>
                        {detectedVars.map(v => (
                          <div key={v}>
                            <label className="text-xs font-medium text-neutral-600 mb-1 block">{v}</label>
                            <input value={varValues[v] || ''} onChange={e => setVarValues(prev => ({ ...prev, [v]: e.target.value }))}
                              placeholder={`Value for {{${v}}}`}
                              className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                          </div>
                        ))}
                      </div>
                    )}

                    {offerMsg && <p className={`text-xs font-medium ${offerMsg.includes('sent') || offerMsg.includes('success') ? 'text-emerald-600' : 'text-red-500'}`}>{offerMsg}</p>}

                    <button onClick={previewOffer}
                      disabled={creatingOffer || !offerForm.user_id || !offerForm.role || !offerForm.start_date || !offerForm.gross_salary || detectedVars.some(v => !varValues[v])}
                      className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                      {creatingOffer ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                      Preview
                    </button>
                  </div>
                )}

                {/* Preview step */}
                {showOfferForm && offerStep === 'preview' && (
                  <div className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm space-y-3">
                    <p className="text-sm font-bold text-neutral-800">Preview Offer Letter</p>
                    {previewUrl && (
                      <iframe src={previewUrl} className="w-full h-96 rounded-xl border" />
                    )}
                    {offerMsg && <p className="text-xs text-red-500 font-medium">{offerMsg}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => setOfferStep('form')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-neutral-200 text-neutral-600 rounded-xl text-sm font-bold hover:bg-neutral-50 transition-colors">
                        <Edit2 className="w-4 h-4" /> Edit
                      </button>
                      <button onClick={approveAndSend} disabled={creatingOffer}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
                        {creatingOffer ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Approve & Send
                      </button>
                    </div>
                  </div>
                )}

                {offerMsg && !showOfferForm && (
                  <p className="text-xs text-emerald-600 font-medium text-center">{offerMsg}</p>
                )}

                {/* Offer list */}
                {offers.length === 0 ? (
                  <div className="text-center py-10">
                    <FileText className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
                    <p className="text-sm text-neutral-400">No offer letters created yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {offers.map(o => (
                      <div key={o.id} className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-bold text-neutral-800">{o.staff_name}</p>
                            <p className="text-xs text-neutral-500">{o.role} · ₹{o.gross_salary.toLocaleString('en-IN')}/mo</p>
                            <p className="text-xs text-neutral-400 mt-0.5">
                              From {new Date(o.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadge(o.status)}`}>{o.status}</span>
                            {o.pdf_url && (
                              <a href={o.pdf_url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600">
                                <Download className="w-3 h-3" /> PDF
                              </a>
                            )}
                          </div>
                        </div>
                        {o.status === 'signed' && o.signed_at && (
                          <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Signed {new Date(o.signed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ══ TEMPLATES ═══════════════════════════════════════════════════ */}
            {tab === 'templates' && (
              <>
                <button onClick={openNewTemplate}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl text-sm font-bold transition-colors">
                  <Plus className="w-4 h-4" /> New Template
                </button>

                {showTemplateForm && (
                  <div className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm space-y-3">
                    <p className="text-sm font-bold text-neutral-800">{editingTemplate ? 'Edit Template' : 'New Template'}</p>
                    <div>
                      <label className="text-xs font-medium text-neutral-600 mb-1 block">Template Name</label>
                      <input value={templateForm.name} onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. Standard Teacher Offer"
                        className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-neutral-600">Body</label>
                        <button onClick={askOakieTemplate} disabled={askingOakieTpl}
                          className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50">
                          {askingOakieTpl ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                          Ask Oakie
                        </button>
                      </div>
                      <textarea value={templateForm.body} onChange={e => setTemplateForm(f => ({ ...f, body: e.target.value }))}
                        rows={6} placeholder="Use {{variable}} for dynamic fields…"
                        className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                    </div>
                    {templateMsg && <p className={`text-xs font-medium ${templateMsg.includes('saved') ? 'text-emerald-600' : 'text-red-500'}`}>{templateMsg}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => setShowTemplateForm(false)}
                        className="flex-1 py-2.5 border border-neutral-200 text-neutral-600 rounded-xl text-sm font-bold hover:bg-neutral-50 transition-colors">
                        Cancel
                      </button>
                      <button onClick={saveTemplate} disabled={savingTemplate || !templateForm.name || !templateForm.body}
                        className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {savingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Save
                      </button>
                    </div>
                  </div>
                )}

                {templates.length === 0 ? (
                  <div className="text-center py-10">
                    <Archive className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
                    <p className="text-sm text-neutral-400">No templates yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {templates.map(t => (
                      <div key={t.id} className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0 mr-3">
                            <p className="text-sm font-bold text-neutral-800">{t.name}</p>
                            <p className="text-xs text-neutral-400 mt-0.5 line-clamp-2">{t.body}</p>
                            <p className="text-xs text-neutral-300 mt-1">
                              {new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <button onClick={() => openEditTemplate(t)}
                              className="p-2 border border-neutral-200 rounded-xl text-neutral-500 hover:bg-neutral-50 transition-colors">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => deleteTemplate(t.id)} disabled={deletingTemplate === t.id}
                              className="p-2 border border-red-200 rounded-xl text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
                              {deletingTemplate === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ══ SIGNED COPIES ═══════════════════════════════════════════════ */}
            {tab === 'signed' && (
              <>
                <div className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm">
                  <p className="text-xs font-bold text-neutral-600 mb-3">Filter</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-neutral-600 mb-1 block">Name</label>
                      <input value={signedFilterName} onChange={e => setSignedFilterName(e.target.value)}
                        placeholder="Search name…"
                        className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-neutral-600 mb-1 block">Role</label>
                      <input value={signedFilterRole} onChange={e => setSignedFilterRole(e.target.value)}
                        placeholder="Search role…"
                        className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                    </div>
                  </div>
                </div>

                {filteredSigned.length === 0 ? (
                  <div className="text-center py-10">
                    <CheckCircle2 className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
                    <p className="text-sm text-neutral-400">No signed copies found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredSigned.map(s => (
                      <div key={s.id} className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-bold text-neutral-800">{s.staff_name}</p>
                            <p className="text-xs text-neutral-500">{s.role}</p>
                            <p className="text-xs text-neutral-400 mt-0.5">
                              Signed {new Date(s.signed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                          {s.signed_pdf_url && (
                            <a href={s.signed_pdf_url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-2 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors">
                              <Download className="w-3.5 h-3.5" /> Download
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ══ RESIGNATIONS ════════════════════════════════════════════════ */}
            {tab === 'resignations' && (
              resignations.length === 0 ? (
                <div className="text-center py-16">
                  <LogOut className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
                  <p className="text-sm text-neutral-400">No resignations submitted</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {resignations.map(r => (
                    <div key={r.id} className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-bold text-neutral-800">{r.staff_name || r.staff_email}</p>
                          {r.last_working_day && (
                            <p className="text-xs text-neutral-500 mt-0.5">
                              Last day: {new Date(r.last_working_day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          )}
                          {r.notice_period_days != null && (
                            <p className="text-xs text-neutral-400">Notice: {r.notice_period_days} days</p>
                          )}
                          {r.resignation_reason && (
                            <p className="text-xs text-neutral-400 mt-1 italic">"{r.resignation_reason}"</p>
                          )}
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${statusBadge(r.resignation_status || 'pending')}`}>
                          {r.resignation_status || 'pending'}
                        </span>
                      </div>
                      {r.resignation_status === 'pending' && (
                        <button onClick={() => acknowledgeResignation(r.id)} disabled={acknowledgingId === r.id}
                          className="w-full flex items-center justify-center gap-1.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 mt-2">
                          {acknowledgingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          Acknowledge
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {/* ══ SETTINGS ════════════════════════════════════════════════════ */}
            {tab === 'settings' && (
              <div className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm space-y-4">
                <p className="text-sm font-bold text-neutral-800">HR Settings</p>
                <div>
                  <label className="text-xs font-medium text-neutral-600 mb-1 block">Default Notice Period (days)</label>
                  <input type="number" min={1} value={settingsForm.default_notice_period}
                    onChange={e => setSettingsForm({ default_notice_period: parseInt(e.target.value) || 30 })}
                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                </div>
                {settingsMsg && (
                  <p className={`text-xs font-medium ${settingsMsg.includes('saved') ? 'text-emerald-600' : 'text-red-500'}`}>{settingsMsg}</p>
                )}
                <button onClick={saveSettings} disabled={savingSettings}
                  className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save Settings
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ══ EMPLOYMENT HISTORY MODAL ════════════════════════════════════ */}
      {historyTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-neutral-800">Employment History — {historyTarget.name}</p>
              <button onClick={() => setHistoryTarget(null)} className="text-neutral-400 hover:text-neutral-600 text-lg">×</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {loadingHistory ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-neutral-300" /></div>
              ) : historyRecords.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-8">No employment records found</p>
              ) : (
                historyRecords.map(r => (
                  <div key={r.id} className="border border-neutral-100 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        r.event_type === 'offer_sent' ? 'bg-blue-100 text-blue-700' :
                        r.event_type === 'offer_signed' ? 'bg-emerald-100 text-emerald-700' :
                        r.event_type === 'resignation' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>{r.event_type.replace('_', ' ')}</span>
                      <p className="text-xs text-neutral-400">{new Date(r.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    {r.resignation_reason && <p className="text-xs text-neutral-500 mt-1">Reason: {r.resignation_reason}</p>}
                    {r.termination_reason && <p className="text-xs text-neutral-500 mt-1">Reason: {r.termination_reason}</p>}
                    {r.notice_period_days != null && <p className="text-xs text-neutral-400">Notice: {r.notice_period_days} days</p>}
                    {r.notes && <p className="text-xs text-neutral-400 mt-1">{r.notes}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ TERMINATION MODAL ═══════════════════════════════════════════════ */}
      {terminateTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
            <p className="text-sm font-bold text-neutral-800">Terminate {terminateTarget.name}?</p>
            <p className="text-xs text-neutral-500">This will deactivate the staff member and record a termination event.</p>
            <div>
              <label className="text-xs font-medium text-neutral-600 mb-1 block">Reason</label>
              <textarea value={terminateReason} onChange={e => setTerminateReason(e.target.value)}
                rows={3} placeholder="Reason for termination…"
                className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
            </div>
            {terminateMsg && <p className="text-xs text-red-500 font-medium">{terminateMsg}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setTerminateTarget(null); setTerminateReason(''); setTerminateMsg(''); }}
                className="flex-1 py-2.5 border border-neutral-200 text-neutral-600 rounded-xl text-sm font-bold hover:bg-neutral-50 transition-colors">
                Cancel
              </button>
              <button onClick={terminateStaff} disabled={terminating || !terminateReason.trim()}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {terminating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Confirm Terminate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
