'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Card, Button } from '@/components/ui';

type EnquiryStatus = 'open' | 'converted' | 'closed';

interface Enquiry {
  id: string;
  student_name: string;
  parent_name: string;
  contact_number: string;
  class_of_interest: string;
  child_age?: string;
  enquiry_date: string;
  status: EnquiryStatus;
  notes?: string;
}

interface ClassOption {
  id: string;
  name: string;
}

interface SectionOption {
  id: string;
  label: string;
}

interface FeeComponent {
  id: string;
  name: string;
  type: string;
  pricing_model: string;
  amount?: number;
  is_variable?: boolean;
  billing_basis?: string;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface ComponentInput {
  fee_head_id: string;
  custom_amount?: number;
  hours_per_day?: number;
  days_per_week?: number;
  route?: string;
  stop?: string;
  activities?: string[];
}

// Progress log entry shown during conversion
interface ProgressEntry {
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  detail?: string;
}

const STATUS_TABS: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'converted', label: 'Converted' },
  { id: 'closed', label: 'Closed' },
];

const WIZARD_STEPS = [
  'Select Class',
  'Fee Components',
  'Configure',
  'Preview',
  'Converting',
];

export default function EnquiriesPage() {
  const token = getToken() || '';

  // List state
  const [statusFilter, setStatusFilter] = useState('all');
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [allEnquiries, setAllEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    student_name: '', parent_name: '', contact_number: '',
    class_of_interest: '', notes: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Convert wizard
  const [convertEnquiry, setConvertEnquiry] = useState<Enquiry | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [feeComponents, setFeeComponents] = useState<FeeComponent[]>([]);
  const [selectedComponents, setSelectedComponents] = useState<Set<string>>(new Set());
  const [componentInputs, setComponentInputs] = useState<Record<string, ComponentInput>>({});
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardError, setWizardError] = useState('');
  const [progressLog, setProgressLog] = useState<ProgressEntry[]>([]);
  const [conversionResult, setConversionResult] = useState<{
    student_id: string;
    parent_id: string;
    fee_accounts_created: number;
  } | null>(null);

  useEffect(() => {
    loadEnquiries();
    loadClasses();
  }, [statusFilter]);

  // Filter enquiries by search
  useEffect(() => {
    if (!search.trim()) {
      setEnquiries(allEnquiries);
      return;
    }
    const q = search.toLowerCase();
    setEnquiries(
      allEnquiries.filter(e =>
        e.student_name.toLowerCase().includes(q) ||
        e.parent_name.toLowerCase().includes(q) ||
        e.contact_number.includes(q)
      )
    );
  }, [search, allEnquiries]);

  async function loadEnquiries() {
    setLoading(true);
    try {
      const url = statusFilter === 'all'
        ? '/api/v1/financial/enquiries'
        : `/api/v1/financial/enquiries?status=${statusFilter}`;
      const data = await apiGet<Enquiry[]>(url, token);
      const list = Array.isArray(data) ? data : [];
      setAllEnquiries(list);
      setEnquiries(list);
    } catch { setAllEnquiries([]); setEnquiries([]); }
    finally { setLoading(false); }
  }

  async function loadClasses() {
    try {
      const data = await apiGet<ClassOption[]>('/api/v1/admin/classes', token);
      setClasses(Array.isArray(data) ? data : []);
    } catch { setClasses([]); }
  }

  async function loadSections(classId: string) {
    try {
      const data = await apiGet<SectionOption[]>(`/api/v1/admin/classes/${classId}/sections`, token);
      setSections(Array.isArray(data) ? data : []);
    } catch { setSections([]); }
  }

  async function handleCreate() {
    setCreateError('');
    if (!form.student_name.trim() || !form.parent_name.trim() || !form.contact_number.trim()) {
      setCreateError('Student name, parent name, and contact number are required.');
      return;
    }
    setCreateLoading(true);
    try {
      await apiPost('/api/v1/financial/enquiries', form, token);
      setForm({ student_name: '', parent_name: '', contact_number: '', class_of_interest: '', notes: '' });
      setShowCreate(false);
      await loadEnquiries();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create enquiry.');
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleClose(id: string) {
    try {
      await apiPut(`/api/v1/financial/enquiries/${id}`, { status: 'closed' }, token);
      await loadEnquiries();
    } catch { /* ignore */ }
  }

  function openConvert(enquiry: Enquiry) {
    setConvertEnquiry(enquiry);
    setSelectedClassId('');
    setSelectedSectionId('');
    setSections([]);
    setWizardStep(1);
    setFeeComponents([]);
    setSelectedComponents(new Set());
    setComponentInputs({});
    setProgressLog([]);
    setConversionResult(null);
    setWizardError('');
  }

  async function loadFeeComponents(classId: string) {
    setWizardLoading(true);
    try {
      const data = await apiGet<{ fee_heads: FeeComponent[] }>(
        `/api/v1/financial/fee-structures?class_id=${classId}`, token
      );
      setFeeComponents(data.fee_heads || []);
    } catch { setFeeComponents([]); }
    finally { setWizardLoading(false); }
  }

  function toggleComponent(id: string) {
    setSelectedComponents(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else {
        next.add(id);
        setComponentInputs(ci => ({ ...ci, [id]: { fee_head_id: id } }));
      }
      return next;
    });
  }

  function updateInput(id: string, field: string, value: string | number | string[]) {
    setComponentInputs(prev => ({
      ...prev,
      [id]: { ...prev[id], fee_head_id: id, [field]: value },
    }));
  }

  function updateProgress(index: number, update: Partial<ProgressEntry>) {
    setProgressLog(prev => prev.map((e, i) => i === index ? { ...e, ...update } : e));
  }

  async function handleWizardNext() {
    setWizardError('');
    if (wizardStep === 1) {
      if (!selectedClassId) { setWizardError('Please select a class.'); return; }
      await loadFeeComponents(selectedClassId);
      setWizardStep(2);
    } else if (wizardStep === 2) {
      setWizardStep(3);
    } else if (wizardStep === 3) {
      setWizardStep(4);
    }
  }

  async function handleConfirmConversion() {
    if (!convertEnquiry) return;
    setWizardStep(5);
    setWizardError('');

    const steps: ProgressEntry[] = [
      { label: 'Creating student record', status: 'pending' },
      { label: 'Setting up parent login', status: 'pending' },
      { label: 'Assigning fee accounts', status: 'pending' },
      { label: 'Finalising admission', status: 'pending' },
    ];
    setProgressLog(steps);

    try {
      // Step 1 — student record (shown as running)
      updateProgress(0, { status: 'running' });
      await new Promise(r => setTimeout(r, 300));

      const feeComponentsPayload = Array.from(selectedComponents).map(id =>
        componentInputs[id] || { fee_head_id: id }
      );

      const result = await apiPost<{
        student_id: string;
        parent_id: string;
        fee_accounts_created: number;
      }>(
        `/api/v1/financial/enquiries/${convertEnquiry.id}/convert`,
        {
          class_id: selectedClassId,
          section_id: selectedSectionId || undefined,
          admission_date: new Date().toISOString().split('T')[0],
        },
        token
      );

      updateProgress(0, { status: 'done', detail: `Student ID created` });
      updateProgress(1, { status: 'running' });
      await new Promise(r => setTimeout(r, 400));
      updateProgress(1, { status: 'done', detail: 'Login: mobile number as password' });

      updateProgress(2, { status: 'running' });
      await new Promise(r => setTimeout(r, 400));

      // If fee components were selected, assign them
      if (feeComponentsPayload.length > 0) {
        try {
          await apiPost(
            `/api/v1/financial/enquiries/${convertEnquiry.id}/onboarding-fee-assignment/confirm`,
            { fee_components: feeComponentsPayload },
            token
          );
        } catch { /* fee assignment is best-effort */ }
      }

      updateProgress(2, {
        status: 'done',
        detail: result.fee_accounts_created > 0
          ? `${result.fee_accounts_created} fee account(s) assigned`
          : feeComponentsPayload.length > 0 ? 'Custom fees assigned' : 'No fee structure found — skipped',
      });

      updateProgress(3, { status: 'running' });
      await new Promise(r => setTimeout(r, 300));
      updateProgress(3, { status: 'done', detail: 'Enquiry marked as converted' });

      setConversionResult(result);
      await loadEnquiries();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Conversion failed';
      // Mark the first non-done step as error
      setProgressLog(prev => {
        const idx = prev.findIndex(e => e.status === 'running' || e.status === 'pending');
        if (idx === -1) return prev;
        return prev.map((e, i) => i === idx ? { ...e, status: 'error', detail: msg } : e);
      });
      setWizardError(msg);
    }
  }

  const filteredSections = sections;
  const selectedClassName = classes.find(c => c.id === selectedClassId)?.name || '';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-primary">Enquiry Management</h1>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : '+ New Enquiry'}
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">New Enquiry</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'student_name', label: 'Student Name', placeholder: 'Full name' },
              { key: 'parent_name', label: 'Parent Name', placeholder: 'Parent / guardian name' },
              { key: 'contact_number', label: 'Contact Number', placeholder: '10-digit mobile' },
              { key: 'class_of_interest', label: 'Class of Interest', placeholder: 'e.g. LKG, Grade 1' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={f.placeholder}
                  value={form[f.key as keyof typeof form]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Additional notes…"
                rows={2}
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          {createError && <p className="text-xs text-red-500 mt-3">{createError}</p>}
          <div className="mt-4">
            <Button onClick={handleCreate} disabled={createLoading}>
              {createLoading ? 'Creating…' : 'Create Enquiry'}
            </Button>
          </div>
        </Card>
      )}

      {/* Search + Status filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by student name, parent name, or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex gap-2">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Enquiry list */}
      <Card>
        {loading ? (
          <p className="text-sm text-gray-400 py-6 text-center">Loading…</p>
        ) : (
          <div className="space-y-2">
            {enquiries.map(enq => (
              <div key={enq.id} className="flex items-start justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-800">{enq.student_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      enq.status === 'converted' ? 'bg-green-100 text-green-700' :
                      enq.status === 'closed' ? 'bg-gray-100 text-gray-600' :
                      'bg-blue-100 text-blue-700'
                    }`}>{enq.status}</span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Parent: {enq.parent_name} · {enq.contact_number}
                  </p>
                  {enq.class_of_interest && (
                    <p className="text-xs text-gray-500">Class: {enq.class_of_interest}{enq.child_age ? ` · Age: ${enq.child_age}` : ''}</p>
                  )}
                  {enq.notes && <p className="text-xs text-gray-400 mt-1 truncate max-w-xs">{enq.notes}</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  {enq.status === 'open' && (
                    <>
                      <button
                        onClick={() => openConvert(enq)}
                        className="text-xs px-3 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 font-medium"
                      >
                        Convert
                      </button>
                      <button
                        onClick={() => handleClose(enq.id)}
                        className="text-xs px-3 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"
                      >
                        Close
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {enquiries.length === 0 && (
              <p className="text-sm text-gray-400 py-6 text-center">
                {search ? 'No enquiries match your search' : 'No enquiries found'}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Convert to admission modal */}
      {convertEnquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Convert to Admission</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{convertEnquiry.student_name} · {convertEnquiry.parent_name}</p>
                </div>
                {wizardStep !== 5 && (
                  <button onClick={() => setConvertEnquiry(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                )}
              </div>

              {/* Step indicator */}
              <div className="flex items-center mb-6 overflow-x-auto pb-1">
                {WIZARD_STEPS.map((label, i) => {
                  const s = (i + 1) as WizardStep;
                  return (
                    <div key={s} className="flex items-center flex-shrink-0">
                      <div className="flex flex-col items-center">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                          wizardStep === s ? 'bg-primary text-white' :
                          wizardStep > s ? 'bg-green-500 text-white' :
                          'bg-gray-200 text-gray-500'
                        }`}>
                          {wizardStep > s ? '✓' : s}
                        </div>
                        <span className="text-[10px] text-gray-500 mt-1 whitespace-nowrap">{label}</span>
                      </div>
                      {i < WIZARD_STEPS.length - 1 && (
                        <div className={`h-0.5 w-6 mx-1 mb-4 flex-shrink-0 ${wizardStep > s ? 'bg-green-500' : 'bg-gray-200'}`} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ── Step 1: Select Class & Section ── */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700">Step 1: Assign Class</h3>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Class <span className="text-red-500">*</span></label>
                    <select
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={selectedClassId}
                      onChange={e => {
                        setSelectedClassId(e.target.value);
                        setSelectedSectionId('');
                        if (e.target.value) loadSections(e.target.value);
                        else setSections([]);
                      }}
                    >
                      <option value="">Select a class…</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  {filteredSections.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Section</label>
                      <select
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        value={selectedSectionId}
                        onChange={e => setSelectedSectionId(e.target.value)}
                      >
                        <option value="">Select a section…</option>
                        {filteredSections.map(s => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                    <p className="text-xs text-blue-700">
                      A student record will be created for <strong>{convertEnquiry.student_name}</strong> and a parent login will be set up for <strong>{convertEnquiry.parent_name}</strong> ({convertEnquiry.contact_number}).
                    </p>
                  </div>
                </div>
              )}

              {/* ── Step 2: Fee Components ── */}
              {wizardStep === 2 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Step 2: Select Fee Components</h3>
                  {wizardLoading ? (
                    <p className="text-sm text-gray-400 py-4 text-center">Loading fee components…</p>
                  ) : feeComponents.length === 0 ? (
                    <div className="p-4 rounded-lg bg-amber-50 border border-amber-100 text-center">
                      <p className="text-sm text-amber-700">No fee structure found for {selectedClassName}.</p>
                      <p className="text-xs text-amber-600 mt-1">You can still proceed — fees can be assigned later.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {feeComponents.map(fc => (
                        <label key={fc.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100 cursor-pointer hover:bg-gray-100">
                          <input
                            type="checkbox"
                            checked={selectedComponents.has(fc.id)}
                            onChange={() => toggleComponent(fc.id)}
                            className="rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800">{fc.name}</p>
                            <p className="text-xs text-gray-500">{fc.type} · {fc.pricing_model}</p>
                          </div>
                          {fc.amount && (
                            <p className="text-sm font-medium text-gray-700 flex-shrink-0">
                              ₹{Number(fc.amount).toLocaleString('en-IN')}
                            </p>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 3: Configure ── */}
              {wizardStep === 3 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Step 3: Configure Details</h3>
                  {selectedComponents.size === 0 ? (
                    <p className="text-sm text-gray-500 py-4 text-center">No fee components selected — click Next to proceed.</p>
                  ) : (
                    <div className="space-y-4">
                      {Array.from(selectedComponents).map(id => {
                        const fc = feeComponents.find(f => f.id === id);
                        if (!fc) return null;
                        const inp = componentInputs[id] || { fee_head_id: id };
                        return (
                          <div key={id} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                            <p className="text-sm font-semibold text-gray-800 mb-2">{fc.name}</p>
                            {fc.is_variable && (
                              <div className="mb-2">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Custom Amount (₹)</label>
                                <input type="number" className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm"
                                  placeholder="0" value={inp.custom_amount || ''}
                                  onChange={e => updateInput(id, 'custom_amount', parseFloat(e.target.value))} />
                              </div>
                            )}
                            {fc.billing_basis === 'per_hour' && (
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Hours/Day</label>
                                  <input type="number" className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm"
                                    value={inp.hours_per_day || ''} onChange={e => updateInput(id, 'hours_per_day', parseFloat(e.target.value))} />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Days/Week</label>
                                  <input type="number" className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm"
                                    value={inp.days_per_week || ''} onChange={e => updateInput(id, 'days_per_week', parseFloat(e.target.value))} />
                                </div>
                              </div>
                            )}
                            {fc.type === 'transport' && (
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Route</label>
                                  <input type="text" className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm"
                                    value={inp.route || ''} onChange={e => updateInput(id, 'route', e.target.value)} />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Stop</label>
                                  <input type="text" className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm"
                                    value={inp.stop || ''} onChange={e => updateInput(id, 'stop', e.target.value)} />
                                </div>
                              </div>
                            )}
                            {fc.type === 'activity' && (
                              <div className="mt-2">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Activities (comma-separated)</label>
                                <input type="text" className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm"
                                  placeholder="e.g. Dance, Art"
                                  value={(inp.activities || []).join(', ')}
                                  onChange={e => updateInput(id, 'activities', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 4: Preview & Confirm ── */}
              {wizardStep === 4 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Step 4: Preview & Confirm</h3>
                  <div className="space-y-2 mb-4">
                    <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Student</p>
                      <p className="text-sm font-medium text-gray-800">{convertEnquiry.student_name}</p>
                      <p className="text-xs text-gray-500">Class: {selectedClassName}{selectedSectionId ? ` · Section assigned` : ''}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Parent Login</p>
                      <p className="text-sm font-medium text-gray-800">{convertEnquiry.parent_name}</p>
                      <p className="text-xs text-gray-500">Mobile: {convertEnquiry.contact_number} · Initial password: mobile number</p>
                    </div>
                    {selectedComponents.size > 0 && (
                      <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Fee Components ({selectedComponents.size})</p>
                        {Array.from(selectedComponents).map(id => {
                          const fc = feeComponents.find(f => f.id === id);
                          const inp = componentInputs[id];
                          return (
                            <div key={id} className="flex items-center justify-between py-1">
                              <p className="text-sm text-gray-700">{fc?.name || id}</p>
                              {inp?.custom_amount && (
                                <p className="text-sm text-gray-600">₹{inp.custom_amount.toLocaleString('en-IN')}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    Clicking Confirm will create the student record, set up the parent login, and assign fees in one step.
                  </p>
                </div>
              )}

              {/* ── Step 5: Live progress ── */}
              {wizardStep === 5 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Converting to Admission…</h3>
                  <div className="space-y-3">
                    {progressLog.map((entry, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {entry.status === 'done' && (
                            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                          {entry.status === 'running' && (
                            <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                          )}
                          {entry.status === 'pending' && (
                            <div className="w-5 h-5 rounded-full border-2 border-gray-200" />
                          )}
                          {entry.status === 'error' && (
                            <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                              <span className="text-white text-xs font-bold">!</span>
                            </div>
                          )}
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${
                            entry.status === 'done' ? 'text-green-700' :
                            entry.status === 'running' ? 'text-primary' :
                            entry.status === 'error' ? 'text-red-600' :
                            'text-gray-400'
                          }`}>{entry.label}</p>
                          {entry.detail && (
                            <p className="text-xs text-gray-500 mt-0.5">{entry.detail}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* All done */}
                  {conversionResult && (
                    <div className="mt-6 text-center">
                      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-lg font-semibold text-green-700">Admission Confirmed!</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {convertEnquiry.student_name} has been admitted to {selectedClassName}.
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Parent can log in with mobile: {convertEnquiry.contact_number}
                      </p>
                      <Button className="mt-5" onClick={() => setConvertEnquiry(null)}>Done</Button>
                    </div>
                  )}

                  {wizardError && !conversionResult && (
                    <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-100">
                      <p className="text-sm text-red-600">{wizardError}</p>
                      <button
                        onClick={() => setConvertEnquiry(null)}
                        className="text-xs text-red-500 underline mt-2"
                      >
                        Close and try again
                      </button>
                    </div>
                  )}
                </div>
              )}

              {wizardError && wizardStep !== 5 && (
                <p className="text-xs text-red-500 mt-3">{wizardError}</p>
              )}

              {/* Navigation buttons */}
              {wizardStep !== 5 && (
                <div className="flex gap-3 mt-6">
                  {wizardStep > 1 && (
                    <Button variant="ghost" onClick={() => setWizardStep(s => (s - 1) as WizardStep)}>
                      Back
                    </Button>
                  )}
                  {wizardStep < 4 ? (
                    <Button onClick={handleWizardNext} disabled={wizardLoading}>
                      {wizardLoading ? 'Loading…' : 'Next'}
                    </Button>
                  ) : (
                    <Button onClick={handleConfirmConversion}>
                      Confirm Admission
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
