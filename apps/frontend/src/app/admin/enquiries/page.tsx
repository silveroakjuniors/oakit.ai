'use client';

import { useState, useEffect } from 'react';
import { Card, Button } from '@/components/ui';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { API_BASE } from '@/lib/api';

interface Enquiry {
  id: string;
  student_name: string;
  parent_name: string;
  contact_number: string;
  class_of_interest: string;
  child_age?: string;
  status: 'open' | 'converted' | 'closed';
  created_at: string;
}

interface Class {
  id: string;
  name: string;
  sections: { id: string; label: string }[];
}

interface FeeHead {
  id: string;
  name: string;
  type: string;
  amount: number;
  rounded_monthly_fee?: number;
  calculated_monthly_fee?: number;
}

interface FeeStructure {
  id: string;
  name: string;
  fee_heads: FeeHead[];
}

/* Conversion Wizard */
function ConvertWizard({ enquiry, onClose, onConverted }: {
  enquiry: Enquiry;
  onClose: () => void;
  onConverted: () => void;
}) {
  const [step, setStep] = useState(1);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [feeStructure, setFeeStructure] = useState<FeeStructure | null>(null);
  const [selectedFeeHeads, setSelectedFeeHeads] = useState<Set<string>>(new Set());
  const [paymentMode, setPaymentMode] = useState<'skip' | 'cash' | 'online' | 'bank_transfer'>('skip');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdStudentId, setCreatedStudentId] = useState('');
  const token = getToken();

  const selectedClass = classes.find(c => c.id === selectedClassId);

  useEffect(() => {
    if (!token) return;
    apiGet<Class[]>('/api/v1/admin/classes', token)
      .then(setClasses)
      .catch(() => setClasses([]));
  }, [token]);

  useEffect(() => {
    if (!token || !selectedClassId) return;
    // Fetch active fee structure for the selected class
    apiGet<FeeStructure | null>(`/api/v1/admin/enquiries/fee-structures?class_id=${selectedClassId}`, token)
      .then(data => setFeeStructure(data))
      .catch(() => setFeeStructure(null));
  }, [selectedClassId, token]);

  function toggleFeeHead(id: string) {
    setSelectedFeeHeads(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConvert() {
    if (!token || !selectedClassId || !selectedSectionId) return;
    setLoading(true);
    setError('');
    try {
      // Step 1: Create student + parent login
      const studentPayload = {
        name: enquiry.student_name,
        class_id: selectedClassId,
        section_id: selectedSectionId,
        father_name: enquiry.parent_name,
        parent_contact: enquiry.contact_number,
      };
      const studentRes = await apiPost<{ id: string }>('/api/v1/admin/students', studentPayload, token);
      const studentId = studentRes.id;
      setCreatedStudentId(studentId);

      // Step 2: Create student_fee_accounts for selected fee heads
      if (selectedFeeHeads.size > 0 && feeStructure) {
        for (const headId of selectedFeeHeads) {
          const head = feeStructure.fee_heads.find(h => h.id === headId);
          if (!head) continue;
          const assignedAmount = head.rounded_monthly_fee ?? head.calculated_monthly_fee ?? head.amount ?? 0;
          await apiPost('/api/v1/admin/enquiries/student-fee-accounts', {
            student_id: studentId,
            fee_head_id: headId,
            assigned_amount: assignedAmount,
            outstanding_balance: assignedAmount,
            status: 'pending',
            admission_date: new Date().toISOString().split('T')[0],
          }, token);
        }
      }

      // Step 3: Record initial payment if provided
      if (paymentMode !== 'skip' && paymentAmount && parseFloat(paymentAmount) > 0 && selectedFeeHeads.size > 0) {
        const firstFeeHeadId = Array.from(selectedFeeHeads)[0];
        const paymentPayload: any = {
          student_id: studentId,
          fee_head_id: firstFeeHeadId,
          amount: parseFloat(paymentAmount),
          payment_mode: paymentMode,
          payment_date: new Date().toISOString().split('T')[0],
        };
        if (transactionRef) paymentPayload.reference_number = transactionRef;

        // Upload screenshot if provided
        if (screenshot) {
          const fd = new FormData();
          fd.append('file', screenshot);
          const uploadRes = await fetch(`${API_BASE}/api/v1/admin/enquiries/upload-screenshot`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          });
          if (uploadRes.ok) {
            const { url } = await uploadRes.json();
            paymentPayload.screenshot_url = url;
          }
        }

        await apiPost('/api/v1/admin/enquiries/payments', paymentPayload, token);
      }

      // Step 4: Mark enquiry as converted
      await apiPut(`/api/v1/admin/enquiries/${enquiry.id}`, { status: 'converted' }, token);

      setStep(5); // Success
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        
        {/* Header */}
        <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Convert to Admission</h2>
            <p className="text-xs text-gray-500 mt-0.5">{enquiry.student_name} · {enquiry.parent_name}</p>
          </div>
          {step !== 5 && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
          )}
        </div>

        {/* Step indicator */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(s => (
              <div key={s} className="flex-1 h-1 rounded-full bg-gray-200">
                <div className={`h-full rounded-full transition-all ${s <= step ? 'bg-emerald-500' : 'bg-transparent'}`} />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1 text-center">Step {step} of 5</p>
        </div>

        {/* Content */}
        <div className="px-5 py-4">
          {step === 1 && (
            <>
              <p className="text-sm text-gray-600 mb-4">Select the class and section for this student.</p>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Class *</label>
                  <select
                    value={selectedClassId}
                    onChange={e => { setSelectedClassId(e.target.value); setSelectedSectionId(''); }}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 bg-white"
                  >
                    <option value="">Select class...</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {selectedClass && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Section *</label>
                    <select
                      value={selectedSectionId}
                      onChange={e => setSelectedSectionId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 bg-white"
                    >
                      <option value="">Select section...</option>
                      {selectedClass.sections.map(s => <option key={s.id} value={s.id}>Section {s.label}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-6">
                <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
                <Button
                  onClick={() => setStep(2)}
                  disabled={!selectedClassId || !selectedSectionId}
                  className="flex-1"
                >
                  Next →
                </Button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm text-gray-600 mb-4">Select fee heads to assign to this student.</p>

              {!feeStructure ? (
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-center text-sm text-gray-500 mb-4">
                  No active fee structure found for {selectedClass?.name}. You can skip this step.
                </div>
              ) : (
                <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                  {feeStructure.fee_heads.map(head => {
                    const amount = head.rounded_monthly_fee ?? head.calculated_monthly_fee ?? head.amount ?? 0;
                    return (
                      <label key={head.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedFeeHeads.has(head.id)}
                          onChange={() => toggleFeeHead(head.id)}
                          className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">{head.name}</p>
                          <p className="text-xs text-gray-500 capitalize">{head.type}</p>
                        </div>
                        <p className="text-sm font-bold text-gray-900">₹{amount.toFixed(2)}</p>
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">← Back</Button>
                <Button onClick={() => setStep(3)} className="flex-1">Next →</Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-sm text-gray-600 mb-4">Record initial payment (optional).</p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value as any)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 bg-white"
                  >
                    <option value="skip">Skip (No payment now)</option>
                    <option value="cash">Cash</option>
                    <option value="online">Online (UPI/Card)</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>

                {paymentMode !== 'skip' && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Amount</label>
                      <input
                        type="number"
                        value={paymentAmount}
                        onChange={e => setPaymentAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 bg-white"
                      />
                    </div>

                    {(paymentMode === 'online' || paymentMode === 'bank_transfer') && (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Transaction Reference / UTR</label>
                          <input
                            type="text"
                            value={transactionRef}
                            onChange={e => setTransactionRef(e.target.value)}
                            placeholder="Optional"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Screenshot (Optional)</label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={e => setScreenshot(e.target.files?.[0] || null)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none bg-white"
                          />
                          {screenshot && <p className="text-xs text-gray-500 mt-1">Selected: {screenshot.name}</p>}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              <div className="flex gap-2 mt-6">
                <Button variant="secondary" onClick={() => setStep(2)} className="flex-1">← Back</Button>
                <Button onClick={() => setStep(4)} className="flex-1">Next →</Button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <p className="text-sm text-gray-600 mb-4">Review all details before confirming.</p>

              <div className="space-y-3 mb-4">
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Student</p>
                  <p className="text-sm font-semibold text-gray-900">{enquiry.student_name}</p>
                  {enquiry.child_age && <p className="text-xs text-gray-500">Age: {enquiry.child_age}</p>}
                </div>

                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Class Assignment</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedClass?.name} · Section {selectedClass?.sections.find(s => s.id === selectedSectionId)?.label}
                  </p>
                </div>

                {selectedFeeHeads.size > 0 && feeStructure && (
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Fee Heads ({selectedFeeHeads.size})</p>
                    {Array.from(selectedFeeHeads).map(id => {
                      const head = feeStructure.fee_heads.find(h => h.id === id);
                      if (!head) return null;
                      const amount = head.rounded_monthly_fee ?? head.calculated_monthly_fee ?? head.amount ?? 0;
                      return (
                        <p key={id} className="text-xs text-gray-600">• {head.name}: ₹{amount.toFixed(2)}</p>
                      );
                    })}
                  </div>
                )}

                {paymentMode !== 'skip' && paymentAmount && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-1">Initial Payment</p>
                    <p className="text-sm font-semibold text-emerald-900">₹{parseFloat(paymentAmount).toFixed(2)} via {paymentMode.replace('_', ' ')}</p>
                    {transactionRef && <p className="text-xs text-emerald-700">Ref: {transactionRef}</p>}
                    {screenshot && <p className="text-xs text-emerald-700">Screenshot attached</p>}
                  </div>
                )}

                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Parent Login</p>
                  <p className="text-sm font-semibold text-gray-900">{enquiry.parent_name}</p>
                  <p className="text-xs text-gray-500">Mobile: {enquiry.contact_number}</p>
                  <p className="text-xs text-amber-600 mt-1">Initial password: {enquiry.contact_number}</p>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 mb-4">
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setStep(3)} className="flex-1">← Back</Button>
                <Button
                  onClick={handleConvert}
                  loading={loading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {loading ? 'Converting...' : 'Confirm & Convert'}
                </Button>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Admission Confirmed!</h3>
                <p className="text-sm text-gray-600 mb-1">
                  {enquiry.student_name} has been admitted to {selectedClass?.name}.
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  Parent can log in with mobile: {enquiry.contact_number}
                </p>
                {paymentMode !== 'skip' && paymentAmount && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-left mb-4">
                    <p className="text-xs font-bold text-emerald-700 mb-1">Payment Recorded</p>
                    <p className="text-sm text-emerald-900">₹{parseFloat(paymentAmount).toFixed(2)} received via {paymentMode.replace('_', ' ')}</p>
                  </div>
                )}
              </div>

              <Button
                onClick={() => { onConverted(); onClose(); }}
                className="w-full"
              >
                Done
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* Main Page */
export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'converted' | 'closed'>('all');
  const [convertingEnquiry, setConvertingEnquiry] = useState<Enquiry | null>(null);
  const token = getToken();

  useEffect(() => {
    loadEnquiries();
  }, [filter]);

  async function loadEnquiries() {
    if (!token) return;
    setLoading(true);
    try {
      const url = filter === 'all' 
        ? '/api/v1/admin/enquiries'
        : `/api/v1/admin/enquiries?status=${filter}`;
      const data = await apiGet<Enquiry[]>(url, token);
      setEnquiries(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load enquiries:', err);
      setEnquiries([]);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: 'open' | 'converted' | 'closed') {
    if (!token) return;
    try {
      await apiPut(`/api/v1/admin/enquiries/${id}`, { status }, token);
      await loadEnquiries();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    }
  }

  const statusColors = {
    open: 'bg-blue-50 text-blue-700 border-blue-200',
    converted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    closed: 'bg-gray-50 text-gray-500 border-gray-200',
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Enquiries</h1>
          <p className="text-sm text-gray-500 mt-1">Manage admissions enquiries from parents</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 border-b border-gray-100 pb-2">
        {(['all', 'open', 'converted', 'closed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filter === f
                ? 'bg-primary-50 text-primary-700 border border-primary-200'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="p-8 text-center text-gray-400">Loading...</Card>
      ) : enquiries.length === 0 ? (
        <Card className="p-8 text-center text-gray-400">
          No enquiries found
        </Card>
      ) : (
        <div className="space-y-3">
          {enquiries.map(enq => (
            <Card key={enq.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-base font-semibold text-gray-900">{enq.student_name}</h3>
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${statusColors[enq.status]}`}>
                      {enq.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
                    <p><span className="font-medium">Parent:</span> {enq.parent_name}</p>
                    <p><span className="font-medium">Contact:</span> {enq.contact_number}</p>
                    {enq.class_of_interest && <p><span className="font-medium">Class:</span> {enq.class_of_interest}</p>}
                    {enq.child_age && <p><span className="font-medium">Age:</span> {enq.child_age}</p>}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Submitted {new Date(enq.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 shrink-0">
                  {enq.status === 'open' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => setConvertingEnquiry(enq)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        🎓 Convert
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => updateStatus(enq.id, 'closed')}
                      >
                        Close
                      </Button>
                    </>
                  )}
                  {enq.status === 'closed' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => updateStatus(enq.id, 'open')}
                    >
                      Reopen
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Conversion wizard */}
      {convertingEnquiry && (
        <ConvertWizard
          enquiry={convertingEnquiry}
          onClose={() => setConvertingEnquiry(null)}
          onConverted={loadEnquiries}
        />
      )}
    </div>
  );
}
