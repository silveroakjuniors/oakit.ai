'use client';

import { useState, useEffect } from 'react';
import { API_BASE } from '@/lib/api';

const SCHOOL_CODE = 'sojs';
const SCHOOL_WEBSITE = 'https://silveroakjuniors.in';
const SCHOOL_PHONE = '8884151721';
const SCHOOL_INSTAGRAM = 'https://www.instagram.com/silveroakjuniors_seegehalli';

const CLASS_OPTIONS = ['Play Group', 'Nursery', 'LKG', 'UKG'];

interface SchoolInfo {
  name: string;
  tagline?: string;
  primary_color?: string;
}

const STEPS = [
  {
    icon: '📞',
    title: "We'll call you",
    desc: 'Our admissions team will reach out within 1-2 business days.',
  },
  {
    icon: '🏫',
    title: 'School visit',
    desc: 'Come see our AI-powered classrooms and meet our teachers.',
  },
  {
    icon: '📱',
    title: 'Parent portal access',
    desc: 'Get real-time updates, learning insights and more — right on your phone.',
  },
];

/* ── Splash / Welcome Modal ─────────────────────────────────────────────── */
function WelcomeSplash({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-0 sm:px-4">
      <div className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl">

        {/* Hero band */}
        <div className="relative h-52 bg-gradient-to-br from-emerald-700 via-emerald-600 to-green-500 flex flex-col items-center justify-end pb-6 px-6">
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/10 -translate-y-10 translate-x-10" />
          <div className="absolute bottom-0 left-0 w-28 h-28 rounded-full bg-white/10 translate-y-10 -translate-x-8" />
          <div className="relative z-10 w-24 h-24 rounded-2xl bg-white shadow-xl flex items-center justify-center overflow-hidden">
            <img src="/school-logo.png" alt="Silver Oak Juniors" className="w-full h-full object-contain" />
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pt-5 pb-6">
          <div className="flex justify-center mb-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Now Smarter with AI
            </span>
          </div>

          <h1 className="text-center text-xl font-bold text-gray-900 leading-snug mb-4">
            A Trusted School. Now Smarter with AI.
          </h1>

          <div className="flex justify-center gap-4 mb-4">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">10+</p>
              <p className="text-xs text-gray-500 leading-tight">Years of<br />Excellence</p>
            </div>
            <div className="w-px bg-gray-100" />
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">200+</p>
              <p className="text-xs text-gray-500 leading-tight">Happy Families<br />Every Year</p>
            </div>
            <div className="w-px bg-gray-100" />
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">AI</p>
              <p className="text-xs text-gray-500 leading-tight">Powered<br />Learning</p>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mb-4">📍 Seegahalli, Bangalore</p>

          <div className="bg-emerald-50 rounded-2xl px-4 py-3 mb-5 space-y-2">
            <p className="text-xs font-semibold text-emerald-800 mb-2">Enhanced with Oakit.ai</p>
            {['Live updates from classroom', 'Better learning insights', 'Strong parent-school connection'].map(f => (
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

          <button
            onClick={onContinue}
            className="w-full py-3.5 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-emerald-600 to-green-500 shadow-lg shadow-emerald-200 hover:from-emerald-700 hover:to-green-600 transition-all active:scale-[0.98]"
          >
            👉 Experience the Future of Early Learning
          </button>

          <p className="text-center text-xs text-gray-400 mt-3">Takes less than 2 minutes to enquire</p>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────────── */
export default function EnquiryPage() {
  const [, setSchoolInfo] = useState<SchoolInfo | null>(null);
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

  function resetForm() {
    setSubmitted(false);
    setForm({ student_name: '', child_age: '', parent_name: '', contact_number: '', class_of_interest: '' });
    setFieldErrors({});
    setShowSplash(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50">

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
          <div className="py-6">
            {/* Hero card */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-500 to-green-400 px-6 pt-8 pb-10 mb-5 text-center shadow-xl shadow-emerald-100">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/10 -translate-y-8 translate-x-8" />
              <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/10 translate-y-8 -translate-x-6" />

              <div className="relative z-10 w-16 h-16 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <p className="relative z-10 text-white/80 text-xs font-semibold uppercase tracking-widest mb-2">Enquiry Received</p>
              <h2 className="relative z-10 text-2xl font-extrabold text-white leading-tight mb-2">
                Welcome to the Future<br />of Early Learning! 🌟
              </h2>
              <p className="relative z-10 text-white/90 text-sm leading-relaxed">
                Silver Oak Juniors — Bangalore&apos;s first AI-powered preschool that keeps parents truly connected to their child&apos;s growth.
              </p>
            </div>

            {/* What happens next */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">What happens next</p>
              <div className="space-y-3">
                {STEPS.map(step => (
                  <div key={step.title} className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">{step.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{step.title}</p>
                      <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact + Social */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Get in touch</p>
              <div className="flex flex-col gap-2">
                <a
                  href={`tel:${SCHOOL_PHONE}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-colors"
                >
                  <span className="text-lg">📞</span>
                  <div>
                    <p className="text-xs text-gray-500">Call us directly</p>
                    <p className="text-sm font-bold text-emerald-700">{SCHOOL_PHONE}</p>
                  </div>
                </a>
                <a
                  href={SCHOOL_INSTAGRAM}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-pink-50 border border-pink-100 hover:bg-pink-100 transition-colors"
                >
                  <span className="text-lg">📸</span>
                  <div>
                    <p className="text-xs text-gray-500">Follow us on Instagram</p>
                    <p className="text-sm font-bold text-pink-600">@silveroakjuniors_seegehalli</p>
                  </div>
                </a>
              </div>
            </div>

            {/* Tagline */}
            <div className="flex justify-center mb-5">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Rooted Fearlessly · Powered by Oakit.ai
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <a
                href={SCHOOL_WEBSITE}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 rounded-2xl font-bold text-sm text-white text-center bg-gradient-to-r from-emerald-600 to-green-500 shadow-lg shadow-emerald-100 transition-all active:scale-[0.98]"
              >
                Explore Silver Oak Juniors ↗
              </a>
              <button
                onClick={resetForm}
                className="w-full py-3 rounded-2xl font-medium text-sm border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Submit Another Enquiry
              </button>
            </div>
          </div>
        ) : (
          /* ── Form ── */
          <>
            <div className="text-center mb-6">
              <h1 className="text-xl font-bold text-gray-900 mb-1">Admissions Enquiry</h1>
              <p className="text-sm text-gray-500">Fill in the details below — we&apos;ll get in touch shortly.</p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  {"Child's Name"} <span className="text-red-400">*</span>
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

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{"Child's Age"}</label>
                <input
                  type="text"
                  placeholder="e.g. 4 years"
                  value={form.child_age}
                  onChange={e => setForm(p => ({ ...p, child_age: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Class Enquiring For <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.class_of_interest}
                  onChange={e => { setForm(p => ({ ...p, class_of_interest: e.target.value })); setFieldErrors(p => ({ ...p, class_of_interest: '' })); }}
                  className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-colors appearance-none bg-white ${fieldErrors.class_of_interest ? 'border-red-300 focus:ring-red-100' : 'border-gray-200 focus:ring-emerald-100 focus:border-emerald-400'}`}
                >
                  <option value="">Select a class...</option>
                  {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {fieldErrors.class_of_interest && <p className="text-xs text-red-500 mt-1">{fieldErrors.class_of_interest}</p>}
              </div>

              <div className="pt-1 pb-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Parent / Guardian</p>
                <div className="h-px bg-gray-100 mt-2" />
              </div>

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
                    Submitting...
                  </span>
                ) : 'Submit Enquiry →'}
              </button>

              {/* Contact strip at bottom of form */}
              <div className="flex items-center justify-center gap-4 pt-1 pb-2">
                <a href={`tel:${SCHOOL_PHONE}`} className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium hover:underline">
                  <span>📞</span> {SCHOOL_PHONE}
                </a>
                <span className="text-gray-200">|</span>
                <a href={SCHOOL_INSTAGRAM} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-pink-600 font-medium hover:underline">
                  <span>📸</span> Instagram
                </a>
              </div>

              <p className="text-center text-xs text-gray-400 pb-2">
                By submitting, you agree to be contacted regarding admissions.
              </p>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
