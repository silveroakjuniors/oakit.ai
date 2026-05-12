'use client';

import { useState } from 'react';
import { API_BASE } from '@/lib/api';

const SCHOOL_CODE = 'sojs';
const CLASS_OPTIONS = ['Play Group', 'Nursery', 'LKG', 'UKG', '1st STD', '2nd STD', '3rd STD'];

const SIZES = ['20', '22', '24', '26', '28', '30', '32'];

interface FormState {
  child_name: string;
  class_name: string;
  parent_name: string;
  contact_number: string;
  height_cm: string;
  weight_kg: string;
  chest_cm: string;
  shirt_length_cm: string;
  pant_length_cm: string;
}

interface Result {
  recommended_shirt_size: string | null;
  recommended_pant_size: string | null;
}

export default function UniformSizingPage() {
  const [form, setForm] = useState<FormState>({
    child_name: '', class_name: '', parent_name: '', contact_number: '',
    height_cm: '', weight_kg: '', chest_cm: '', shirt_length_cm: '', pant_length_cm: '',
  });
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [apiError, setApiError] = useState('');
  const [showGuide, setShowGuide] = useState(false);

  function set(field: keyof FormState, value: string) {
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
    if (!form.height_cm && !form.chest_cm) {
      e.height_cm = 'Please enter at least height or chest measurement';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/public/uniform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_code: SCHOOL_CODE,
          child_name: form.child_name.trim(),
          class_name: form.class_name,
          parent_name: form.parent_name.trim(),
          contact_number: form.contact_number.replace(/\D/g, ''),
          height_cm: form.height_cm ? Number(form.height_cm) : undefined,
          weight_kg: form.weight_kg ? Number(form.weight_kg) : undefined,
          chest_cm: form.chest_cm ? Number(form.chest_cm) : undefined,
          shirt_length_cm: form.shirt_length_cm ? Number(form.shirt_length_cm) : undefined,
          pant_length_cm: form.pant_length_cm ? Number(form.pant_length_cm) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setResult(data);
      setSubmitted(true);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = (field: keyof FormState) =>
    `w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-colors bg-white ${
      errors[field]
        ? 'border-red-300 focus:ring-red-100'
        : 'border-gray-200 focus:ring-emerald-100 focus:border-emerald-400'
    }`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50">
      {/* Header */}
      <header className="w-full px-4 py-3 flex items-center justify-between border-b border-emerald-100 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden flex items-center justify-center">
            <img src="/school-logo.png" alt="Silver Oak Juniors" className="w-full h-full object-contain" />
          </div>
          <div>
            <p className="font-bold text-gray-800 text-sm leading-tight">Silver Oak Juniors</p>
            <p className="text-xs text-emerald-600 font-medium">Uniform Sizing</p>
          </div>
        </div>
        <button
          onClick={() => setShowGuide(g => !g)}
          className="text-xs font-semibold px-3 py-1.5 rounded-full border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors"
        >
          {showGuide ? 'Hide' : 'Size Guide'}
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">

        {/* Size guide panel */}
        {showGuide && (
          <div className="mb-6 bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
            <div className="bg-emerald-600 px-4 py-3">
              <p className="text-white font-bold text-sm">Indian Kids Uniform Size Chart</p>
              <p className="text-emerald-100 text-xs mt-0.5">Standard sizes 20–32 based on chest & height</p>
            </div>
            <div className="p-3">
              <img
                src="/uniform-size-chart.png"
                alt="Indian Kids Uniform Size Chart — sizes 20 to 32"
                className="w-full h-auto rounded-xl"
              />
            </div>
          </div>
        )}

        {submitted && result ? (
          /* ── Success screen ── */
          <div className="py-4">
            {/* Result card */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-500 to-green-400 px-6 pt-8 pb-8 mb-5 text-center shadow-xl shadow-emerald-100">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/10 -translate-y-8 translate-x-8" />
              <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/10 translate-y-8 -translate-x-6" />
              <div className="relative z-10 w-14 h-14 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="relative z-10 text-white/80 text-xs font-semibold uppercase tracking-widest mb-2">Sizing Complete</p>
              <h2 className="relative z-10 text-xl font-extrabold text-white leading-tight mb-1">
                {form.child_name}&apos;s Recommended Sizes
              </h2>
              <p className="relative z-10 text-white/80 text-sm mb-6">Based on the measurements provided</p>

              <div className="relative z-10 grid grid-cols-2 gap-3">
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border border-white/30">
                  <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">Shirt Size</p>
                  <p className="text-white font-extrabold text-4xl">{result.recommended_shirt_size ?? '—'}</p>
                  <p className="text-white/60 text-xs mt-1">Indian Standard</p>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border border-white/30">
                  <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">Pant Size</p>
                  <p className="text-white font-extrabold text-4xl">{result.recommended_pant_size ?? '—'}</p>
                  <p className="text-white/60 text-xs mt-1">Indian Standard</p>
                </div>
              </div>
            </div>

            {/* Info card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">What happens next</p>
              <div className="space-y-3">
                {[
                  { icon: '📞', title: "We'll confirm with you", desc: 'Our team will call you to confirm the sizes and any adjustments needed.' },
                  { icon: '👕', title: 'Uniform preparation', desc: 'Your child\'s uniform will be prepared in the recommended sizes.' },
                  { icon: '🏫', title: 'Collect at school', desc: 'Uniforms can be collected from the school office on the designated date.' },
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

            {/* Size note */}
            <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 mb-5">
              <p className="text-xs font-semibold text-amber-800 mb-1">📏 Important Note</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                These are recommended sizes based on standard measurements. We suggest going one size up if your child is between sizes or growing fast. Final confirmation will be done at the school.
              </p>
            </div>

            <button
              onClick={() => { setSubmitted(false); setResult(null); setForm({ child_name:'',class_name:'',parent_name:'',contact_number:'',height_cm:'',weight_kg:'',chest_cm:'',shirt_length_cm:'',pant_length_cm:'' }); }}
              className="w-full py-3 rounded-2xl font-medium text-sm border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Submit for another child
            </button>
          </div>
        ) : (
          /* ── Form ── */
          <>
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Uniform Sizing Form
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-1">Get Your Child&apos;s Uniform Size</h1>
              <p className="text-sm text-gray-500">Enter measurements and we&apos;ll recommend the right size instantly.</p>
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
                    onChange={e => set('child_name', e.target.value)} className={inputClass('child_name')} />
                  {errors.child_name && <p className="text-xs text-red-500 mt-1">{errors.child_name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Class <span className="text-red-400">*</span>
                  </label>
                  <select value={form.class_name} onChange={e => set('class_name', e.target.value)}
                    className={`${inputClass('class_name')} appearance-none`}>
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
                    onChange={e => set('parent_name', e.target.value)} className={inputClass('parent_name')} />
                  {errors.parent_name && <p className="text-xs text-red-500 mt-1">{errors.parent_name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Contact Number <span className="text-red-400">*</span>
                  </label>
                  <input type="tel" placeholder="10-digit mobile number" maxLength={10}
                    value={form.contact_number}
                    onChange={e => set('contact_number', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className={inputClass('contact_number')} />
                  {errors.contact_number && <p className="text-xs text-red-500 mt-1">{errors.contact_number}</p>}
                </div>
              </div>

              {/* Measurements */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Measurements</p>
                  <button type="button" onClick={() => setShowGuide(g => !g)}
                    className="text-xs text-emerald-600 font-semibold hover:underline">
                    View size chart
                  </button>
                </div>
                <p className="text-xs text-gray-500 -mt-2">All measurements in centimetres (cm) and kilograms (kg). Height or chest is required.</p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Height (cm) <span className="text-red-400">*</span>
                    </label>
                    <input type="number" placeholder="e.g. 110" min="60" max="180" value={form.height_cm}
                      onChange={e => set('height_cm', e.target.value)} className={inputClass('height_cm')} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Weight (kg)</label>
                    <input type="number" placeholder="e.g. 18" min="5" max="80" value={form.weight_kg}
                      onChange={e => set('weight_kg', e.target.value)} className={inputClass('weight_kg')} />
                  </div>
                </div>
                {errors.height_cm && <p className="text-xs text-red-500 -mt-2">{errors.height_cm}</p>}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Chest (cm)</label>
                  <input type="number" placeholder="Measure around the fullest part of chest" min="40" max="100"
                    value={form.chest_cm} onChange={e => set('chest_cm', e.target.value)} className={inputClass('chest_cm')} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Shirt Length (cm)</label>
                    <input type="number" placeholder="Shoulder to hip" min="30" max="80" value={form.shirt_length_cm}
                      onChange={e => set('shirt_length_cm', e.target.value)} className={inputClass('shirt_length_cm')} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Pant Length (cm)</label>
                    <input type="number" placeholder="Waist to ankle" min="30" max="100" value={form.pant_length_cm}
                      onChange={e => set('pant_length_cm', e.target.value)} className={inputClass('pant_length_cm')} />
                  </div>
                </div>
              </div>

              {/* How to measure tip */}
              <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
                <p className="text-xs font-semibold text-blue-800 mb-1">📐 How to measure</p>
                <ul className="text-xs text-blue-700 space-y-1 leading-relaxed">
                  <li><strong>Height:</strong> Stand straight against a wall, measure from floor to top of head</li>
                  <li><strong>Chest:</strong> Measure around the fullest part of the chest, keep tape snug but not tight</li>
                  <li><strong>Shirt length:</strong> From the base of the neck/shoulder down to the hip</li>
                  <li><strong>Pant length:</strong> From the waist down to the ankle bone</li>
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
                    Getting your size...
                  </span>
                ) : 'Get Recommended Size →'}
              </button>

              <p className="text-center text-xs text-gray-400 pb-2">
                Your details are only used for uniform preparation and will not be shared.
              </p>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
