'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { Button, Input, Badge, Spinner, Alert } from '@/UIComponents';
import { apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClassOption {
  id: string;
  name: string;
}

interface Instalment {
  label: string;
  amount: string;
  due_date: string;
}

interface FeeHead {
  name: string;
  type: 'admission' | 'tuition' | 'transport' | 'activity' | 'custom';
  billing_basis: 'per_hour' | 'per_day' | 'per_week' | 'per_month_flat' | 'per_year' | 'per_term';
  pricing_model: 'fixed' | 'instalment';
  amount: string;
  yearly_amount: string;
  term_amount: string;
  instalments: Instalment[];
}

interface FeeWizardProps {
  onSuccess?: (structureId: string) => void;
  onCancel?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FEE_HEAD_TYPES: { value: string; label: string }[] = [
  { value: 'admission', label: 'Admission' },
  { value: 'tuition', label: 'Tuition' },
  { value: 'transport', label: 'Transport' },
  { value: 'activity', label: 'Activity' },
  { value: 'custom', label: 'Custom' },
];

const BILLING_BASIS_OPTIONS: { value: string; label: string }[] = [
  { value: 'per_hour', label: 'Per Hour' },
  { value: 'per_day', label: 'Per Day' },
  { value: 'per_week', label: 'Per Week' },
  { value: 'per_month_flat', label: 'Per Month (Flat)' },
  { value: 'per_year', label: 'Per Year' },
  { value: 'per_term', label: 'Per Term' },
];

const PRICING_MODEL_OPTIONS: { value: string; label: string }[] = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'instalment', label: 'Instalment' },
];

const STEP_LABELS = ['Structure Details', 'Fee Heads', 'Instalment Schedule', 'Review & Save'];

function emptyFeeHead(): FeeHead {
  return {
    name: '',
    type: 'tuition',
    billing_basis: 'per_month_flat',
    pricing_model: 'fixed',
    amount: '',
    yearly_amount: '',
    term_amount: '',
    instalments: [],
  };
}

function emptyInstalment(): Instalment {
  return { label: '', amount: '', due_date: '' };
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              i < current
                ? 'bg-[#1B4332] text-white'
                : i === current
                ? 'bg-[#E8960C] text-white'
                : 'bg-neutral-100 text-neutral-400'
            }`}
          >
            {i < current ? <Check className="w-3.5 h-3.5" /> : i + 1}
          </div>
          <span
            className={`text-xs font-medium hidden sm:block ${
              i === current ? 'text-[#E8960C]' : i < current ? 'text-[#1B4332]' : 'text-neutral-400'
            }`}
          >
            {STEP_LABELS[i]}
          </span>
          {i < total - 1 && <div className="w-6 h-px bg-neutral-200 mx-1" />}
        </div>
      ))}
    </div>
  );
}

// ─── Select helper ────────────────────────────────────────────────────────────

function Select({
  label,
  value,
  onChange,
  options,
  error,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  error?: string;
}) {
  return (
    <div className="w-full">
      {label && <label className="block text-xs font-medium text-neutral-600 mb-1.5">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 py-2.5 text-sm bg-white border rounded-xl text-neutral-800 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 ${
          error ? 'border-red-300' : 'border-neutral-200 hover:border-neutral-300'
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FeeWizard({ onSuccess, onCancel }: FeeWizardProps) {
  const token = getToken() || '';
  const [step, setStep] = useState(0);

  // Step 1 state
  const [name, setName] = useState('');
  const [classId, setClassId] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);

  // Step 2 state
  const [feeHeads, setFeeHeads] = useState<FeeHead[]>([emptyFeeHead()]);

  // Step 4 state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [createdId, setCreatedId] = useState('');

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load classes on mount
  useEffect(() => {
    setClassesLoading(true);
    apiGet<{ classes: ClassOption[] }>('/api/v1/financial/fee-structures/classes', token)
      .then((data) => {
        setClasses(data.classes);
        if (data.classes.length > 0) setClassId(data.classes[0].id);
      })
      .catch(() => {})
      .finally(() => setClassesLoading(false));
  }, [token]);

  // ── Validation ──────────────────────────────────────────────────────────────

  function validateStep1(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!classId) errs.classId = 'Class is required';
    if (!academicYear.trim()) errs.academicYear = 'Academic year is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep2(): boolean {
    const errs: Record<string, string> = {};
    feeHeads.forEach((h, i) => {
      if (!h.name.trim()) errs[`head_${i}_name`] = 'Name is required';
      const needsYearly = h.billing_basis === 'per_year';
      const needsTerm = h.billing_basis === 'per_term';
      if (needsYearly && !h.yearly_amount) errs[`head_${i}_amount`] = 'Yearly amount is required';
      else if (needsTerm && !h.term_amount) errs[`head_${i}_amount`] = 'Term amount is required';
      else if (!needsYearly && !needsTerm && !h.amount) errs[`head_${i}_amount`] = 'Amount is required';
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep3(): boolean {
    const errs: Record<string, string> = {};
    feeHeads.forEach((h, hi) => {
      if (h.pricing_model !== 'instalment') return;
      h.instalments.forEach((ins, ii) => {
        if (!ins.label.trim()) errs[`ins_${hi}_${ii}_label`] = 'Label required';
        if (!ins.amount) errs[`ins_${hi}_${ii}_amount`] = 'Amount required';
        if (!ins.due_date) errs[`ins_${hi}_${ii}_due_date`] = 'Due date required';
      });
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  function handleNext() {
    setErrors({});
    if (step === 0 && !validateStep1()) return;
    if (step === 1 && !validateStep2()) return;
    if (step === 2 && !validateStep3()) return;
    setStep((s) => s + 1);
  }

  function handleBack() {
    setErrors({});
    setStep((s) => s - 1);
  }

  // ── Fee head helpers ─────────────────────────────────────────────────────────

  function updateFeeHead(index: number, patch: Partial<FeeHead>) {
    setFeeHeads((prev) => prev.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  }

  function addFeeHead() {
    setFeeHeads((prev) => [...prev, emptyFeeHead()]);
  }

  function removeFeeHead(index: number) {
    setFeeHeads((prev) => prev.filter((_, i) => i !== index));
  }

  function addInstalment(headIndex: number) {
    setFeeHeads((prev) =>
      prev.map((h, i) =>
        i === headIndex ? { ...h, instalments: [...h.instalments, emptyInstalment()] } : h
      )
    );
  }

  function updateInstalment(headIndex: number, insIndex: number, patch: Partial<Instalment>) {
    setFeeHeads((prev) =>
      prev.map((h, i) =>
        i === headIndex
          ? {
              ...h,
              instalments: h.instalments.map((ins, j) => (j === insIndex ? { ...ins, ...patch } : ins)),
            }
          : h
      )
    );
  }

  function removeInstalment(headIndex: number, insIndex: number) {
    setFeeHeads((prev) =>
      prev.map((h, i) =>
        i === headIndex
          ? { ...h, instalments: h.instalments.filter((_, j) => j !== insIndex) }
          : h
      )
    );
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      // 1. Create fee structure
      const struct = await apiPost<{ id: string }>(
        '/api/v1/financial/fee-structures',
        { name, class_id: classId, academic_year: academicYear },
        token
      );

      // 2. Create each fee head
      for (const head of feeHeads) {
        const payload: Record<string, unknown> = {
          name: head.name,
          type: head.type,
          billing_basis: head.billing_basis,
          pricing_model: head.pricing_model,
        };

        if (head.billing_basis === 'per_year') {
          payload.yearly_amount = parseFloat(head.yearly_amount);
        } else if (head.billing_basis === 'per_term') {
          payload.term_amount = parseFloat(head.term_amount);
        } else {
          payload.amount = parseFloat(head.amount);
        }

        if (head.pricing_model === 'instalment' && head.instalments.length > 0) {
          payload.instalments = head.instalments.map((ins) => ({
            label: ins.label,
            amount: parseFloat(ins.amount),
            due_date: ins.due_date,
          }));
        }

        await apiPost(
          `/api/v1/financial/fee-structures/${struct.id}/fee-heads`,
          payload,
          token
        );
      }

      setCreatedId(struct.id);
      setSubmitSuccess(true);
      onSuccess?.(struct.id);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save fee structure');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render helpers ───────────────────────────────────────────────────────────

  const instalmentHeads = feeHeads.filter((h) => h.pricing_model === 'instalment');
  const selectedClass = classes.find((c) => c.id === classId);

  // ── Steps ────────────────────────────────────────────────────────────────────

  function renderStep1() {
    return (
      <div className="space-y-4">
        <Input
          label="Structure Name"
          placeholder="e.g. Annual Fee 2024-25"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />

        <div className="w-full">
          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Class</label>
          {classesLoading ? (
            <div className="flex items-center gap-2 py-2.5">
              <Spinner size="sm" />
              <span className="text-sm text-neutral-400">Loading classes…</span>
            </div>
          ) : (
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className={`w-full px-3 py-2.5 text-sm bg-white border rounded-xl text-neutral-800 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 ${
                errors.classId ? 'border-red-300' : 'border-neutral-200 hover:border-neutral-300'
              }`}
            >
              <option value="">Select a class…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {errors.classId && <p className="mt-1 text-xs text-red-500">{errors.classId}</p>}
        </div>

        <Input
          label="Academic Year"
          placeholder="e.g. 2024-25"
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          error={errors.academicYear}
          hint="Format: YYYY-YY (e.g. 2024-25)"
        />
      </div>
    );
  }

  function renderStep2() {
    return (
      <div className="space-y-4">
        {feeHeads.map((head, i) => {
          const needsYearly = head.billing_basis === 'per_year';
          const needsTerm = head.billing_basis === 'per_term';
          return (
            <div key={i} className="border border-neutral-200 rounded-xl p-4 space-y-3 bg-neutral-50/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                  Fee Head {i + 1}
                </span>
                {feeHeads.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeFeeHead(i)}
                    className="text-red-400 hover:text-red-600 transition-colors"
                    aria-label="Remove fee head"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <Input
                label="Name"
                placeholder="e.g. Monthly Tuition"
                value={head.name}
                onChange={(e) => updateFeeHead(i, { name: e.target.value })}
                error={errors[`head_${i}_name`]}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  label="Type"
                  value={head.type}
                  onChange={(v) => updateFeeHead(i, { type: v as FeeHead['type'] })}
                  options={FEE_HEAD_TYPES}
                />
                <Select
                  label="Billing Basis"
                  value={head.billing_basis}
                  onChange={(v) => updateFeeHead(i, { billing_basis: v as FeeHead['billing_basis'] })}
                  options={BILLING_BASIS_OPTIONS}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  label="Pricing Model"
                  value={head.pricing_model}
                  onChange={(v) => updateFeeHead(i, { pricing_model: v as FeeHead['pricing_model'] })}
                  options={PRICING_MODEL_OPTIONS}
                />

                {needsYearly ? (
                  <Input
                    label="Yearly Amount (₹)"
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={head.yearly_amount}
                    onChange={(e) => updateFeeHead(i, { yearly_amount: e.target.value })}
                    error={errors[`head_${i}_amount`]}
                  />
                ) : needsTerm ? (
                  <Input
                    label="Term Amount (₹)"
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={head.term_amount}
                    onChange={(e) => updateFeeHead(i, { term_amount: e.target.value })}
                    error={errors[`head_${i}_amount`]}
                  />
                ) : (
                  <Input
                    label="Amount (₹)"
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={head.amount}
                    onChange={(e) => updateFeeHead(i, { amount: e.target.value })}
                    error={errors[`head_${i}_amount`]}
                  />
                )}
              </div>
            </div>
          );
        })}

        <Button
          variant="secondary"
          size="sm"
          icon={<Plus className="w-4 h-4" />}
          onClick={addFeeHead}
          type="button"
        >
          Add Fee Head
        </Button>
      </div>
    );
  }

  function renderStep3() {
    if (instalmentHeads.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-sm text-neutral-500">
            No fee heads with instalment pricing. You can proceed to the next step.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {feeHeads.map((head, hi) => {
          if (head.pricing_model !== 'instalment') return null;
          return (
            <div key={hi} className="border border-neutral-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-neutral-800">{head.name || `Fee Head ${hi + 1}`}</span>
                <Badge label="Instalment" variant="info" size="sm" />
              </div>

              {head.instalments.length === 0 && (
                <p className="text-xs text-neutral-400">No instalments added yet.</p>
              )}

              {head.instalments.map((ins, ii) => (
                <div key={ii} className="bg-neutral-50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-neutral-500">Instalment {ii + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeInstalment(hi, ii)}
                      className="text-red-400 hover:text-red-600 transition-colors"
                      aria-label="Remove instalment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input
                      label="Label"
                      placeholder="e.g. Q1"
                      value={ins.label}
                      onChange={(e) => updateInstalment(hi, ii, { label: e.target.value })}
                      error={errors[`ins_${hi}_${ii}_label`]}
                    />
                    <Input
                      label="Amount (₹)"
                      type="number"
                      min="0"
                      placeholder="0.00"
                      value={ins.amount}
                      onChange={(e) => updateInstalment(hi, ii, { amount: e.target.value })}
                      error={errors[`ins_${hi}_${ii}_amount`]}
                    />
                    <Input
                      label="Due Date"
                      type="date"
                      value={ins.due_date}
                      onChange={(e) => updateInstalment(hi, ii, { due_date: e.target.value })}
                      error={errors[`ins_${hi}_${ii}_due_date`]}
                    />
                  </div>
                </div>
              ))}

              <Button
                variant="secondary"
                size="xs"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => addInstalment(hi)}
                type="button"
              >
                Add Instalment
              </Button>
            </div>
          );
        })}
      </div>
    );
  }

  function renderStep4() {
    if (submitSuccess) {
      return (
        <div className="text-center py-8 space-y-3">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <Check className="w-7 h-7 text-emerald-600" />
          </div>
          <p className="text-base font-semibold text-neutral-800">Fee structure created!</p>
          <p className="text-sm text-neutral-500">
            <span className="font-medium">{name}</span> has been saved successfully.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Summary</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <span className="text-neutral-500">Structure Name</span>
            <span className="font-medium text-neutral-800">{name}</span>
            <span className="text-neutral-500">Class</span>
            <span className="font-medium text-neutral-800">{selectedClass?.name ?? '—'}</span>
            <span className="text-neutral-500">Academic Year</span>
            <span className="font-medium text-neutral-800">{academicYear}</span>
            <span className="text-neutral-500">Fee Heads</span>
            <span className="font-medium text-neutral-800">{feeHeads.length}</span>
          </div>
        </div>

        <div className="space-y-2">
          {feeHeads.map((h, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 bg-white border border-neutral-100 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-neutral-800">{h.name}</span>
                <Badge label={h.type} variant="neutral" size="sm" />
                {h.pricing_model === 'instalment' && (
                  <Badge label={`${h.instalments.length} instalments`} variant="info" size="sm" />
                )}
              </div>
              <span className="text-sm font-semibold text-[#1B4332]">
                {h.billing_basis === 'per_year'
                  ? `₹${h.yearly_amount}/yr`
                  : h.billing_basis === 'per_term'
                  ? `₹${h.term_amount}/term`
                  : `₹${h.amount}`}
              </span>
            </div>
          ))}
        </div>

        {submitError && (
          <Alert variant="danger" message={submitError} />
        )}
      </div>
    );
  }

  // ── Layout ───────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-2xl mx-auto">
      <StepIndicator current={step} total={4} />

      <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <h2 className="text-base font-semibold text-neutral-900">{STEP_LABELS[step]}</h2>
          <p className="text-xs text-neutral-500 mt-0.5">Step {step + 1} of 4</p>
        </div>

        <div className="px-5 py-5">
          {step === 0 && renderStep1()}
          {step === 1 && renderStep2()}
          {step === 2 && renderStep3()}
          {step === 3 && renderStep4()}
        </div>

        <div className="px-5 pb-5 pt-2 border-t border-neutral-100 flex items-center justify-between gap-2">
          <div>
            {onCancel && step === 0 && (
              <Button variant="secondary" size="sm" onClick={onCancel} type="button">
                Cancel
              </Button>
            )}
            {step > 0 && !submitSuccess && (
              <Button
                variant="secondary"
                size="sm"
                icon={<ChevronLeft className="w-4 h-4" />}
                onClick={handleBack}
                type="button"
              >
                Back
              </Button>
            )}
          </div>

          <div>
            {step < 3 && (
              <Button
                variant="primary"
                size="sm"
                icon={<ChevronRight className="w-4 h-4" />}
                iconPosition="right"
                onClick={handleNext}
                type="button"
              >
                Next
              </Button>
            )}
            {step === 3 && !submitSuccess && (
              <Button
                variant="primary"
                size="sm"
                loading={submitting}
                onClick={handleSubmit}
                type="button"
              >
                Save Fee Structure
              </Button>
            )}
            {submitSuccess && (
              <Button variant="success" size="sm" onClick={() => onSuccess?.(createdId)} type="button">
                Done
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default FeeWizard;
