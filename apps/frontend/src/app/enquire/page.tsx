'use client';

import { useState, useEffect } from 'react';
import { API_BASE } from '@/lib/api';

const SCHOOL_CODE = 'silveroakjuniors';
const SCHOOL_WEBSITE = 'https://silveroakjuniors.in';

const CLASS_OPTIONS = [
  'Play Group', 'Nursery', 'LKG', 'UKG',
];

interface SchoolInfo {
  name: string;
  tagline?: string;
  primary_color?: string;
}

export default function EnquiryPage() {
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [form, setForm] = useState({
    student_name: '',
    child_age: '',
    parent_name: '',
    contact_number: '',
    class_of_interest: '',
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/public/enquiries/school-info?school_code=${SCHOOL_CODE}`)
      .then(r => r.json())
      .then(data => {
        if (data.name) setSchoolInfo(data);
      })
      .catch(() => {
        // Use fallback if API unavailable
        setSchoolInfo({ name: 'Silver Oak Juniors', tagline: 'Nurturing Young Minds' });
      });
  }, []);

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.student_name.trim()) errs.student_name = 'Child\'s name is required';
    if (!form.parent_name.trim()) errs.parent_name = 'Parent name is required';
    if (!form.contact_number.trim()) {
      errs.contact_number = 'Contact number is required';
    } else if (!/^\d{10}$/.test(form.contact_number.replace(/\D/g, ''))) {
      errs.contact_number = 'Please enter a valid 10-digit mobile number';
    }
    if (!form.class_of_interest) errs.class_of_interest = 'Please select a class';
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/public/enquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, school_code: SCHOOL_CODE }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const primaryColor = schoolInfo?.primary_color || '#1a3c2e';

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50">
      {/* Header — not sticky, no overlap issues */}
      <header className="w-full px-4 py-3 flex items-center justify-between border-b border-emerald-100 bg-white">
        <div className="flex items-center gap-2">
          <img
            src="/school-logo.png"
            alt="Silver Oak Juniors"
            className="w-10 h-10 object-contain"
          />
          <div>
            <p className="font-semibold text-gray-800 text-sm leading-tight">
              {schoolInfo?.name || 'Silver Oak Juniors'}
            </p>
            {schoolInfo?.tagline && (
              <p className="text-xs text-gray-400">{schoolInfo.tagline}</p>
            )}
          </div>
        </div>
        <a
          href={SCHOOL_WEBSITE}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium px-3 py-1.5 rounded-full border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors shrink-0"
        >
          Website ↗
        </a>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {submitted ? (
          /* ── Success state ── */
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
              <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Enquiry Submitted!</h2>
            <p className="text-gray-500 mb-2 text-sm leading-relaxed">
              Thank you for your interest in {schoolInfo?.name || 'Silver Oak Juniors'}.
              Our admissions team will reach out to you shortly.
            </p>
            <p className="text-xs text-gray-400 mb-8">
              We typically respond within 1–2 business days.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setSubmitted(false);
                  setForm({ student_name: '', child_age: '', parent_name: '', contact_number: '', class_of_interest: '' });
                  setFieldErrors({});
                }}
                className="w-full py-3 rounded-xl font-medium text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Submit Another Enquiry
              </button>
              <a
                href={SCHOOL_WEBSITE}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-xl font-medium text-sm text-white text-center transition-colors"
                style={{ backgroundColor: primaryColor }}
              >
                Visit {schoolInfo?.name || 'Our Website'}
              </a>
            </div>
          </div>
        ) : (
          /* ── Enquiry form ── */
          <>
            <div className="text-center mb-8">
              <img
                src="/school-logo.png"
                alt="Silver Oak Juniors"
                className="w-32 h-32 object-contain mx-auto mb-3"
              />
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Admissions Enquiry</h1>
              <p className="text-sm text-gray-500 leading-relaxed">
                Interested in enrolling your child? Fill in the details below and our team will get in touch with you.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {/* Child's Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Child's Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  placeholder="Enter your child's full name"
                  value={form.student_name}
                  onChange={e => {
                    setForm(p => ({ ...p, student_name: e.target.value }));
                    if (fieldErrors.student_name) setFieldErrors(p => ({ ...p, student_name: '' }));
                  }}
                  className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-colors ${
                    fieldErrors.student_name
                      ? 'border-red-300 focus:ring-red-200 bg-red-50'
                      : 'border-gray-200 focus:ring-emerald-200 focus:border-emerald-400 bg-white'
                  }`}
                />
                {fieldErrors.student_name && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.student_name}</p>
                )}
              </div>

              {/* Child's Age */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Child's Age
                </label>
                <input
                  type="text"
                  placeholder="e.g. 4 years"
                  value={form.child_age}
                  onChange={e => setForm(p => ({ ...p, child_age: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 bg-white transition-colors"
                />
              </div>

              {/* Class of Interest */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Class Enquiring For <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.class_of_interest}
                  onChange={e => {
                    setForm(p => ({ ...p, class_of_interest: e.target.value }));
                    if (fieldErrors.class_of_interest) setFieldErrors(p => ({ ...p, class_of_interest: '' }));
                  }}
                  className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-colors appearance-none bg-white ${
                    fieldErrors.class_of_interest
                      ? 'border-red-300 focus:ring-red-200 bg-red-50'
                      : 'border-gray-200 focus:ring-emerald-200 focus:border-emerald-400'
                  }`}
                >
                  <option value="">Select a class…</option>
                  {CLASS_OPTIONS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {fieldErrors.class_of_interest && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.class_of_interest}</p>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100 pt-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Parent / Guardian Details</p>
              </div>

              {/* Parent Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Parent / Guardian Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="Your full name"
                  value={form.parent_name}
                  onChange={e => {
                    setForm(p => ({ ...p, parent_name: e.target.value }));
                    if (fieldErrors.parent_name) setFieldErrors(p => ({ ...p, parent_name: '' }));
                  }}
                  className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-colors ${
                    fieldErrors.parent_name
                      ? 'border-red-300 focus:ring-red-200 bg-red-50'
                      : 'border-gray-200 focus:ring-emerald-200 focus:border-emerald-400 bg-white'
                  }`}
                />
                {fieldErrors.parent_name && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.parent_name}</p>
                )}
              </div>

              {/* Contact Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Contact Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  autoComplete="tel"
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  value={form.contact_number}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setForm(p => ({ ...p, contact_number: val }));
                    if (fieldErrors.contact_number) setFieldErrors(p => ({ ...p, contact_number: '' }));
                  }}
                  className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-colors ${
                    fieldErrors.contact_number
                      ? 'border-red-300 focus:ring-red-200 bg-red-50'
                      : 'border-gray-200 focus:ring-emerald-200 focus:border-emerald-400 bg-white'
                  }`}
                />
                {fieldErrors.contact_number && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.contact_number}</p>
                )}
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2 shadow-sm hover:shadow-md"
                style={{ backgroundColor: primaryColor }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Submitting…
                  </span>
                ) : 'Submit Enquiry'}
              </button>

              <p className="text-center text-xs text-gray-400 pb-4">
                By submitting, you agree to be contacted by the school regarding admissions.{' '}
                <a href={SCHOOL_WEBSITE} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
                  Visit our website
                </a>
              </p>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
