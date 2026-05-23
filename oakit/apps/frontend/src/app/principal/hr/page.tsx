'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost, apiPatch, apiPut, apiDelete, API_BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';
import {
  ChevronLeft, FileText, CalendarDays, CheckCircle2, XCircle,
  Plus, Download, Users, Loader2, Settings, Archive,
  LogOut, Sparkles, Eye, Edit2, Trash2, Send, AlertCircle,
} from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';

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
interface HRSettings { default_notice_period: number; letterhead_url?: string | null; principal_signature_url?: string | null; principal_designation?: string | null; }
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

/**
 * Build a map of variable values we already know from the offer form.
 * Keys are normalised to lowercase for matching, but we match case-insensitively.
 */
function buildKnownVarValues(
  offerForm: { user_id: string; role: string; start_date: string; gross_salary: string; components: { name: string; amount: string }[] },
  staff: { id: string; name: string }[],
  hrSettings: { default_notice_period: number },
  schoolName: string,
): Record<string, string> {
  const staffMember = staff.find(s => s.id === offerForm.user_id);
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const startDateFormatted = offerForm.start_date
    ? new Date(offerForm.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  // Number to words helper (up to crores)
  function toWords(n: number): string {
    if (!n || isNaN(n) || n <= 0) return '';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + toWords(n % 100) : '');
    if (n < 100000) return toWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + toWords(n % 1000) : '');
    if (n < 10000000) return toWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + toWords(n % 100000) : '');
    return toWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + toWords(n % 10000000) : '');
  }

  // Parse gross_salary — must be a positive number
  const rawSalary = parseFloat(offerForm.gross_salary);
  const salary = !isNaN(rawSalary) && rawSalary > 0 ? rawSalary : 0;
  const salaryFormatted = salary > 0 ? `₹${salary.toLocaleString('en-IN')}` : '';
  const salaryWords = salary > 0 ? toWords(Math.round(salary)) + ' Rupees Only' : '';

  // Build map — keys cover common template variable names (case-insensitive matching done at use site)
  return {
    // Staff / personal
    'name': staffMember?.name || '',
    'teacher name': staffMember?.name || '',
    'staff name': staffMember?.name || '',
    'employee name': staffMember?.name || '',
    // Role
    'designation': offerForm.role,
    'role': offerForm.role,
    'position': offerForm.role,
    // Dates
    'date': today,
    'today': today,
    'joining date': startDateFormatted,
    'starting date': startDateFormatted,
    'start date': startDateFormatted,
    'joining_date': startDateFormatted,
    'start_date': startDateFormatted,
    // Salary — always from gross_salary field
    'salary': salaryFormatted,
    'gross salary': salaryFormatted,
    'ctc': salaryFormatted,
    'monthly salary': salaryFormatted,
    'salary in words': salaryWords,
    'salary_in_words': salaryWords,
    // Notice / probation
    'notice period': `${hrSettings.default_notice_period} days`,
    'notice_period': `${hrSettings.default_notice_period} days`,
    'probation period': '3 months',
    'probation_period': '3 months',
    // School
    'school name': schoolName,
    'school_name': schoolName,
  };
}

// ── ResignationCard — inline component with override date ───────────────────
function ResignationCard({ r, acknowledgingId, onAcknowledge }: {
  r: EmploymentRecord;
  acknowledgingId: string | null;
  onAcknowledge: (id: string, lastWorkingDayOverride?: string) => void;
}) {
  const [overrideDate, setOverrideDate] = useState('');
  const [showOverride, setShowOverride] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-sm font-bold text-neutral-800">{r.staff_name || r.staff_email}</p>
          {r.last_working_day && (
            <p className="text-xs text-neutral-500 mt-0.5">
              Last day: <span className="font-semibold">{new Date(r.last_working_day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </p>
          )}
          {r.notice_period_days != null && (
            <p className="text-xs text-neutral-400">Notice: {r.notice_period_days} days</p>
          )}
          {(r as any).requested_last_working_day && (
            <p className="text-xs text-amber-600 mt-0.5">
              Staff requested: {new Date((r as any).requested_last_working_day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
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
        <div className="mt-2 space-y-2">
          <button
            onClick={() => setShowOverride(v => !v)}
            className="text-xs text-neutral-500 hover:text-neutral-700 underline">
            {showOverride ? 'Cancel override' : 'Change last working day'}
          </button>
          {showOverride && (
            <div>
              <label className="text-xs font-medium text-neutral-600 mb-1 block">Override Last Working Day</label>
              <input type="date" value={overrideDate} onChange={e => setOverrideDate(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
            </div>
          )}
          <button onClick={() => onAcknowledge(r.id, overrideDate || undefined)} disabled={acknowledgingId === r.id}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50">
            {acknowledgingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Acknowledge
          </button>
        </div>
      )}
    </div>
  );
}

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
  const [schoolName, setSchoolName] = useState('');
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
  const [uploadingLetterhead, setUploadingLetterhead] = useState(false);
  const [letterheadMsg, setLetterheadMsg] = useState('');
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [signatureMsg, setSignatureMsg] = useState('');
  const [signatureDesignation, setSignatureDesignation] = useState('');

  // ── Termination modal ──
  const [terminateTarget, setTerminateTarget] = useState<StaffUser | null>(null);
  const [terminateReason, setTerminateReason] = useState('');
  const [terminating, setTerminating] = useState(false);
  const [terminateMsg, setTerminateMsg] = useState('');

  // ── Employment history ──
  const [historyTarget, setHistoryTarget] = useState<StaffUser | null>(null);
  const [historyRecords, setHistoryRecords] = useState<EmploymentRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ── Staff panel (history + terminate) ──
  const [showStaffPanel, setShowStaffPanel] = useState(false);

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
      // Fetch school name for variable pre-population
      apiGet<{ name: string }>('/api/v1/principal', token).then(d => { if (d?.name) setSchoolName(d.name); }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  // ── Derived ──
  const pendingLeaves = leaves.filter(l => l.status === 'pending');
  const detectedVars = detectVariables(offerForm.employment_terms);
  const filteredSigned = signedCopies.filter(s =>
    (!signedFilterName || s.staff_name.toLowerCase().includes(signedFilterName.toLowerCase())) &&
    (!signedFilterRole || s.role.toLowerCase().includes(signedFilterRole.toLowerCase()))
  );

  // Auto-populate known variable values from form data whenever terms or form fields change
  useEffect(() => {
    if (detectedVars.length === 0) return;
    const known = buildKnownVarValues(offerForm, staff, hrSettings, schoolName);
    // Vars that should always be kept in sync with form (not user-overridable)
    const alwaysSync = new Set([
      'salary', 'gross salary', 'ctc', 'monthly salary',
      'salary in words', 'salary_in_words',
      'name', 'teacher name', 'staff name', 'employee name',
      'designation', 'role', 'position',
      'joining date', 'starting date', 'start date', 'joining_date', 'start_date',
      'notice period', 'notice_period',
      'school name', 'school_name',
    ]);
    setVarValues(prev => {
      const next = { ...prev };
      detectedVars.forEach(varName => {
        const key = varName.toLowerCase();
        if (known[key] !== undefined && known[key] !== '') {
          const autoVal = known[key];
          // Always sync form-derived vars; only auto-fill others if empty
          if (alwaysSync.has(key) || !prev[varName]) {
            next[varName] = autoVal;
          }
        }
      });
      return next;
    });
  }, [
    detectedVars.join(','),
    offerForm.user_id, offerForm.role, offerForm.start_date, offerForm.gross_salary,
    hrSettings.default_notice_period, schoolName,
  ]);

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
      if (tpl) {
        setOfferForm(f => ({ ...f, employment_terms: tpl.body }));
        // Pre-fill notice_period variable with school default
        const vars = detectVariables(tpl.body);
        if (vars.includes('notice_period')) {
          setVarValues(prev => ({
            ...prev,
            notice_period: String(hrSettings.default_notice_period),
          }));
        }
      }
    }
  }

  // ── Ask Oakie (offer) ──
  async function askOakieOffer() {
    setAskingOakieOffer(true); setOfferMsg('');
    try {
      const selectedStaff = staff.find(s => s.id === offerForm.user_id);
      const context = [
        selectedStaff ? `Staff member: ${selectedStaff.name}` : '',
        offerForm.start_date ? `Joining date: ${new Date(offerForm.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}` : '',
        hrSettings.default_notice_period ? `Notice period: ${hrSettings.default_notice_period} days` : '',
      ].filter(Boolean).join('. ');

      const res = await apiPost<{ terms: string }>('/api/v1/ai/hr-terms', {
        school_name: schoolName,
        designation: offerForm.role,
        salary: offerForm.gross_salary,
        context,
      }, token);
      // Only update employment_terms — do NOT change template_id or template selector
      setOfferForm(f => ({ ...f, employment_terms: res.terms }));
    } catch (e: any) {
      if (e.message?.includes('503') || e.message?.includes('unavailable') || e.message?.includes('AI_UNAVAILABLE')) {
        setOfferMsg('Oakie is unavailable right now. Please try again later.');
      } else {
        setOfferMsg(e.message || 'Oakie could not generate terms. Please try again.');
      }
    } finally { setAskingOakieOffer(false); }
  }

  // ── Preview offer ──
  async function previewOffer() {
    setCreatingOffer(true); setOfferMsg('');
    try {
      const components = offerForm.components.filter(c => c.name && c.amount).map(c => ({ name: c.name, amount: parseFloat(c.amount) }));
      // Apply variable substitution before sending
      let resolvedTerms = offerForm.employment_terms;
      Object.entries(varValues).forEach(([key, val]) => {
        resolvedTerms = resolvedTerms.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
      });
      const res = await apiPost<{ preview_pdf_url: string }>('/api/v1/principal/hr/offer-letters/preview', {
        user_id: offerForm.user_id,
        role: offerForm.role,
        start_date: offerForm.start_date,
        gross_salary: parseFloat(offerForm.gross_salary),
        components,
        employment_terms: resolvedTerms,
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
      // Apply variable substitution before sending
      let resolvedTerms = offerForm.employment_terms;
      Object.entries(varValues).forEach(([key, val]) => {
        resolvedTerms = resolvedTerms.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
      });
      const newOffer = await apiPost<OfferLetter>('/api/v1/principal/hr/offer-letters', {
        user_id: offerForm.user_id,
        role: offerForm.role,
        start_date: offerForm.start_date,
        gross_salary: parseFloat(offerForm.gross_salary),
        components,
        employment_terms: resolvedTerms,
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
    setAskingOakieTpl(true); setTemplateMsg('');
    try {
      const res = await apiPost<{ terms: string }>('/api/v1/ai/hr-terms', {
        school_name: schoolName,
        designation: templateForm.name || 'Teacher',
        salary: '',
        context: 'Generate a reusable offer letter template. Use {{name}} for staff name, {{designation}} for role, {{joining_date}} for start date, {{salary}} for monthly salary, {{notice_period}} for notice period, {{probation_period}} for probation period, and {{school_name}} for school name as placeholders. Do not fill in actual values.',
      }, token);
      setTemplateForm(f => ({ ...f, body: res.terms }));
    } catch (e: any) {
      if (e.message?.includes('503') || e.message?.includes('unavailable') || e.message?.includes('AI_UNAVAILABLE')) {
        setTemplateMsg('Oakie is unavailable right now. Please try again.');
      } else {
        setTemplateMsg(e.message || 'Oakie could not generate a template. Please try again.');
      }
    } finally { setAskingOakieTpl(false); }
  }

  // ── Acknowledge resignation ──
  async function acknowledgeResignation(id: string, lastWorkingDayOverride?: string) {
    setAcknowledgingId(id);
    try {
      const body: any = {};
      if (lastWorkingDayOverride) body.last_working_day = lastWorkingDayOverride;
      const updated = await apiPatch<EmploymentRecord>(`/api/v1/principal/hr/resignations/${id}/acknowledge`, body, token);
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

  // ── Letterhead upload ──
  async function uploadLetterhead(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLetterhead(true); setLetterheadMsg('');
    try {
      const formData = new FormData();
      formData.append('letterhead', file);
      const res = await fetch(`${API_BASE}/api/v1/principal/hr/settings/letterhead`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setHrSettings(prev => ({ ...prev, letterhead_url: data.letterhead_url }));
      setLetterheadMsg('Letterhead uploaded successfully.');
    } catch (err: any) {
      setLetterheadMsg(err.message || 'Upload failed');
    } finally { setUploadingLetterhead(false); }
  }

  async function removeLetterhead() {
    setUploadingLetterhead(true); setLetterheadMsg('');
    try {
      await fetch(`${API_BASE}/api/v1/principal/hr/settings/letterhead`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setHrSettings(prev => ({ ...prev, letterhead_url: null }));
      setLetterheadMsg('Letterhead removed.');
    } catch { setLetterheadMsg('Failed to remove letterhead'); }
    finally { setUploadingLetterhead(false); }
  }

  // ── Principal signature upload ──
  async function uploadSignature(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSignature(true); setSignatureMsg('');
    try {
      const formData = new FormData();
      formData.append('signature', file);
      if (signatureDesignation) formData.append('designation', signatureDesignation);
      const res = await fetch(`${API_BASE}/api/v1/principal/hr/settings/signature`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setHrSettings(prev => ({ ...prev, principal_signature_url: data.signature_url, principal_designation: data.designation }));
      setSignatureMsg('Signature uploaded successfully.');
    } catch (err: any) {
      setSignatureMsg(err.message || 'Upload failed');
    } finally { setUploadingSignature(false); }
  }

  async function removeSignature() {
    setUploadingSignature(true); setSignatureMsg('');
    try {
      await fetch(`${API_BASE}/api/v1/principal/hr/settings/signature`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setHrSettings(prev => ({ ...prev, principal_signature_url: null, principal_designation: null }));
      setSignatureMsg('Signature removed.');
    } catch { setSignatureMsg('Failed to remove signature'); }
    finally { setUploadingSignature(false); }
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
                {/* ── How-to guide ── */}
                {!showOfferForm && (
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 space-y-1">
                    <p className="text-xs font-semibold text-blue-700">How to create an offer letter</p>
                    <p className="text-xs text-blue-600 leading-relaxed">
                      1. Go to <span className="font-semibold">Templates</span> tab → create a template (use Oakie to generate it)<br/>
                      2. Come back here → click <span className="font-semibold">Create Offer Letter</span><br/>
                      3. Select staff, fill in details, pick your template<br/>
                      4. Preview → Approve & Send
                    </p>
                  </div>
                )}

                {/* ── Top action row: Create + Staff History ── */}
                <div className="flex gap-2">
                  <button onClick={() => { setShowOfferForm(v => !v); setOfferStep('form'); setOfferMsg(''); }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl text-sm font-bold transition-colors">
                    <Plus className="w-4 h-4" /> Create Offer Letter
                  </button>
                  <button onClick={() => setShowStaffPanel(true)}
                    className="flex items-center gap-1.5 px-4 py-3 border border-neutral-200 text-neutral-600 rounded-2xl text-sm font-semibold hover:bg-neutral-50 transition-colors">
                    <Users className="w-4 h-4" /> Staff
                  </button>
                </div>

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

                    {/* Employment terms */}
                    <div>
                      <label className="text-xs font-medium text-neutral-600 mb-1 block">Employment Terms</label>
                      <p className="text-[10px] text-neutral-400 mb-2">
                        Select a template above to pre-fill this field. Go to the <span className="font-semibold">Templates</span> tab to create templates with Oakie's help.
                      </p>
                      <textarea value={offerForm.employment_terms}
                        onChange={e => setOfferForm(f => ({ ...f, employment_terms: e.target.value }))}
                        rows={4} className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                    </div>

                    {/* Variable substitution inputs */}
                    {detectedVars.length > 0 && (() => {
                      const emptyVars = detectedVars.filter(v => !varValues[v]);
                      const filledVars = detectedVars.filter(v => !!varValues[v]);
                      return (
                        <div className="space-y-2">
                          {/* Pre-populated variables — shown collapsed, editable */}
                          {filledVars.length > 0 && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
                              <p className="text-xs font-semibold text-emerald-700">✓ Auto-filled from form</p>
                              {filledVars.map(v => (
                                <div key={v}>
                                  <label className="text-xs font-medium text-neutral-600 mb-1 block">{v}</label>
                                  <input value={varValues[v] || ''} onChange={e => setVarValues(prev => ({ ...prev, [v]: e.target.value }))}
                                    className="w-full px-3 py-2 border border-emerald-200 bg-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/30" />
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Empty variables — need manual input */}
                          {emptyVars.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                              <p className="text-xs font-semibold text-amber-700">Fill in remaining variables</p>
                              {emptyVars.map(v => (
                                <div key={v}>
                                  <label className="text-xs font-medium text-neutral-600 mb-1 block">{v}</label>
                                  <input value={varValues[v] || ''} onChange={e => setVarValues(prev => ({ ...prev, [v]: e.target.value }))}
                                    placeholder={`Value for {{${v}}}`}
                                    className="w-full px-3 py-2 border border-amber-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}

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
                {/* How-to hint */}
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 space-y-1">
                  <p className="text-xs font-semibold text-blue-700">How to create a template</p>
                  <p className="text-xs text-blue-600 leading-relaxed">
                    1. Give your template a name (e.g. "Standard Teacher Offer")<br/>
                    2. Use <span className="font-mono bg-blue-100 px-1 rounded">{'{{variable}}'}</span> placeholders for dynamic fields — e.g. <span className="font-mono bg-blue-100 px-1 rounded">{'{{name}}'}</span>, <span className="font-mono bg-blue-100 px-1 rounded">{'{{salary}}'}</span>, <span className="font-mono bg-blue-100 px-1 rounded">{'{{joining_date}}'}</span><br/>
                    3. Use <span className="font-semibold">Ask Oakie ✨</span> to generate the full letter body automatically<br/>
                    4. Format with bold, italic, colours and alignment using the toolbar
                  </p>
                </div>

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
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-neutral-600">Body</label>
                        <button onClick={askOakieTemplate} disabled={askingOakieTpl}
                          className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-semibold disabled:opacity-50 bg-primary-50 px-2.5 py-1 rounded-lg transition-colors">
                          {askingOakieTpl ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                          Ask Oakie
                        </button>
                      </div>
                      <RichTextEditor
                        value={templateForm.body}
                        onChange={body => setTemplateForm(f => ({ ...f, body }))}
                        placeholder="Use {{variable}} for dynamic fields — e.g. {{name}}, {{salary}}, {{joining_date}}…"
                        minHeight="220px"
                      />
                      <p className="text-[10px] text-neutral-400 mt-1">
                        Tip: Use <span className="font-mono">{'{{name}}'}</span> <span className="font-mono">{'{{designation}}'}</span> <span className="font-mono">{'{{salary}}'}</span> <span className="font-mono">{'{{joining_date}}'}</span> <span className="font-mono">{'{{notice_period}}'}</span> as placeholders
                      </p>
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
                    <ResignationCard
                      key={r.id}
                      r={r}
                      acknowledgingId={acknowledgingId}
                      onAcknowledge={acknowledgeResignation}
                    />
                  ))}
                </div>
              )
            )}

            {/* ══ SETTINGS ════════════════════════════════════════════════════ */}
            {tab === 'settings' && (
              <div className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm space-y-4">
                <p className="text-sm font-bold text-neutral-800">HR Settings</p>

                {/* Notice Period */}
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

                {/* Letterhead Upload */}
                <div className="border-t border-neutral-100 pt-4 space-y-3">
                  <div>
                    <p className="text-xs font-bold text-neutral-700 mb-1">Letterhead</p>
                    <p className="text-xs text-neutral-400 mb-3">Upload your school letterhead as a PNG or JPG image. It will be used as the full-page background for offer letters and fee receipts — your header, footer, logo and address will come from the letterhead automatically.</p>
                  </div>

                  {hrSettings.letterhead_url ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-emerald-700">✓ Letterhead uploaded</p>
                        <a href={hrSettings.letterhead_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-emerald-600 underline">Preview letterhead</a>
                      </div>
                      <button onClick={removeLetterhead} disabled={uploadingLetterhead}
                        className="text-xs px-2.5 py-1.5 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-colors font-medium">
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-neutral-200 rounded-xl p-4 text-center">
                      <p className="text-xs text-neutral-400 mb-2">PDF or image (PNG/JPG) · Max 5MB</p>
                      <label className="cursor-pointer">
                        <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-semibold transition-colors">
                          {uploadingLetterhead ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                          {uploadingLetterhead ? 'Uploading…' : 'Choose Letterhead'}
                        </span>
                        <input type="file" accept=".png,.jpg,.jpeg" className="hidden"
                          onChange={uploadLetterhead} disabled={uploadingLetterhead} />
                      </label>
                    </div>
                  )}
                  {letterheadMsg && (
                    <p className={`text-xs font-medium ${letterheadMsg.includes('uploaded') ? 'text-emerald-600' : 'text-red-500'}`}>{letterheadMsg}</p>
                  )}
                </div>

                {/* Principal Signature Upload */}
                <div className="border-t border-neutral-100 pt-4 space-y-3">
                  <div>
                    <p className="text-xs font-bold text-neutral-700 mb-1">Principal Signature</p>
                    <p className="text-xs text-neutral-400 mb-3">Upload your signature as a PNG/JPG image. It will be placed at the bottom-right of every offer letter automatically — no need to sign each time.</p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-neutral-600 mb-1 block">Designation (shown below signature)</label>
                    <input
                      value={signatureDesignation || hrSettings.principal_designation || ''}
                      onChange={e => setSignatureDesignation(e.target.value)}
                      placeholder="e.g. Principal, Director"
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30"
                    />
                  </div>

                  {hrSettings.principal_signature_url ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
                      <p className="text-xs font-semibold text-emerald-700">✓ Signature uploaded</p>
                      <img src={hrSettings.principal_signature_url} alt="Principal signature" className="h-12 object-contain" />
                      {hrSettings.principal_designation && (
                        <p className="text-xs text-neutral-500">{hrSettings.principal_designation}</p>
                      )}
                      <div className="flex gap-2">
                        <label className="cursor-pointer flex-1">
                          <span className="flex items-center justify-center gap-1.5 px-3 py-1.5 border border-neutral-200 text-neutral-600 rounded-xl text-xs font-medium hover:bg-neutral-50 transition-colors">
                            {uploadingSignature ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                            Replace
                          </span>
                          <input type="file" accept=".png,.jpg,.jpeg" className="hidden"
                            onChange={uploadSignature} disabled={uploadingSignature} />
                        </label>
                        <button onClick={removeSignature} disabled={uploadingSignature}
                          className="flex-1 px-3 py-1.5 border border-red-200 text-red-600 rounded-xl text-xs font-medium hover:bg-red-50 transition-colors disabled:opacity-50">
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-neutral-200 rounded-xl p-4 text-center">
                      <p className="text-xs text-neutral-400 mb-2">PNG or JPG · Transparent background recommended · Max 2MB</p>
                      <label className="cursor-pointer">
                        <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-semibold transition-colors">
                          {uploadingSignature ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                          {uploadingSignature ? 'Uploading…' : 'Upload Signature'}
                        </span>
                        <input type="file" accept=".png,.jpg,.jpeg" className="hidden"
                          onChange={uploadSignature} disabled={uploadingSignature} />
                      </label>
                    </div>
                  )}
                  {signatureMsg && (
                    <p className={`text-xs font-medium ${signatureMsg.includes('uploaded') ? 'text-emerald-600' : 'text-red-500'}`}>{signatureMsg}</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ══ STAFF PANEL MODAL ═══════════════════════════════════════════ */}
      {showStaffPanel && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                <Users className="w-4 h-4" /> Active Staff
              </p>
              <button onClick={() => setShowStaffPanel(false)} className="text-neutral-400 hover:text-neutral-600 text-xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {staff.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-8">No active staff found</p>
              ) : (
                staff.map(s => (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b border-neutral-50 last:border-0">
                    <div>
                      <p className="text-sm font-semibold text-neutral-800">{s.name}</p>
                      <p className="text-xs text-neutral-400 capitalize">{s.role_name}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => { openHistory(s); setShowStaffPanel(false); }}
                        className="text-xs px-2.5 py-1.5 border border-neutral-200 text-neutral-600 rounded-xl hover:bg-neutral-50 transition-colors font-medium">
                        History
                      </button>
                      <button onClick={() => { setTerminateTarget(s); setTerminateReason(''); setTerminateMsg(''); setShowStaffPanel(false); }}
                        className="text-xs px-2.5 py-1.5 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-colors font-medium">
                        Terminate
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

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
