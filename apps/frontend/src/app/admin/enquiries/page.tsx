'use client';

import { useState, useEffect } from 'react';
import { Card, Button } from '@/components/ui';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { getToken } from '@/lib/auth';

interface Enquiry {
  id: string;
  student_name: string;
  parent_name: string;
  contact_number: string;
  class_of_interest: string;
  child_age?: string;
  enquiry_date?: string;
  status: 'open' | 'converted' | 'closed';
  notes?: string;
  created_at: string;
}

interface Class {
  id: string;
  name: string;
  sections: { id: string; label: string }[];
}

/* ÔöÇÔöÇ Conversion Wizard ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
function ConvertWizard({ enquiry, onClose, onConverted }: {
  enquiry: Enquiry;
  onClose: () => void;
  onConverted: () => void;
}) {
  const [step, setStep] = useState(1);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const token = getToken();

  const selectedClass = classes.find(c => c.id === selectedClassId);

  useEffect(() => {
    if (!token) return;
    apiGet<Class[]>('/api/v1/admin/classes', token)
      .then(setClasses)
      .catch(() => setClasses([]));
  }, [token]);

  async function handleConvert() {
    if (!token || !selectedClassId || !selectedSectionId) return;
    setLoading(true);
    setError('');
    try {
      // Create student + parent login
      const payload = {
        name: enquiry.student_name,
        class_id: selectedClassId,
        section_id: selectedSectionId,
        father_name: enquiry.parent_name,
        parent_contact: enquiry.contact_number,
      };
      await apiPost('/api/v1/admin/students', payload, token);

      // Mark enquiry as converted
      await apiPut(`/api/v1/admin/enquiries/${enquiry.id}`, { status: 'converted' }, token);

      setStep(3); // Success
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        
        {/* Header */}
        <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Convert to Admission</h2>
            <p className="text-xs text-gray-500 mt-0.5">{enquiry.student_name} ┬À {enquiry.parent_name}</p>
          </div>
          {step !== 3 && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">Ô£ò</button>
          )}
        </div>

        {/* Step indicator */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center flex-1">
                <div className={`w-full h-1 rounded-full ${s <= step ? 'bg-emerald-500' : 'bg-gray-200'}`} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Select Class</span>
            <span>Confirm</span>
            <span>Done</span>
          </div>
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
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 bg-white"
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
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 bg-white"
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
                  Next ÔåÆ
                </Button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm text-gray-600 mb-4">Review the details before converting this enquiry to an admission.</p>

              <div className="space-y-3 mb-4">
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Student</p>
                  <p className="text-sm font-semibold text-gray-900">{enquiry.student_name}</p>
                  {enquiry.child_age && <p className="text-xs text-gray-500">Age: {enquiry.child_age}</p>}
                </div>

                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Class Assignment</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedClass?.name} ┬À Section {selectedClass?.sections.find(s => s.id === selectedSectionId)?.label}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Parent Login</p>
                  <p className="text-sm font-semibold text-gray-900">{enquiry.parent_name}</p>
                  <p className="text-xs text-gray-500">Mobile: {enquiry.contact_number}</p>
                  <p className="text-xs text-amber-600 mt-1">Initial password: {enquiry.contact_number}</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 mb-4">
                <p className="text-xs text-blue-800">
                  Ôä╣´©Å A student record will be created and a parent login will be set up. The parent can log in using their mobile number as both username and password.
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 mb-4">
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">ÔåÉ Back</Button>
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

          {step === 3 && (
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
                <p className="text-xs text-gray-500">
                  Parent can log in with mobile: {enquiry.contact_number}
                </p>
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

/* ÔöÇÔöÇ Main Page ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
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
                        ­ƒÄô Convert
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
