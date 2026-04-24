'use client';

import { useState, useEffect } from 'react';
import { API_BASE } from '@/lib/api';

const SCHOOL_CODE = 'silveroakjuniors';
const SCHOOL_WEBSITE = 'https://silveroakjuniors.in';

const CLASS_OPTIONS = ['Play Group', 'Nursery', 'LKG', 'UKG'];

interface SchoolInfo {
  name: string;
  tagline?: string;
  primary_color?: string;
}

/* ── Splash / Welcome Modal ─────────────────────────────────────────────── */
function WelcomeSplash({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-0 sm:px-4">
      <div className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl">

        {/* Hero image band */}
        <div className="relative h-52 bg-gradient-to-br from-emerald-700 via-emerald-600 to-green-500 flex flex-col items-center justify-end pb-6 px-6">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/10 -translate-y-10 translate-x-10" />
          <div className="absolute bottom-0 left-0 w-28 h-28 rounded-full bg-white/10 translate-y-10 -translate-x-8" />

          {/* Logo */}
          <div className="relative z-10 w-24 h-24 rounded-2xl bg-white shadow-xl flex items-center justify-center mb-0 overflow-hidden">
            <img src="/school-logo.png" alt="Silver Oak Juniors" className="w-full h-full object-contain" />
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pt-5 pb-6">
          {/* Badge */}
          <div className="flex justify-center mb-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Now Smarter with AI
            </span>
          </div>

          <h1 className="text-center text-xl font-bold text-gray-900 leading-snug mb-1">
            A Trusted School.
          </h1>
          <p className="text-center text-base font-semibold text-emerald-700 mb-4">
            Now Smarter with AI.
          </p>

          {/* Stats row */}
          <div className="flex justify-center gap-4 mb-4">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">10+</p>
              <p className="text-xs text-gray-500 leading-tight">Years of<br/>Excellence</p>
            </div>
            <div className="w-px bg-gray-100" />
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">200+</p>
              <p className="text-xs text-gray-500 leading-tight">Happy Families<br/>Every Year</p>
            </div>
            <div className="w-px bg-gray-100" />
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">AI</p>
              <p className="text-xs text-gray-500 leading-tight">Powered<br/>Learning</p>
            </div>
          </div>

          {/* Location */}
          <p className="text-center text-xs text-gray-400 mb-4">📍 Seegahalli, Bangalore</p>

          {/* Feature pills */}
          <div className="bg-emerald-50 rounded-2xl px-4 py-3 mb-5 space-y-2">
            <p className="text-xs font-semibold text-emerald-800 mb-2">Enhanced with Oakit.ai</p>
            {[
              'Live updates from classroom',
              'Better learning insights',
              'Strong parent-school connection',
            ].map(f => (
              <div key={f} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-xs text-emerald-900">{f}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={onContinue}
            className="w-full py-3.5 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-emerald-600 to-green-500 shadow-lg shadow-emerald-200 hover:shadow-emerald-300 hover:from-emerald-700 hover:to-green-600 transition-all active:scale-[0.98]"
          >
            👉 Experience the Future of Early Learning
          </button>

          <p className="text-center text-xs text-gray-400 mt-3">
            Takes less than 2 minutes to enquire
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────────── */
export default function EnquiryPage() {
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [showSplash, setShowSplash] = useState(true);
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
      .then(data => { if (data.name) setSchoolInfo(data); })
      .catch(() => setSchoolInfo({ name: 'Silver Oak Juniors', tagline: 'Rooted Fearlessly' }));
  }, []);

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.student_name.trim()) errs.student_name = "Child's name is required";
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50">

      {/* Welcome Splash */}
      {showSplash && <WelcomeSplash onContinue={() => setShowSplash(false)} />}

      {/* Header */}
      <header className="w-full px-4 py-3 flex items-center justify-between border-b border-emerald-100 bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden flex items-center justify-center">
            <img src="/school-logo.png" alt="Silver Oak Juniors" className="w-full h-full object-contain" />
          </div>
          <div>
            <p className="font-bold text-gray-800 text-sm leading-tight">Silver Oak Juniors</p>
            <p className="text-xs text-emerald-600 font-medium">Rooted Fearlessly</p>
          </div>
        </div>
        <a
          href={SCHOOL_WEBSITE}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold px-3 py-1.5 rounded-full border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors shrink-0"
        >
          Website ↗
        </a>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {submitted ? (
          /* ── Success ── */
          <div className="text-center py-10">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5 shadow-inner">
              <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">You're All Set! 🎉</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-1">
              Thank you for your interest in Silver Oak Juniors.
            </p>
            <p className="text-gray-400 text-xs mb-8">Our admissions team will reach out within 1–2 business days.</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setSubmitted(false);
                  setForm({ student_name: '', child_age: '', parent_name: '', contact_number: '', class_of_interest: '' });
                  setFieldErrors({});
                  setShowSplash(false);
                }}
                className="w-full py-3 rounded-xl font-medium text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Submit Another Enquiry
              </button>
              <a
                href={SCHOOL_WEBSITE}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-xl font-bold text-sm text-white text-center bg-gradient-to-r from-emerald-600 to-green-500 shadow-md transition-all"
              >
                Visit Our Website ↗
              </a>
            </div>
          </div>
        ) : (
          /* ── Form ── */
          <>
            {/* Form header */}
            <div className="text-center mb-6">
              <h1 className="text-xl font-bold text-gray-900 mb-1">Admissions Enquiry</h1>
              <p className="text-sm text-gray-500">Fill in the details below — we'll get in touch shortly.</p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">

              {/* Child's Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Child's Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  placeholder="Enter your child's full name"
                  value={form.student_name}
                  onChange={e => { setForm(p => ({ ...p, student_name: e.target.value })); setFieldErrors(p => ({ ...p, student_name: '' })); }}
                  className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-colors ${fieldErrors.student_name ? 'border-red-300 focus:ring-red-100 bg-red-50' : 'border-gray-200 focus:ring-emerald-100 focus:border-emerald-400 bg-white'}`}
                />
                {fieldErrors.student_name && <p className="text-xs text-red-500 mt-1">{fieldErrors.student_name}</p>}
              </div>

              {/* Child's Age */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Child's Age</label>
                <input
                  type="text"
                  placeholder="e.g. 4 years"
                  value={form.child_age}
                  onChange={e => setForm(p => ({ ...p, child_age: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 bg-white transition-colors"
                />
              </div>

              {/* Class of Interest */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Class Enquiring For <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.class_of_interest}
                  onChange={e => { setForm(p => ({ ...p, class_of_interest: e.target.value })); setFieldErrors(p => ({ ...p, class_of_interest: '' })); }}
                  className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-colors appearance-none bg-white ${fieldErrors.class_of_interest ? 'border-red-300 focus:ring-red-100' : 'border-gray-200 focus:ring-emerald-100 focus:border-emerald-400'}`}
                >
                  <option value="">Select a class…</option>
                  {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {fieldErrors.class_of_interest && <p className="text-xs text-red-500 mt-1">{fieldErrors.class_of_interest}</p>}
              </div>

              {/* Divider */}
              <div className="pt-1 pb-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Parent / Guardian</p>
                <div className="h-px bg-gray-100 mt-2" />
              </div>

              {/* Parent Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Parent / Guardian Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="Your full name"
                  value={form.parent_name}
                  onChange={e => { setForm(p => ({ ...p, parent_name: e.target.value })); setFieldErrors(p => ({ ...p, parent_name: '' })); }}
                  className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-colors ${fieldErrors.parent_name ? 'border-red-300 focus:ring-red-100 bg-red-50' : 'border-gray-200 focus:ring-emerald-100 focus:border-emerald-400 bg-white'}`}
                />
                {fieldErrors.parent_name && <p className="text-xs text-red-500 mt-1">{fieldErrors.parent_name}</p>}
              </div>

              {/* Contact Number */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Contact Number <span className="text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  autoComplete="tel"
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  value={form.contact_number}
                  onChange={e => { const val = e.target.value.replace(/\D/g, '').slice(0, 10); setForm(p => ({ ...p, contact_number: val })); setFieldErrors(p => ({ ...p, contact_number: '' })); }}
                  className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-colors ${fieldErrors.contact_number ? 'border-red-300 focus:ring-red-100 bg-red-50' : 'border-gray-200 focus:ring-emerald-100 focus:border-emerald-400 bg-white'}`}
                />
                {fieldErrors.contact_number && <p className="text-xs text-red-500 mt-1">{fieldErrors.contact_number}</p>}
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-emerald-600 to-green-500 shadow-lg shadow-emerald-100 hover:shadow-emerald-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Submitting…
                  </span>
                ) : 'Submit Enquiry →'}
              </button>

              <p className="text-center text-xs text-gray-400 pb-4">
                By submitting, you agree to be contacted regarding admissions.{' '}
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
