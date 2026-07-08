'use client';

import { useState, useEffect } from 'react';

const SCHOOL_CODE = 'sojs';
const CLASS_OPTIONS = ['Play Group', 'Nursery', 'LKG', 'UKG', '1st STD', '2nd STD', '3rd STD'];

// Resolve API URL at runtime on the client
function getApiBase() {
  return (
    (typeof window !== 'undefined' && (window as any).__NEXT_PUBLIC_API_URL__) ||
    (process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/+$/, '') ||
    'https://oakit-api-gateway.onrender.com'
  );
}

interface FormState {
  child_name: string;
  class_name: string;
  parent_name: string;
  contact_number: string;
  height_in: string;
  weight_kg: string;
  chest_in: string;
  shirt_length_in: string;
  pant_length_in: string;
}

interface ExistingRecord {
  id: string;
  child_name: string;
  class_name: string;
  parent_name: string;
  contact_number: string;
  status: string;
  created_at: string;
}

type Step = 'form' | 'duplicate' | 'done';

const EMPTY_FORM: FormState = {
  child_name: '', class_name: '', parent_name: '', contact_number: '',
  height_in: '', weight_kg: '', chest_in: '', shirt_length_in: '', pant_length_in: '',
};

export default function UniformSizingPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [existing, setExisting] = useState<ExistingRecord | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = lightboxOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [lightboxOpen]);

  function setField(field: keyof FormState, value: string) {
    setForm(p => ({ ...p, [field]: value }));
    setErrors(p => ({ ...p, [field]: '' }));
  }

  function validate(): boolean {
    const e: Partial<FormState> = {};
    if (!form.child_name.trim()) e.child_name = "Child's name is required";
    if (!form.class_name) e.class_name = 'Please select a class';
    if (!form.parent_name.trim()) e.parent_name = 'Parent name is required';
    const phone = form.contact_number.replace(/\D/g, '');
    if (!phone) e.contact_number = 'Contact number is required';
    else if (phone.length !== 10) e.contact_number = 'Enter a valid 10-digit number';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // inches -> cm helper
  function inToCm(val: string) {
    return val ? Math.round(Number(val) * 2.54 * 10) / 10 : undefined;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/public/uniform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_code: SCHOOL_CODE,
          child_name: form.child_name.trim(),
          class_name: form.class_name,
          parent_name: form.parent_name.trim(),
          contact_number: form.contact_number.replace(/\D/g, ''),
          height_cm: inToCm(form.height_in),
          weight_kg: form.weight_kg ? Number(form.weight_kg) : undefined,
          chest_cm: inToCm(form.chest_in),
          shirt_length_cm: inToCm(form.shirt_length_in),
          pant_length_cm: inToCm(form.pant_length_in),
        }),
      });
      const data = await res.json();
      if (res.status === 409 && data.duplicate) {
        setExisting(data.existing);
        setStep('duplicate');
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setStep('done');
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setForm(EMPTY_FORM);
    setErrors({});
    setApiError('');
    setExisting(null);
    setStep('form');
  }

  const inp = (field: keyof FormState) =>
    `w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-colors bg-white ${
      errors[field] ? 'border-red-300 focus:ring-red-100' : 'border-gray-200 focus:ring-emerald-100 focus:border-emerald-400'
    }`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50">

      {/* Header */}
      <header className="w-full px-4 py-3 flex items-center gap-2.5 border-b border-emerald-100 bg-white sticky top-0 z-10">
        <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden flex items-center justify-center shrink-0">
          <img src="/school-logo.png" alt="Silver Oak Juniors" className="w-full h-full object-contain" />
        </div>
        <div>
          <p className="font-bold text-gray-800 text-sm leading-tight">Silver Oak Juniors</p>
          <p className="text-xs text-emerald-600 font-medium">Uniform Sizing</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">

        {/*  Duplicate warning  */}
        {step === 'duplicate' && existing && (
          <div className="py-4 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <span className="text-2xl"></span>
                <div>
                  <p className="font-bold text-amber-900 text-sm">Already submitted</p>
                  <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                    A sizing request for <strong>{existing.child_name}</strong> with this contact number was already submitted on{' '}
                    {new Date(existing.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-amber-100 p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Child</span>
                  <span className="font-semibold text-gray-800">{existing.child_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Class</span>
                  <span className="font-semibold text-gray-800">{existing.class_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Parent</span>
                  <span className="font-semibold text-gray-800">{existing.parent_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className="font-semibold text-emerald-700 capitalize">{existing.status}</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 text-center px-4">
              If this is a different child (sibling/twin), please use a different name. Contact the school to update an existing request.
            </p>
            <button onClick={reset}
              className="w-full py-3 rounded-2xl font-semibold text-sm text-white bg-gradient-to-r from-emerald-600 to-green-500 shadow-md active:scale-[0.98] transition-all">
              Go back &amp; edit
            </button>
          </div>
        )}

        {/*  Success  */}
        {step === 'done' && (
          <div className="py-4 space-y-4">
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-500 to-green-400 px-6 pt-10 pb-8 text-center shadow-xl shadow-emerald-100">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/10 -translate-y-8 translate-x-8" />
              <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/10 translate-y-8 -translate-x-6" />
              <div className="relative z-10 w-14 h-14 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="relative z-10 text-white/80 text-xs font-semibold uppercase tracking-widest mb-2">Submitted!</p>
              <h2 className="relative z-10 text-xl font-extrabold text-white leading-tight mb-1">
                {form.child_name}&apos;s measurements saved
              </h2>
              <p className="relative z-10 text-white/80 text-sm">Our team will contact you to confirm the uniform size.</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">What happens next</p>
              <div className="space-y-3">
                {[
                  { icon: '', title: "We'll call you", desc: 'Our team will call you to confirm the sizes.' },
                  { icon: '', title: 'Uniform preparation', desc: "Your child's uniform will be prepared." },
                  { icon: '', title: 'Collect at school', desc: 'Collect from the school office on the designated date.' },
                ].map(s => (
                  <div key={s.title} className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">{s.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{s.title}</p>
                      <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={reset}
              className="w-full py-3 rounded-2xl font-medium text-sm border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
              Submit for another child
            </button>
          </div>
        )}

        {/*  Form  */}
        {step === 'form' && (
          <>
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Uniform Sizing Form
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-1">Get Your Child&apos;s Uniform Size</h1>
              <p className="text-sm text-gray-500">Fill in the details and we&apos;ll get back to you with the right size.</p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">

              {/* Child details */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Child Details</p>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Child&apos;s Name <span className="text-red-400">*</span>
                  </label>
                  <input type="text" placeholder="Full name of the child" value={form.child_name}
                    onChange={e => setField('child_name', e.target.value)} className={inp('child_name')} />
                  {errors.child_name && <p className="text-xs text-red-500 mt-1">{errors.child_name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Class <span className="text-red-400">*</span>
                  </label>
                  <select value={form.class_name} onChange={e => setField('class_name', e.target.value)}
                    className={`${inp('class_name')} appearance-none`}>
                    <option value="">Select class...</option>
                    {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {errors.class_name && <p className="text-xs text-red-500 mt-1">{errors.class_name}</p>}
                </div>
              </div>

              {/* Parent details */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Parent / Guardian</p>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Parent Name <span className="text-red-400">*</span>
                  </label>
                  <input type="text" placeholder="Your full name" value={form.parent_name}
                    onChange={e => setField('parent_name', e.target.value)} className={inp('parent_name')} />
                  {errors.parent_name && <p className="text-xs text-red-500 mt-1">{errors.parent_name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Contact Number <span className="text-red-400">*</span>
                  </label>
                  <input type="tel" placeholder="10-digit mobile number" maxLength={10}
                    value={form.contact_number}
                    onChange={e => setField('contact_number', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className={inp('contact_number')} />
                  {errors.contact_number && <p className="text-xs text-red-500 mt-1">{errors.contact_number}</p>}
                </div>
              </div>

              {/* Measurements */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Measurements</p>

                {/* Reference image */}
                <div className="rounded-xl overflow-hidden border border-emerald-100">
                  <div className="bg-emerald-600 px-3 py-2 flex items-center justify-between">
                    <div>
                      <p className="text-white font-bold text-xs">Measurement Reference</p>
                      <p className="text-emerald-100 text-[10px] mt-0.5">Tap image to enlarge</p>
                    </div>
                    <span className="text-emerald-200 text-[10px] flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                      </svg>
                      Zoom
                    </span>
                  </div>
                  <button type="button" onClick={() => setLightboxOpen(true)}
                    className="w-full block focus:outline-none active:opacity-80 cursor-zoom-in"
                    aria-label="Tap to enlarge measurement reference chart">
                    <img src="/uniform-size-chart.png" alt="Uniform measurement reference chart" className="w-full h-auto" />
                  </button>
                </div>

                <p className="text-xs text-gray-400">All measurements optional. Height/chest/lengths in inches. Weight in kg.</p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Height (in)</label>
                    <input type="number" placeholder="e.g. 43" min="24" max="71" step="0.1"
                      value={form.height_in} onChange={e => setField('height_in', e.target.value)} className={inp('height_in')} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Weight (kg)</label>
                    <input type="number" placeholder="e.g. 18" min="5" max="80" step="0.1"
                      value={form.weight_kg} onChange={e => setField('weight_kg', e.target.value)} className={inp('weight_kg')} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Chest (in)</label>
                  <input type="number" placeholder="Around fullest part of chest" min="16" max="40" step="0.1"
                    value={form.chest_in} onChange={e => setField('chest_in', e.target.value)} className={inp('chest_in')} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Shirt Length (in)</label>
                    <input type="number" placeholder="Shoulder to hip" min="12" max="32" step="0.1"
                      value={form.shirt_length_in} onChange={e => setField('shirt_length_in', e.target.value)} className={inp('shirt_length_in')} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Pant Length (in)</label>
                    <input type="number" placeholder="Waist to ankle" min="12" max="40" step="0.1"
                      value={form.pant_length_in} onChange={e => setField('pant_length_in', e.target.value)} className={inp('pant_length_in')} />
                  </div>
                </div>
              </div>

              {/* How to measure */}
              <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
                <p className="text-xs font-semibold text-blue-800 mb-1"> How to measure</p>
                <ul className="text-xs text-blue-700 space-y-1 leading-relaxed">
                  <li><strong>Height:</strong> Stand straight, measure floor to top of head</li>
                  <li><strong>Chest:</strong> Around the fullest part, tape snug but not tight</li>
                  <li><strong>Shirt length:</strong> Shoulder/neck base down to the hip</li>
                  <li><strong>Pant length:</strong> Waist down to the ankle bone</li>
                </ul>
              </div>

              {apiError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                  <p className="text-sm text-red-600">{apiError}</p>
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-4 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-emerald-600 to-green-500 shadow-lg shadow-emerald-100 hover:shadow-emerald-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Submitting...
                  </span>
                ) : 'Submit '}
              </button>

              <p className="text-center text-xs text-gray-400 pb-2">
                Your details are only used for uniform preparation and will not be shared.
              </p>
            </form>
          </>
        )}
      </main>

      {/* Lightbox */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
          onClick={() => setLightboxOpen(false)}
          role="dialog" aria-modal="true">
          <button type="button" onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            aria-label="Close">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="relative w-full max-w-2xl max-h-[90dvh] overflow-auto rounded-2xl shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <img src="/uniform-size-chart.png" alt="Uniform measurement reference chart — enlarged"
              className="w-full h-auto rounded-2xl" />
            <p className="text-center text-white/60 text-xs mt-3 pb-1">Tap outside to close</p>
          </div>
        </div>
      )}
    </div>
  );
}
