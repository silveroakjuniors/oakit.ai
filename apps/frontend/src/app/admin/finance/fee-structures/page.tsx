'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Card, Button } from '@/components/ui';

type BillingBasis =
  | 'per_hour'
  | 'per_day'
  | 'per_week'
  | 'per_month_flat'
  | 'per_year'
  | 'per_term';

interface FeeHead {
  id: string;
  name: string;
  type: string;
  billing_basis: BillingBasis;
  rate?: number;
  hours_per_day?: number;
  days_per_week?: number;
  amount?: number;
  calculated_monthly_fee?: number;
  rounded_monthly_fee?: number;
  pricing_model: string;
  instalment_count?: number;
  class_id?: string;
  class_name?: string;
  students_assigned?: number;
  students_total?: number;
  payments_count?: number;
}

interface FeeStructure {
  id: string;
  name: string;
  academic_year: string;
  is_active: boolean;
  fee_heads?: FeeHead[];
  fee_head_count?: number;
}

interface ClassOption {
  id: string;
  name: string;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

export default function FeeStructuresPage() {
  const token = getToken() || '';

  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<ClassOption[]>([]);

  // Create structure form
  const [showCreate, setShowCreate] = useState(false);
  const [structureName, setStructureName] = useState('');
  const [academicYear, setAcademicYear] = useState(
    `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
  );
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Fee wizard — scoped to a specific structure
  const [wizardStructureId, setWizardStructureId] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [feeHeadName, setFeeHeadName] = useState('');
  const [feeHeadType, setFeeHeadType] = useState('tuition');
  const [billingBasis, setBillingBasis] = useState<BillingBasis>('per_month_flat');
  const [rate, setRate] = useState('');
  const [hoursPerDay, setHoursPerDay] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState('');
  const [calculatedFee, setCalculatedFee] = useState<number | null>(null);
  const [roundOff, setRoundOff] = useState(false);
  const [roundedFee, setRoundedFee] = useState('');
  const [pricingModel, setPricingModel] = useState('fixed');
  const [instalmentCount, setInstalmentCount] = useState('');
  const [instalmentRows, setInstalmentRows] = useState<
    { label: string; amount: string; due_date: string }[]
  >([]);
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardError, setWizardError] = useState('');
  const [yearlyAmount, setYearlyAmount] = useState('');
  const [termAmount, setTermAmount] = useState('');
  const [termCount, setTermCount] = useState('');
  const [availableTerms, setAvailableTerms] = useState<
    { term_name: string; start_date: string; end_date: string }[]
  >([]);
  const [annualEquivalent, setAnnualEquivalent] = useState<number | null>(null);

  // Assign class — scoped to a specific fee head (tuition/admission only)
  const [assignHead, setAssignHead] = useState<{
    structureId: string;
    headId: string;
    headName: string;
    feeType: string;
  } | null>(null);
  const [assignClassId, setAssignClassId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignMsg, setAssignMsg] = useState('');

  // Assign students — for non-tuition fee heads
  const [assignStudentsHead, setAssignStudentsHead] = useState<{
    structureId: string;
    headId: string;
    headName: string;
    classId: string;   // pre-selected class to filter students
  } | null>(null);
  const [studentList, setStudentList] = useState<{
    id: string; name: string; section_label: string; is_assigned: boolean;
  }[]>([]);
  const [studentPickerClassId, setStudentPickerClassId] = useState('');
  const [studentPickerLoading, setStudentPickerLoading] = useState(false);
  const [studentPickerMsg, setStudentPickerMsg] = useState('');
  const [togglingStudentId, setTogglingStudentId] = useState<string | null>(null);

  // Unassign class confirmation
  const [unassignHead, setUnassignHead] = useState<{
    structureId: string;
    headId: string;
    headName: string;
    className: string;
  } | null>(null);
  const [unassignLoading, setUnassignLoading] = useState(false);
  const [unassignError, setUnassignError] = useState('');

  // Delete confirmations
  const [deleteStructureId, setDeleteStructureId] = useState<string | null>(null);
  const [deleteStructureError, setDeleteStructureError] = useState('');
  const [deleteHeadId, setDeleteHeadId] = useState<string | null>(null);
  const [deleteHeadStructureId, setDeleteHeadStructureId] = useState<string | null>(null);
  const [deleteHeadError, setDeleteHeadError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    loadStructures();
  }, []);

  async function loadStructures() {
    setLoading(true);
    try {
      const data = await apiGet<FeeStructure[]>('/api/v1/financial/fee-structures', token);
      setStructures(Array.isArray(data) ? data : []);
    } catch {
      setStructures([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadClasses(structureId?: string) {
    try {
      const url = structureId
        ? `/api/v1/financial/fee-structures/classes?structure_id=${encodeURIComponent(structureId)}`
        : '/api/v1/financial/fee-structures/classes';
      const data = await apiGet<ClassOption[]>(url, token);
      setClasses(Array.isArray(data) ? data : []);
    } catch {
      setClasses([]);
    }
  }

  async function loadStudentsForHead(classId: string, headId: string) {
    setStudentPickerLoading(true);
    try {
      const data = await apiGet<{ id: string; name: string; section_label: string; is_assigned: boolean }[]>(
        `/api/v1/financial/fee-structures/students?class_id=${encodeURIComponent(classId)}&head_id=${encodeURIComponent(headId)}`,
        token
      );
      setStudentList(data);
    } catch {
      setStudentList([]);
    } finally {
      setStudentPickerLoading(false);
    }
  }

  async function handleToggleStudent(student: { id: string; is_assigned: boolean }) {
    if (!assignStudentsHead) return;
    setTogglingStudentId(student.id);
    setStudentPickerMsg('');
    try {
      if (student.is_assigned) {
        await apiDelete(
          `/api/v1/financial/fee-structures/${assignStudentsHead.structureId}/fee-heads/${assignStudentsHead.headId}/unassign-student/${student.id}`,
          token
        );
      } else {
        await apiPost(
          `/api/v1/financial/fee-structures/${assignStudentsHead.structureId}/fee-heads/${assignStudentsHead.headId}/assign-student`,
          { student_id: student.id },
          token
        );
      }
      // Refresh the list
      await loadStudentsForHead(studentPickerClassId, assignStudentsHead.headId);
      await loadStructures();
    } catch (err: unknown) {
      setStudentPickerMsg(err instanceof Error ? err.message : 'Failed to update.');
    } finally {
      setTogglingStudentId(null);
    }
  }

  async function loadTerms(academicYearParam?: string) {
    try {
      const url = academicYearParam
        ? `/api/v1/financial/fee-structures/fee-wizard/terms?academic_year=${encodeURIComponent(academicYearParam)}`
        : '/api/v1/financial/fee-structures/fee-wizard/terms';
      const data = await apiGet<{
        terms: { term_name: string; start_date: string; end_date: string }[];
        term_count: number;
      }>(url, token);
      setAvailableTerms(data.terms || []);
      if (data.term_count > 0) setTermCount(String(data.term_count));
    } catch {
      setAvailableTerms([]);
    }
  }

  async function handleCreateStructure() {
    setCreateError('');
    if (!structureName.trim()) {
      setCreateError('Enter a name.');
      return;
    }
    setCreateLoading(true);
    try {
      await apiPost(
        '/api/v1/financial/fee-structures',
        { name: structureName.trim(), academic_year: academicYear },
        token
      );
      setStructureName('');
      setShowCreate(false);
      await loadStructures();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create.');
    } finally {
      setCreateLoading(false);
    }
  }

  const isLumpSumBasis = billingBasis === 'per_year' || billingBasis === 'per_term';

  // Fee types that assign to a whole class vs individual students
  const CLASS_ASSIGN_TYPES = ['tuition', 'admission'];

  async function handleWizardCalculate() {
    setWizardError('');
    setWizardLoading(true);
    try {
      const body: Record<string, unknown> = { billing_basis: billingBasis };
      if (billingBasis === 'per_year') {
        body.yearly_amount = parseFloat(yearlyAmount) || 0;
      } else if (billingBasis === 'per_term') {
        body.term_amount = parseFloat(termAmount) || 0;
        body.term_count = parseInt(termCount) || 0;
      } else {
        body.rate = parseFloat(rate) || 0;
        if (billingBasis === 'per_hour') {
          body.hours_per_day = parseFloat(hoursPerDay) || undefined;
          body.days_per_week = parseFloat(daysPerWeek) || undefined;
        }
        if (billingBasis === 'per_day') {
          body.days_per_week = parseFloat(daysPerWeek) || undefined;
        }
      }

      const result = await apiPost<{
        calculated_monthly_fee: number;
        formula_description: string;
        annual_equivalent: number;
        amount: number;
        is_lump_sum: boolean;
        billing_label: string;
      }>('/api/v1/financial/fee-structures/fee-wizard/calculate', body, token);

      setCalculatedFee(result.calculated_monthly_fee);
      setAnnualEquivalent(
        result.annual_equivalent ?? result.calculated_monthly_fee * 12
      );
      setRoundedFee(Math.round(result.calculated_monthly_fee).toString());
      setWizardStep(4);
    } catch (err: unknown) {
      setWizardError(err instanceof Error ? err.message : 'Calculation failed.');
    } finally {
      setWizardLoading(false);
    }
  }

  async function handleSaveFeeHead() {
    if (!wizardStructureId) return;
    setWizardError('');
    setWizardLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: feeHeadName,
        type: feeHeadType,
        billing_basis: billingBasis,
        pricing_model: pricingModel,
      };

      if (billingBasis === 'per_year') {
        body.yearly_amount = parseFloat(yearlyAmount);
        body.amount = parseFloat(yearlyAmount);
      } else if (billingBasis === 'per_term') {
        body.term_amount = parseFloat(termAmount);
        body.term_count = parseInt(termCount) || undefined;
        body.amount = parseFloat(termAmount);
      } else {
        body.rate = parseFloat(rate) || 0;
        body.hours_per_day = parseFloat(hoursPerDay) || undefined;
        body.days_per_week = parseFloat(daysPerWeek) || undefined;
        body.calculated_monthly_fee = calculatedFee;
        body.rounded_monthly_fee = roundOff ? parseFloat(roundedFee) : undefined;
        body.amount = roundOff ? parseFloat(roundedFee) : calculatedFee;
      }

      if (pricingModel === 'instalment') {
        body.instalment_count = instalmentRows.length;
        body.instalments = instalmentRows.map(r => ({
          label: r.label.trim(),
          amount: parseFloat(r.amount),
          due_date: r.due_date,
        }));
      }

      const newHead = await apiPost<{ id: string }>(
        `/api/v1/financial/fee-structures/${wizardStructureId}/fee-heads`,
        body,
        token
      );

      resetWizard();
      await loadStructures();
    } catch (err: unknown) {
      setWizardError(err instanceof Error ? err.message : 'Failed to save fee head.');
    } finally {
      setWizardLoading(false);
    }
  }

  function resetWizard() {
    setWizardStructureId(null);
    setWizardStep(1);
    setFeeHeadName('');
    setFeeHeadType('tuition');
    setBillingBasis('per_month_flat');
    setRate('');
    setHoursPerDay('');
    setDaysPerWeek('');
    setYearlyAmount('');
    setTermAmount('');
    setTermCount('');
    setCalculatedFee(null);
    setAnnualEquivalent(null);
    setRoundOff(false);
    setRoundedFee('');
    setPricingModel('fixed');
    setInstalmentCount('');
    setInstalmentRows([]);
    setWizardError('');
  }

  async function handleAssignClass() {
    if (!assignHead || !assignClassId) return;
    setAssignLoading(true);
    setAssignMsg('');
    try {
      await apiPost(
        `/api/v1/financial/fee-structures/${assignHead.structureId}/fee-heads/${assignHead.headId}/assign-class`,
        { class_id: assignClassId },
        token
      );
      setAssignHead(null);
      setAssignClassId('');
      await loadStructures();
    } catch (err: unknown) {
      setAssignMsg(err instanceof Error ? err.message : 'Failed to assign.');
    } finally {
      setAssignLoading(false);
    }
  }

  async function handleUnassignClass() {
    if (!unassignHead) return;
    setUnassignLoading(true);
    setUnassignError('');
    try {
      await apiDelete(
        `/api/v1/financial/fee-structures/${unassignHead.structureId}/fee-heads/${unassignHead.headId}/unassign-class`,
        token
      );
      setUnassignHead(null);
      await loadStructures();
    } catch (err: unknown) {
      setUnassignError(err instanceof Error ? err.message : 'Failed to unassign.');
    } finally {
      setUnassignLoading(false);
    }
  }

  async function handleDeleteStructure() {
    if (!deleteStructureId) return;
    setDeleteStructureError('');
    setDeleteLoading(true);
    try {
      await apiDelete(`/api/v1/financial/fee-structures/${deleteStructureId}`, token);
      setDeleteStructureId(null);
      await loadStructures();
    } catch (err: unknown) {
      setDeleteStructureError(
        err instanceof Error ? err.message : 'Failed to delete structure.'
      );
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleDeleteFeeHead() {
    if (!deleteHeadId || !deleteHeadStructureId) return;
    setDeleteHeadError('');
    setDeleteLoading(true);
    try {
      await apiDelete(
        `/api/v1/financial/fee-structures/${deleteHeadStructureId}/fee-heads/${deleteHeadId}`,
        token
      );
      setDeleteHeadId(null);
      setDeleteHeadStructureId(null);
      await loadStructures();
    } catch (err: unknown) {
      setDeleteHeadError(
        err instanceof Error ? err.message : 'Failed to delete fee head.'
      );
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-primary">Fee Structures</h1>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : '+ New Structure'}
        </Button>
      </div>

      {/* ── Create structure ─────────────────────────────────────────────── */}
      {showCreate && (
        <Card className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">New Fee Structure</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="e.g. 2024-25 Fee Plan"
                value={structureName}
                onChange={e => setStructureName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateStructure()}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Academic Year
              </label>
              <input
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="2024-2025"
                value={academicYear}
                onChange={e => setAcademicYear(e.target.value)}
              />
            </div>
          </div>
          {createError && <p className="text-xs text-red-500 mt-3">{createError}</p>}
          <div className="mt-4">
            <Button onClick={handleCreateStructure} disabled={createLoading}>
              {createLoading ? 'Creating…' : 'Create Structure'}
            </Button>
          </div>
        </Card>
      )}

      {/* ── Structures list ───────────────────────────────────────────────── */}
      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>
      ) : (
        <div className="space-y-4">
          {structures.map(s => (
            <Card key={s.id} padding="sm">
              {/* Structure header */}
              <div className="flex items-center justify-between px-2 py-2">
                <div>
                  <p className="font-semibold text-gray-800">{s.name}</p>
                  <span className="text-xs text-gray-500">{s.academic_year}</span>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  <button
                    onClick={() => {
                      setWizardStructureId(s.id);
                      setWizardStep(1);
                      setWizardError('');
                      loadTerms(s.academic_year);
                    }}
                    className="text-xs px-3 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20"
                  >
                    + Fee Type
                  </button>
                  <button
                    onClick={() => {
                      setDeleteStructureId(s.id);
                      setDeleteStructureError('');
                    }}
                    className="text-xs px-3 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Fee heads */}
              {s.fee_heads && s.fee_heads.length > 0 && (
                <div className="mt-2 px-2 space-y-1">
                  {s.fee_heads.map(fh => {
                    const isYearly = fh.billing_basis === 'per_year';
                    const isTerm = fh.billing_basis === 'per_term';
                    const displayAmount = isYearly
                      ? fh.amount ?? 0
                      : isTerm
                      ? fh.amount ?? 0
                      : fh.rounded_monthly_fee ?? fh.calculated_monthly_fee ?? fh.rate ?? 0;
                    const label = isYearly ? '/yr' : isTerm ? '/term' : '/mo';

                    return (
                      <div
                        key={fh.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-gray-50 text-sm"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-700">{fh.name}</span>
                          <span className="text-xs text-gray-400 capitalize">{fh.type}</span>
                          {/* Class badge per fee head */}
                          {fh.class_name ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                              {fh.class_name}
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                              No class
                            </span>
                          )}
                          {/* Student coverage count — only shown when a class is assigned */}
                          {fh.class_id && (
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                fh.students_total && fh.students_assigned === fh.students_total
                                  ? 'bg-green-50 text-green-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {fh.students_assigned ?? 0}/{fh.students_total ?? 0} students
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-xs">
                            ₹{Number(displayAmount).toLocaleString('en-IN')}
                            {label}
                          </span>
                          {/* Assign / Unassign per fee head */}
                          {fh.class_id ? (
                            <button
                              onClick={() =>
                                setUnassignHead({
                                  structureId: s.id,
                                  headId: fh.id,
                                  headName: fh.name,
                                  className: fh.class_name ?? '',
                                })
                              }
                              className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700 hover:bg-amber-100"
                              title={CLASS_ASSIGN_TYPES.includes(fh.type) ? 'Unassign class' : 'Manage students'}
                            >
                              {CLASS_ASSIGN_TYPES.includes(fh.type) ? 'Unassign' : 'Students'}
                            </button>
                          ) : CLASS_ASSIGN_TYPES.includes(fh.type) ? (
                            <button
                              onClick={() => {
                                setAssignHead({
                                  structureId: s.id,
                                  headId: fh.id,
                                  headName: fh.name,
                                  feeType: fh.type,
                                });
                                setAssignClassId('');
                                setAssignMsg('');
                                loadClasses(s.id);
                              }}
                              className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100"
                              title="Assign to class"
                            >
                              Assign Class
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setStudentPickerClassId('');
                                setStudentList([]);
                                setStudentPickerMsg('');
                                setAssignStudentsHead({
                                  structureId: s.id,
                                  headId: fh.id,
                                  headName: fh.name,
                                  classId: '',
                                });
                                loadClasses(); // no filter — show all classes
                              }}
                              className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100"
                              title="Assign to students"
                            >
                              Assign Students
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setDeleteHeadId(fh.id);
                              setDeleteHeadStructureId(s.id);
                              setDeleteHeadError('');
                            }}
                            className={`text-xs px-2 py-0.5 rounded hover:bg-red-50 ${
                              (fh.payments_count ?? 0) > 0
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-red-400 hover:text-red-600'
                            }`}
                            title={
                              (fh.payments_count ?? 0) > 0
                                ? `Cannot delete — ${fh.payments_count} payment${fh.payments_count === 1 ? '' : 's'} collected`
                                : 'Delete fee type'
                            }
                            disabled={(fh.payments_count ?? 0) > 0}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          ))}
          {structures.length === 0 && (
            <p className="text-center text-gray-400 py-8">
              No fee structures yet. Create one above.
            </p>
          )}
        </div>
      )}

      {/* ── Fee wizard modal ─────────────────────────────────────────────── */}
      {wizardStructureId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">
                Add Fee Type — Step {wizardStep} of 5
              </h2>
              <button
                onClick={resetWizard}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {wizardError && (
                <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
                  {wizardError}
                </p>
              )}

              {/* Step 1 — Name & Type */}
              {wizardStep === 1 && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Fee Head Name
                    </label>
                    <input
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="e.g. Tuition Fee"
                      value={feeHeadName}
                      onChange={e => setFeeHeadName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Type
                    </label>
                    <select
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={feeHeadType}
                      onChange={e => setFeeHeadType(e.target.value)}
                    >
                      <option value="tuition">Tuition</option>
                      <option value="admission">Admission</option>
                      <option value="transport">Transport</option>
                      <option value="activity">Activity</option>
                      <option value="daycare">Daycare</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!feeHeadName.trim()) {
                          setWizardError('Enter a fee head name.');
                          return;
                        }
                        // Check for duplicate name within this structure
                        const currentStructure = structures.find(s => s.id === wizardStructureId);
                        const duplicate = currentStructure?.fee_heads?.some(
                          fh => fh.name.trim().toLowerCase() === feeHeadName.trim().toLowerCase()
                        );
                        if (duplicate) {
                          setWizardError(`A fee type named "${feeHeadName.trim()}" already exists in this structure.`);
                          return;
                        }
                        setWizardError('');
                        setWizardStep(2);
                      }}
                    >
                      Next →
                    </Button>
                  </div>
                </>
              )}

              {/* Step 2 — Billing Basis */}
              {wizardStep === 2 && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Billing Basis
                    </label>
                    <select
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={billingBasis}
                      onChange={e => {
                        setBillingBasis(e.target.value as BillingBasis);
                        if (
                          e.target.value === 'per_year' ||
                          e.target.value === 'per_term'
                        ) {
                          const struct = structures.find(
                            s => s.id === wizardStructureId
                          );
                          loadTerms(struct?.academic_year);
                        }
                      }}
                    >
                      <option value="per_month_flat">Per Month (flat)</option>
                      <option value="per_hour">Per Hour</option>
                      <option value="per_day">Per Day</option>
                      <option value="per_week">Per Week</option>
                      <option value="per_year">Per Year (lump sum)</option>
                      <option value="per_term">Per Term (lump sum)</option>
                    </select>
                  </div>

                  {/* Rate inputs for non-lump-sum */}
                  {!isLumpSumBasis && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Rate (₹)
                        </label>
                        <input
                          type="number"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                          placeholder="0"
                          value={rate}
                          onChange={e => setRate(e.target.value)}
                        />
                      </div>
                      {(billingBasis === 'per_hour' ||
                        billingBasis === 'per_day') && (
                        <div className="grid grid-cols-2 gap-3">
                          {billingBasis === 'per_hour' && (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Hours / Day
                              </label>
                              <input
                                type="number"
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                placeholder="0"
                                value={hoursPerDay}
                                onChange={e => setHoursPerDay(e.target.value)}
                              />
                            </div>
                          )}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Days / Week
                            </label>
                            <input
                              type="number"
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                              placeholder="0"
                              value={daysPerWeek}
                              onChange={e => setDaysPerWeek(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Lump-sum inputs */}
                  {billingBasis === 'per_year' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Yearly Amount (₹)
                      </label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="0"
                        value={yearlyAmount}
                        onChange={e => setYearlyAmount(e.target.value)}
                      />
                    </div>
                  )}
                  {billingBasis === 'per_term' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Amount per Term (₹)
                        </label>
                        <input
                          type="number"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                          placeholder="0"
                          value={termAmount}
                          onChange={e => setTermAmount(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          No. of Terms
                        </label>
                        <input
                          type="number"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                          placeholder={availableTerms.length > 0 ? String(availableTerms.length) : '3'}
                          value={termCount}
                          onChange={e => setTermCount(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between pt-2">
                    <Button size="sm" variant="ghost" onClick={() => setWizardStep(1)}>
                      ← Back
                    </Button>
                    <Button size="sm" onClick={handleWizardCalculate} disabled={wizardLoading}>
                      {wizardLoading ? 'Calculating…' : 'Calculate →'}
                    </Button>
                  </div>
                </>
              )}

              {/* Step 3 — Pricing model */}
              {wizardStep === 3 && (() => {
                // Total fee this fee head must sum to
                const totalFee =
                  billingBasis === 'per_year'
                    ? parseFloat(yearlyAmount) || 0
                    : billingBasis === 'per_term'
                    ? (parseFloat(termAmount) || 0) * (parseInt(termCount) || 0)
                    : roundOff
                    ? parseFloat(roundedFee) || 0
                    : calculatedFee ?? 0;

                const allocatedSum = instalmentRows.reduce(
                  (sum, r) => sum + (parseFloat(r.amount) || 0),
                  0
                );
                const pending = totalFee - allocatedSum;
                const isBalanced = Math.abs(pending) < 0.01; // float tolerance
                const isOver = pending < -0.01;

                return (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Pricing Model
                      </label>
                      <select
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        value={pricingModel}
                        onChange={e => {
                          setPricingModel(e.target.value);
                          if (e.target.value === 'instalment') {
                            const count = parseInt(instalmentCount) || 2;
                            setInstalmentRows(
                              Array.from({ length: count }, (_, i) => ({
                                label: `Instalment ${i + 1}`,
                                amount: '',
                                due_date: '',
                              }))
                            );
                          }
                        }}
                      >
                        <option value="fixed">
                          {isLumpSumBasis ? 'Fixed (full amount)' : 'Fixed (monthly)'}
                        </option>
                        <option value="instalment">Instalment schedule</option>
                      </select>
                    </div>

                    {pricingModel === 'instalment' && (
                      <div className="space-y-3">
                        {/* Total fee reference + live balance */}
                        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs">
                          <span className="text-gray-500">
                            Total fee&nbsp;
                            <span className="font-semibold text-gray-700">
                              ₹{totalFee.toLocaleString('en-IN')}
                            </span>
                          </span>
                          <span
                            className={
                              isBalanced
                                ? 'font-semibold text-green-600'
                                : isOver
                                ? 'font-semibold text-red-500'
                                : 'font-semibold text-amber-600'
                            }
                          >
                            {isBalanced
                              ? '✓ Balanced'
                              : isOver
                              ? `Over by ₹${Math.abs(pending).toLocaleString('en-IN')}`
                              : `Pending ₹${pending.toLocaleString('en-IN')}`}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="text-xs font-medium text-gray-600">
                            Number of instalments
                          </label>
                          <input
                            type="number"
                            className="w-20 px-2 py-1 rounded border border-gray-300 text-sm"
                            value={instalmentCount}
                            onChange={e => {
                              setInstalmentCount(e.target.value);
                              const count = parseInt(e.target.value) || 0;
                              setInstalmentRows(
                                Array.from({ length: count }, (_, i) => ({
                                  label: instalmentRows[i]?.label ?? `Instalment ${i + 1}`,
                                  amount: instalmentRows[i]?.amount ?? '',
                                  due_date: instalmentRows[i]?.due_date ?? '',
                                }))
                              );
                            }}
                            min={1}
                          />
                        </div>

                        {instalmentRows.map((row, idx) => {
                          const rowAmt = parseFloat(row.amount) || 0;
                          // Running sum up to this row (excluding current)
                          const sumBefore = instalmentRows
                            .slice(0, idx)
                            .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
                          const maxForRow = totalFee - sumBefore;
                          const rowOver = rowAmt > maxForRow + 0.01;

                          return (
                            <div key={idx} className="space-y-1">
                              <div className="grid grid-cols-3 gap-2">
                                <input
                                  className="px-2 py-1 rounded border border-gray-300 text-xs"
                                  placeholder={`Label ${idx + 1}`}
                                  value={row.label}
                                  onChange={e => {
                                    const updated = [...instalmentRows];
                                    updated[idx] = { ...updated[idx], label: e.target.value };
                                    setInstalmentRows(updated);
                                  }}
                                />
                                <input
                                  type="number"
                                  className={`px-2 py-1 rounded border text-xs ${
                                    rowOver
                                      ? 'border-red-400 bg-red-50'
                                      : 'border-gray-300'
                                  }`}
                                  placeholder="Amount"
                                  value={row.amount}
                                  max={maxForRow}
                                  onChange={e => {
                                    const updated = [...instalmentRows];
                                    updated[idx] = { ...updated[idx], amount: e.target.value };
                                    setInstalmentRows(updated);
                                  }}
                                />
                                <input
                                  type="date"
                                  className="px-2 py-1 rounded border border-gray-300 text-xs"
                                  value={row.due_date}
                                  onChange={e => {
                                    const updated = [...instalmentRows];
                                    updated[idx] = { ...updated[idx], due_date: e.target.value };
                                    setInstalmentRows(updated);
                                  }}
                                />
                              </div>
                              {rowOver && (
                                <p className="text-xs text-red-500 pl-1">
                                  Max allowed: ₹{maxForRow.toLocaleString('en-IN')}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex justify-between pt-2">
                      <Button size="sm" variant="ghost" onClick={() => setWizardStep(4)}>
                        ← Back
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (pricingModel === 'instalment' && !isBalanced) {
                            setWizardError(
                              isOver
                                ? `Instalments exceed total fee by ₹${Math.abs(pending).toLocaleString('en-IN')}. Reduce instalment amounts.`
                                : `₹${pending.toLocaleString('en-IN')} still unallocated. Instalment amounts must add up to ₹${totalFee.toLocaleString('en-IN')}.`
                            );
                            return;
                          }
                          setWizardError('');
                          setWizardStep(5);
                        }}
                      >
                        Next →
                      </Button>
                    </div>
                  </>
                );
              })()}

              {/* Step 4 — Review calculated fee */}
              {wizardStep === 4 && (
                <>
                  {isLumpSumBasis ? (
                    <div className="bg-primary/5 rounded-xl p-4 space-y-1">
                      <p className="text-sm font-medium text-gray-700">
                        {billingBasis === 'per_year' ? 'Yearly Amount' : 'Amount per Term'}
                      </p>
                      <p className="text-2xl font-bold text-primary">
                        ₹
                        {Number(
                          billingBasis === 'per_year' ? yearlyAmount : termAmount
                        ).toLocaleString('en-IN')}
                      </p>
                      {billingBasis === 'per_term' && termCount && (
                        <p className="text-xs text-gray-500">
                          {termCount} terms · Total ₹
                          {Number(
                            parseFloat(termAmount || '0') * parseInt(termCount)
                          ).toLocaleString('en-IN')}
                        </p>
                      )}
                    </div>
                  ) : (
                    calculatedFee !== null && (
                      <div className="bg-primary/5 rounded-xl p-4 space-y-2">
                        <p className="text-sm font-medium text-gray-700">
                          Calculated Monthly Fee
                        </p>
                        <p className="text-2xl font-bold text-primary">
                          ₹{Number(calculatedFee).toLocaleString('en-IN')}
                        </p>
                        {annualEquivalent !== null && (
                          <p className="text-xs text-gray-500">
                            Annual equivalent: ₹{Number(annualEquivalent).toLocaleString('en-IN')}
                          </p>
                        )}
                      </div>
                    )
                  )}

                  {!isLumpSumBasis && (
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="roundOff"
                        checked={roundOff}
                        onChange={e => setRoundOff(e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="roundOff" className="text-sm text-gray-600">
                        Round off to
                      </label>
                      <input
                        type="number"
                        className="w-28 px-2 py-1 rounded border border-gray-300 text-sm"
                        value={roundedFee}
                        onChange={e => setRoundedFee(e.target.value)}
                        disabled={!roundOff}
                      />
                    </div>
                  )}

                  <div className="flex justify-between pt-2">
                    <Button size="sm" variant="ghost" onClick={() => setWizardStep(2)}>
                      ← Back
                    </Button>
                    <Button size="sm" onClick={() => setWizardStep(3)}>
                      Next →
                    </Button>
                  </div>
                </>
              )}

              {/* Step 5 — Save */}
              {wizardStep === 5 && (
                <>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Name</span>
                      <span className="font-medium">{feeHeadName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Type</span>
                      <span className="capitalize">{feeHeadType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Billing</span>
                      <span>{billingBasis.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Pricing</span>
                      <span className="capitalize">{pricingModel}</span>
                    </div>
                    {!isLumpSumBasis && calculatedFee !== null && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Monthly Fee</span>
                        <span className="font-semibold text-primary">
                          ₹
                          {Number(
                            roundOff ? roundedFee : calculatedFee
                          ).toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                    {billingBasis === 'per_year' && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Yearly Amount</span>
                        <span className="font-semibold text-primary">
                          ₹{Number(yearlyAmount).toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                    {billingBasis === 'per_term' && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Per Term</span>
                        <span className="font-semibold text-primary">
                          ₹{Number(termAmount).toLocaleString('en-IN')} × {termCount}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between pt-2">
                    <Button size="sm" variant="ghost" onClick={() => setWizardStep(3)}>
                      ← Back
                    </Button>
                    <Button size="sm" onClick={handleSaveFeeHead} disabled={wizardLoading}>
                      {wizardLoading ? 'Saving…' : 'Save Fee Type'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Assign class modal (tuition / admission only) ──────────────── */}
      {assignHead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="font-semibold text-gray-800 mb-4">
              Assign Class — {assignHead.headName}
            </h2>
            <select
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={assignClassId}
              onChange={e => setAssignClassId(e.target.value)}
            >
              <option value="">Select a class…</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {assignMsg && (
              <p className="text-xs text-red-500 mb-3">{assignMsg}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAssignHead(null);
                  setAssignClassId('');
                  setAssignMsg('');
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAssignClass}
                disabled={assignLoading || !assignClassId}
              >
                {assignLoading ? 'Assigning…' : 'Assign'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign students modal (transport / activity / daycare / custom) ── */}
      {assignStudentsHead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 shrink-0">
              <h2 className="font-semibold text-gray-800">
                Assign Students — {assignStudentsHead.headName}
              </h2>
              <button
                onClick={() => { setAssignStudentsHead(null); setStudentList([]); }}
                className="text-gray-400 hover:text-gray-600"
              >✕</button>
            </div>

            <div className="px-6 py-4 shrink-0">
              <label className="block text-xs font-medium text-gray-600 mb-1">Filter by class</label>
              <select
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={studentPickerClassId}
                onChange={e => {
                  setStudentPickerClassId(e.target.value);
                  if (e.target.value) {
                    loadStudentsForHead(e.target.value, assignStudentsHead.headId);
                  } else {
                    setStudentList([]);
                  }
                }}
              >
                <option value="">Select a class…</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {studentPickerMsg && (
              <p className="text-xs text-red-500 px-6 pb-2">{studentPickerMsg}</p>
            )}

            <div className="flex-1 overflow-y-auto px-6 pb-4">
              {studentPickerLoading ? (
                <p className="text-sm text-gray-400 text-center py-6">Loading…</p>
              ) : studentList.length === 0 && studentPickerClassId ? (
                <p className="text-sm text-gray-400 text-center py-6">No students in this class.</p>
              ) : studentList.length === 0 ? null : (
                <div className="space-y-1">
                  {/* Select all / deselect all */}
                  <div className="flex items-center justify-between py-2 border-b border-gray-100 mb-2">
                    <span className="text-xs text-gray-500">
                      {studentList.filter(s => s.is_assigned).length}/{studentList.length} assigned
                    </span>
                    <div className="flex gap-2">
                      <button
                        className="text-xs text-primary hover:underline"
                        onClick={async () => {
                          for (const s of studentList.filter(s => !s.is_assigned)) {
                            await handleToggleStudent(s);
                          }
                        }}
                      >
                        Assign all
                      </button>
                      <button
                        className="text-xs text-red-500 hover:underline"
                        onClick={async () => {
                          for (const s of studentList.filter(s => s.is_assigned)) {
                            await handleToggleStudent(s);
                          }
                        }}
                      >
                        Remove all
                      </button>
                    </div>
                  </div>
                  {studentList.map(student => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-700">{student.name}</p>
                        <p className="text-xs text-gray-400">{student.section_label}</p>
                      </div>
                      <button
                        onClick={() => handleToggleStudent(student)}
                        disabled={togglingStudentId === student.id}
                        className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
                          student.is_assigned
                            ? 'bg-green-50 text-green-700 hover:bg-red-50 hover:text-red-600'
                            : 'bg-gray-100 text-gray-500 hover:bg-primary/10 hover:text-primary'
                        }`}
                      >
                        {togglingStudentId === student.id
                          ? '…'
                          : student.is_assigned
                          ? '✓ Assigned'
                          : '+ Assign'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 shrink-0">
              <Button
                size="sm"
                onClick={() => { setAssignStudentsHead(null); setStudentList([]); }}
                className="w-full"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Unassign class confirmation ──────────────────────────────────── */}
      {unassignHead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="font-semibold text-gray-800 mb-2">Unassign Class?</h2>
            <p className="text-sm text-gray-600 mb-4">
              Remove <strong>{unassignHead.className}</strong> from{' '}
              <strong>{unassignHead.headName}</strong>?
            </p>
            {unassignError && (
              <p className="text-xs text-red-500 mb-3">{unassignError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setUnassignHead(null);
                  setUnassignError('');
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleUnassignClass}
                disabled={unassignLoading}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                {unassignLoading ? 'Removing…' : 'Unassign'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete structure confirmation ────────────────────────────────── */}
      {deleteStructureId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="font-semibold text-gray-800 mb-2">Delete Fee Structure?</h2>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete the fee structure and all its fee types. This
              cannot be undone.
            </p>
            {deleteStructureError && (
              <p className="text-xs text-red-500 mb-3">{deleteStructureError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDeleteStructureId(null);
                  setDeleteStructureError('');
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleDeleteStructure}
                disabled={deleteLoading}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleteLoading ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete fee head confirmation ─────────────────────────────────── */}
      {deleteHeadId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="font-semibold text-gray-800 mb-2">Delete Fee Type?</h2>
            <p className="text-sm text-gray-600 mb-4">
              This will remove the fee type and unlink it from any student accounts.
            </p>
            {deleteHeadError && (
              <p className="text-xs text-red-500 mb-3">{deleteHeadError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDeleteHeadId(null);
                  setDeleteHeadStructureId(null);
                  setDeleteHeadError('');
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleDeleteFeeHead}
                disabled={deleteLoading}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleteLoading ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
