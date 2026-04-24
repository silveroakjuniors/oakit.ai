'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Card, Button } from '@/components/ui';

type BillingBasis = 'per_hour' | 'per_day' | 'per_week' | 'per_month_flat';

interface FeeStructure {
  id: string;
  name: string;
  academic_year: string;
  class_id?: string;
  class_name?: string;
  is_active: boolean;
  fee_heads?: FeeHead[];
}

interface FeeHead {
  id: string;
  name: string;
  type: string;
  billing_basis: BillingBasis;
  rate: number;
  hours_per_day?: number;
  days_per_week?: number;
  calculated_monthly_fee?: number;
  rounded_monthly_fee?: number;
  pricing_model: string;
  instalment_count?: number;
}

interface ClassOption {
  id: string;
  name: string;
}

type WizardStep = 1 | 2 | 3 | 4;

export default function FeeStructuresPage() {
  const token = getToken() || '';

  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<ClassOption[]>([]);

  // Create structure form
  const [showCreate, setShowCreate] = useState(false);
  const [structureName, setStructureName] = useState('');
  const [academicYear, setAcademicYear] = useState(`${new Date().getFullYear()}-${new Date().getFullYear() + 1}`);
  const [structureClassId, setStructureClassId] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Fee wizard
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
  const [pricingModel, setPricingModel] = useState('flat');
  const [instalmentCount, setInstalmentCount] = useState('');
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardError, setWizardError] = useState('');

  // Assign to class
  const [assignStructureId, setAssignStructureId] = useState<string | null>(null);
  const [assignClassId, setAssignClassId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignMsg, setAssignMsg] = useState('');

  useEffect(() => {
    loadStructures();
    loadClasses();
  }, []);

  async function loadStructures() {
    setLoading(true);
    try {
      const data = await apiGet<FeeStructure[]>('/api/v1/financial/fee-structures', token);
      setStructures(Array.isArray(data) ? data : []);
    } catch { setStructures([]); }
    finally { setLoading(false); }
  }

  async function loadClasses() {
    try {
      const data = await apiGet<ClassOption[]>('/api/v1/admin/classes', token);
      setClasses(Array.isArray(data) ? data : []);
    } catch { setClasses([]); }
  }

  async function handleCreateStructure() {
    setCreateError('');
    if (!structureName.trim()) { setCreateError('Enter a name.'); return; }
    setCreateLoading(true);
    try {
      await apiPost('/api/v1/financial/fee-structures', {
        name: structureName.trim(),
        academic_year: academicYear,
        class_id: structureClassId || undefined,
      }, token);
      setStructureName('');
      setStructureClassId('');
      setShowCreate(false);
      await loadStructures();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create.');
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleWizardCalculate() {
    setWizardError('');
    setWizardLoading(true);
    try {
      const result = await apiPost<{ calculated_monthly_fee: number; formula_description: string }>(
        '/api/v1/financial/fee-structures/fee-wizard/calculate',
        {
          billing_basis: billingBasis,
          rate: parseFloat(rate) || 0,
          hours_per_day: parseFloat(hoursPerDay) || undefined,
          days_per_week: parseFloat(daysPerWeek) || undefined,
        },
        token
      );
      setCalculatedFee(result.calculated_monthly_fee);
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
      await apiPost(`/api/v1/financial/fee-structures/${wizardStructureId}/fee-heads`, {
        name: feeHeadName,
        type: feeHeadType,
        billing_basis: billingBasis,
        rate: parseFloat(rate) || 0,
        hours_per_day: parseFloat(hoursPerDay) || undefined,
        days_per_week: parseFloat(daysPerWeek) || undefined,
        calculated_monthly_fee: calculatedFee,
        rounded_monthly_fee: roundOff ? parseFloat(roundedFee) : undefined,
        pricing_model: pricingModel,
        instalment_count: pricingModel === 'instalment' ? parseInt(instalmentCount) : undefined,
      }, token);
      // Reset wizard
      setWizardStructureId(null);
      setWizardStep(1);
      setFeeHeadName('');
      setRate('');
      setHoursPerDay('');
      setDaysPerWeek('');
      setCalculatedFee(null);
      setRoundOff(false);
      setRoundedFee('');
      await loadStructures();
    } catch (err: unknown) {
      setWizardError(err instanceof Error ? err.message : 'Failed to save fee head.');
    } finally {
      setWizardLoading(false);
    }
  }

  async function handleAssignClass() {
    if (!assignStructureId || !assignClassId) return;
    setAssignLoading(true);
    setAssignMsg('');
    try {
      await apiPost(`/api/v1/financial/fee-structures/${assignStructureId}/assign-class`, {
        class_id: assignClassId,
      }, token);
      setAssignMsg('✓ Assigned to class successfully.');
      await loadStructures();
    } catch (err: unknown) {
      setAssignMsg(err instanceof Error ? err.message : 'Failed to assign.');
    } finally {
      setAssignLoading(false);
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

      {/* Create structure */}
      {showCreate && (
        <Card className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">New Fee Structure</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="e.g. LKG 2024-25"
                value={structureName}
                onChange={e => setStructureName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Academic Year</label>
              <input
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="2024-2025"
                value={academicYear}
                onChange={e => setAcademicYear(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Class (optional)</label>
              <select
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={structureClassId}
                onChange={e => setStructureClassId(e.target.value)}
              >
                <option value="">No class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
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

      {/* Structures list */}
      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>
      ) : (
        <div className="space-y-4">
          {structures.map(s => (
            <Card key={s.id} padding="sm">
              <div className="flex items-center justify-between px-2 py-2">
                <div>
                  <p className="font-semibold text-gray-800">{s.name}</p>
                  <p className="text-xs text-gray-500">{s.academic_year}{s.class_name ? ` · ${s.class_name}` : ''}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setWizardStructureId(s.id); setWizardStep(1); setWizardError(''); }}
                    className="text-xs px-3 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20"
                  >
                    + Fee Head
                  </button>
                  <button
                    onClick={() => { setAssignStructureId(s.id); setAssignClassId(''); setAssignMsg(''); }}
                    className="text-xs px-3 py-1 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200"
                  >
                    Assign Class
                  </button>
                </div>
              </div>

              {/* Fee heads */}
              {s.fee_heads && s.fee_heads.length > 0 && (
                <div className="mt-2 px-2 space-y-1">
                  {s.fee_heads.map(fh => (
                    <div key={fh.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 text-sm">
                      <span className="font-medium text-gray-700">{fh.name}</span>
                      <span className="text-gray-500 text-xs">
                        ₹{(fh.rounded_monthly_fee || fh.calculated_monthly_fee || fh.rate).toLocaleString('en-IN')}/mo
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Assign class inline */}
              {assignStructureId === s.id && (
                <div className="mt-3 px-2 pb-2">
                  <div className="flex gap-2 items-center">
                    <select
                      className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm"
                      value={assignClassId}
                      onChange={e => setAssignClassId(e.target.value)}
                    >
                      <option value="">Select class…</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <Button size="sm" onClick={handleAssignClass} disabled={assignLoading || !assignClassId}>
                      {assignLoading ? 'Assigning…' : 'Assign'}
                    </Button>
                    <button onClick={() => setAssignStructureId(null)} className="text-gray-400 hover:text-gray-600">×</button>
                  </div>
                  {assignMsg && <p className="text-xs mt-1 text-green-600">{assignMsg}</p>}
                </div>
              )}
            </Card>
          ))}
          {structures.length === 0 && (
            <p className="text-center text-gray-400 py-8">No fee structures yet. Create one above.</p>
          )}
        </div>
      )}

      {/* Fee Wizard modal */}
      {wizardStructureId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Fee Head Wizard</h2>
                <button onClick={() => setWizardStructureId(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
              </div>

              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-6">
                {[1, 2, 3, 4].map(s => (
                  <div key={s} className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      wizardStep === s ? 'bg-primary text-white' :
                      wizardStep > s ? 'bg-green-500 text-white' :
                      'bg-gray-200 text-gray-500'
                    }`}>{wizardStep > s ? '✓' : s}</div>
                    {s < 4 && <div className={`h-0.5 w-8 ${wizardStep > s ? 'bg-green-500' : 'bg-gray-200'}`} />}
                  </div>
                ))}
              </div>

              {/* Step 1: Billing basis */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Fee Head Name</label>
                    <input
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                      placeholder="e.g. Tuition Fee"
                      value={feeHeadName}
                      onChange={e => setFeeHeadName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                    <select className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                      value={feeHeadType} onChange={e => setFeeHeadType(e.target.value)}>
                      <option value="tuition">Tuition</option>
                      <option value="transport">Transport</option>
                      <option value="activity">Activity</option>
                      <option value="daycare">Daycare</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Billing Basis</label>
                    <select className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                      value={billingBasis} onChange={e => setBillingBasis(e.target.value as BillingBasis)}>
                      <option value="per_month_flat">Per Month (Flat)</option>
                      <option value="per_hour">Per Hour</option>
                      <option value="per_day">Per Day</option>
                      <option value="per_week">Per Week</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Pricing Model</label>
                    <select className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                      value={pricingModel} onChange={e => setPricingModel(e.target.value)}>
                      <option value="flat">Flat</option>
                      <option value="instalment">Instalment</option>
                    </select>
                  </div>
                  {pricingModel === 'instalment' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Number of Instalments</label>
                      <input type="number" min="1" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                        value={instalmentCount} onChange={e => setInstalmentCount(e.target.value)} />
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Rate inputs */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Rate (₹ {billingBasis === 'per_hour' ? 'per hour' : billingBasis === 'per_day' ? 'per day' : billingBasis === 'per_week' ? 'per week' : 'per month'})
                    </label>
                    <input type="number" min="0" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                      placeholder="0" value={rate} onChange={e => setRate(e.target.value)} />
                  </div>
                  {(billingBasis === 'per_hour') && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Hours per Day</label>
                        <input type="number" min="0" step="0.5" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                          placeholder="0" value={hoursPerDay} onChange={e => setHoursPerDay(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Days per Week</label>
                        <input type="number" min="0" max="7" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                          placeholder="0" value={daysPerWeek} onChange={e => setDaysPerWeek(e.target.value)} />
                      </div>
                    </>
                  )}
                  {billingBasis === 'per_day' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Days per Week</label>
                      <input type="number" min="0" max="7" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                        placeholder="0" value={daysPerWeek} onChange={e => setDaysPerWeek(e.target.value)} />
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Calculate */}
              {wizardStep === 3 && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-600 mb-4">
                    Ready to calculate monthly fee for <strong>{feeHeadName}</strong>
                  </p>
                  <p className="text-xs text-gray-500">
                    Billing: {billingBasis} · Rate: ₹{rate}
                    {hoursPerDay ? ` · ${hoursPerDay}h/day` : ''}
                    {daysPerWeek ? ` · ${daysPerWeek}d/week` : ''}
                  </p>
                </div>
              )}

              {/* Step 4: Round-off */}
              {wizardStep === 4 && calculatedFee !== null && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-center">
                    <p className="text-xs text-green-600 font-medium mb-1">Calculated Monthly Fee</p>
                    <p className="text-2xl font-bold text-green-700">₹{calculatedFee.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="roundoff" checked={roundOff} onChange={e => setRoundOff(e.target.checked)} />
                    <label htmlFor="roundoff" className="text-sm text-gray-700">Apply round-off</label>
                  </div>
                  {roundOff && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Rounded Monthly Fee (₹)</label>
                      <input type="number" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                        value={roundedFee} onChange={e => setRoundedFee(e.target.value)} />
                    </div>
                  )}
                </div>
              )}

              {wizardError && <p className="text-xs text-red-500 mt-3">{wizardError}</p>}

              <div className="flex gap-3 mt-6">
                {wizardStep > 1 && (
                  <Button variant="ghost" onClick={() => setWizardStep(s => (s - 1) as WizardStep)}>Back</Button>
                )}
                {wizardStep < 3 && (
                  <Button onClick={() => setWizardStep(s => (s + 1) as WizardStep)} disabled={!feeHeadName.trim() || !rate}>
                    Next
                  </Button>
                )}
                {wizardStep === 3 && (
                  <Button onClick={handleWizardCalculate} disabled={wizardLoading}>
                    {wizardLoading ? 'Calculating…' : 'Calculate'}
                  </Button>
                )}
                {wizardStep === 4 && (
                  <Button onClick={handleSaveFeeHead} disabled={wizardLoading}>
                    {wizardLoading ? 'Saving…' : 'Save Fee Head'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
