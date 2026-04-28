'use client';

import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost, API_BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Card, Button } from '@/components/ui';

let salarySessionUnlocked = false;

type PinState = 'checking_pin_status' | 'pin_not_set' | 'pin_required' | 'unlocked';
type Tab = 'staff' | 'records';

interface StaffSalary {
  user_id: string;
  staff_name: string;
  role: string;
  gross_salary: number | null;
  components: { name: string; type: string; amount: number }[];
  effective_from: string | null;
  config_created_at: string | null;
}

interface OfferLetter {
  id: string;
  gross_salary: number;
  components: { name: string; type: string; amount: number }[];
  start_date: string;
  status: string;
}

interface SalaryRecord {
  id: string;
  user_id: string;
  staff_name: string;
  gross_salary: number;
  net_salary: number;
  present_days: number;
  absent_days: number;
  working_days: number;
  status: string;
  year: number;
  month: number;
  payment_mode?: string;
  payment_date?: string;
}

interface WorkingDays {
  working_days: number;
  calculation_method: string;
}

export default function SalaryPage() {
  const token = getToken() || '';
  const [pinState, setPinState] = useState<PinState>(
    salarySessionUnlocked ? 'unlocked' : 'checking_pin_status'
  );
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('staff');

  // PIN forms
  const [setupPin, setSetupPin] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [setupError, setSetupError] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [verifyPin, setVerifyPin] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const MAX_ATTEMPTS = 3;
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Staff list
  const [staff, setStaff] = useState<StaffSalary[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);

  // Assign salary modal
  const [assignTarget, setAssignTarget] = useState<StaffSalary | null>(null);
  const [assignGross, setAssignGross] = useState('');
  const [assignEffectiveFrom, setAssignEffectiveFrom] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [assignSuccess, setAssignSuccess] = useState('');
  const [offerLetters, setOfferLetters] = useState<OfferLetter[]>([]);

  // Records tab
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordYear, setRecordYear] = useState(new Date().getFullYear());
  const [recordMonth, setRecordMonth] = useState(new Date().getMonth() + 1);
  const [workingDays, setWorkingDays] = useState<WorkingDays | null>(null);
  const [wdYear, setWdYear] = useState(new Date().getFullYear());
  const [wdMonth, setWdMonth] = useState(new Date().getMonth() + 1);
  const [wdDays, setWdDays] = useState('');
  const [wdMethod, setWdMethod] = useState('custom_working_days');
  const [wdLoading, setWdLoading] = useState(false);
  const [wdMsg, setWdMsg] = useState('');

  // Generate individual record modal
  const [genTarget, setGenTarget] = useState<StaffSalary | null>(null);
  const [genPresent, setGenPresent] = useState('');
  const [genAbsent, setGenAbsent] = useState('');
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState('');

  // Mark paid modal
  const [markPaidId, setMarkPaidId] = useState<string | null>(null);
  const [markPaidMode, setMarkPaidMode] = useState('cash');
  const [markPaidDate, setMarkPaidDate] = useState(new Date().toISOString().split('T')[0]);
  const [markPaidLoading, setMarkPaidLoading] = useState(false);
  const [markPaidError, setMarkPaidError] = useState('');

  // Change PIN
  const [showChangePin, setShowChangePin] = useState(false);
  const [cpCurrent, setCpCurrent] = useState('');
  const [cpNew, setCpNew] = useState('');
  const [cpConfirm, setCpConfirm] = useState('');
  const [cpError, setCpError] = useState('');
  const [cpLoading, setCpLoading] = useState(false);

  useEffect(() => {
    apiGet<{ permissions: string[] }>('/api/v1/financial/permissions', token)
      .then(d => {
        const hasPerm = (d.permissions || []).includes('VIEW_SALARY');
        setHasPermission(hasPerm);
        if (!hasPerm) return;
        if (salarySessionUnlocked) { setPinState('unlocked'); loadStaff(); }
        else checkPinStatus();
      })
      .catch(() => setHasPermission(false));
  }, []);

  useEffect(() => {
    if (lockedUntil) {
      const tick = () => {
        const remaining = Math.max(0, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 1000));
        setCountdown(remaining);
        if (remaining === 0) { setLockedUntil(null); setAttempts(0); if (countdownRef.current) clearInterval(countdownRef.current); }
      };
      tick();
      countdownRef.current = setInterval(tick, 1000);
      return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
    }
  }, [lockedUntil]);

  async function checkPinStatus() {
    try {
      const data = await apiGet<{ is_set: boolean }>('/api/v1/financial/salary/pin/status', token);
      setPinState(data.is_set ? 'pin_required' : 'pin_not_set');
    } catch { setPinState('pin_required'); }
  }

  async function handleSetupPin() {
    setSetupError('');
    if (!/^\d{4}$/.test(setupPin)) { setSetupError('PIN must be exactly 4 digits.'); return; }
    if (setupPin !== setupConfirm) { setSetupError('PINs do not match.'); return; }
    setSetupLoading(true);
    try {
      await apiPost('/api/v1/financial/salary/pin/set', { pin: setupPin }, token);
      setSetupPin(''); setSetupConfirm('');
      setPinState('pin_required');
    } catch (err: unknown) {
      setSetupError(err instanceof Error ? err.message : 'Failed to set PIN.');
    } finally { setSetupLoading(false); }
  }

  async function handleVerifyPin() {
    if (lockedUntil) return;
    setVerifyError('');
    if (!/^\d{4}$/.test(verifyPin)) { setVerifyError('Enter a 4-digit PIN.'); return; }
    setVerifyLoading(true);
    try {
      // Use fetch directly to avoid the auto-logout on 401
      const { API_BASE } = await import('@/lib/api');
      const res = await fetch(`${API_BASE}/api/v1/financial/salary/pin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pin: verifyPin }),
      });
      const data = await res.json();
      if (!res.ok) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        const remaining = MAX_ATTEMPTS - newAttempts;
        if (remaining <= 0) {
          setLockedUntil(new Date(Date.now() + 15 * 60 * 1000).toISOString());
          setVerifyError('Too many failed attempts. Account locked for 15 minutes.');
        } else {
          setVerifyError(`Incorrect PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
        }
        setVerifyPin('');
        return;
      }
      salarySessionUnlocked = true;
      setVerifyPin('');
      setPinState('unlocked');
      loadStaff();
    } catch (err: unknown) {
      setVerifyError('Network error. Please try again.');
      setVerifyPin('');
    } finally { setVerifyLoading(false); }
  }

  async function handleChangePin() {
    setCpError('');
    if (!/^\d{4}$/.test(cpCurrent)) { setCpError('Current PIN must be 4 digits.'); return; }
    if (!/^\d{4}$/.test(cpNew)) { setCpError('New PIN must be 4 digits.'); return; }
    if (cpNew !== cpConfirm) { setCpError('New PINs do not match.'); return; }
    setCpLoading(true);
    try {
      await apiPost('/api/v1/financial/salary/pin/change', { current_pin: cpCurrent, new_pin: cpNew }, token);
      setCpCurrent(''); setCpNew(''); setCpConfirm('');
      setShowChangePin(false);
    } catch (err: unknown) {
      setCpError(err instanceof Error ? err.message : 'Failed to change PIN.');
    } finally { setCpLoading(false); }
  }

  async function loadStaff() {
    setStaffLoading(true);
    try {
      const data = await apiGet<StaffSalary[]>('/api/v1/financial/salary/config/staff', token);
      setStaff(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('SALARY_PIN_REQUIRED') || msg.includes('PIN')) {
        // PIN session expired — go back to PIN screen without logging out
        salarySessionUnlocked = false;
        setPinState('pin_required');
      }
      setStaff([]);
    } finally { setStaffLoading(false); }
  }

  async function loadRecords() {
    setRecordsLoading(true);
    try {
      const data = await apiGet<SalaryRecord[]>(
        `/api/v1/financial/salary?year=${recordYear}&month=${recordMonth}`, token
      );
      setRecords(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('SALARY_PIN_REQUIRED') || msg.includes('PIN')) {
        salarySessionUnlocked = false;
        setPinState('pin_required');
      }
      setRecords([]);
    } finally { setRecordsLoading(false); }
  }

  async function loadWorkingDays() {
    try {
      const data = await apiGet<WorkingDays[]>(
        `/api/v1/financial/salary/config/working-days?year=${recordYear}&month=${recordMonth}`, token
      );
      setWorkingDays(Array.isArray(data) && data.length > 0 ? data[0] : null);
    } catch { setWorkingDays(null); }
  }

  useEffect(() => {
    if (pinState === 'unlocked' && tab === 'records') {
      loadRecords();
      loadWorkingDays();
    }
  }, [tab, recordYear, recordMonth, pinState]);

  async function openAssignModal(s: StaffSalary) {
    setAssignTarget(s);
    setAssignGross(s.gross_salary ? String(s.gross_salary) : '');
    setAssignEffectiveFrom(new Date().toISOString().split('T')[0]);
    setAssignError('');
    setAssignSuccess('');
    // Try to load offer letters for this staff member
    try {
      const letters = await apiGet<OfferLetter[]>(
        `/api/v1/principal/hr/offer-letters`, token
      );
      const staffLetters = (Array.isArray(letters) ? letters : [])
        .filter((l: any) => l.user_id === s.user_id && l.status === 'signed')
        .sort((a: any, b: any) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
      setOfferLetters(staffLetters);
    } catch { setOfferLetters([]); }
  }

  async function handleAssignSalary() {
    if (!assignTarget) return;
    setAssignError('');
    const gross = parseFloat(assignGross);
    if (!gross || gross <= 0) { setAssignError('Enter a valid gross salary.'); return; }
    if (!assignEffectiveFrom) { setAssignError('Select an effective date.'); return; }
    setAssignLoading(true);
    try {
      await apiPost(
        `/api/v1/financial/salary/config/staff/${assignTarget.user_id}/config`,
        { gross_salary: gross, components: [], effective_from: assignEffectiveFrom },
        token
      );
      setAssignSuccess('Salary assigned successfully.');
      await loadStaff();
      setTimeout(() => { setAssignTarget(null); setAssignSuccess(''); }, 1500);
    } catch (err: unknown) {
      setAssignError(err instanceof Error ? err.message : 'Failed to assign salary.');
    } finally { setAssignLoading(false); }
  }

  async function handleSaveWorkingDays() {
    setWdMsg('');
    const days = parseInt(wdDays);
    if (!days || days < 1) { setWdMsg('Enter valid working days.'); return; }
    setWdLoading(true);
    try {
      await apiPost('/api/v1/financial/salary/config/working-days', {
        year: wdYear, month: wdMonth, working_days: days, calculation_method: wdMethod,
      }, token);
      setWdMsg('✓ Working days saved.');
      await loadWorkingDays();
    } catch (err: unknown) {
      setWdMsg(err instanceof Error ? err.message : 'Failed to save.');
    } finally { setWdLoading(false); }
  }

  async function handleGenerateRecord() {
    if (!genTarget) return;
    setGenError('');
    const wd = workingDays?.working_days ?? 0;
    const present = parseInt(genPresent) || wd;
    const absent = parseInt(genAbsent) || 0;
    setGenLoading(true);
    try {
      await apiPost(
        `/api/v1/financial/salary/records/generate/${genTarget.user_id}/${recordYear}/${recordMonth}`,
        { present_days: present, absent_days: absent, leave_days: 0, deduction_choice: 'deduct' },
        token
      );
      setGenTarget(null);
      await loadRecords();
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : 'Failed to generate.');
    } finally { setGenLoading(false); }
  }

  async function handleMarkPaid() {
    if (!markPaidId) return;
    setMarkPaidLoading(true);
    setMarkPaidError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/financial/salary/records/${markPaidId}/mark-paid`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_mode: markPaidMode, payment_date: markPaidDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setMarkPaidId(null);
      await loadRecords();
    } catch (err: unknown) {
      setMarkPaidError(err instanceof Error ? err.message : 'Failed to mark as paid');
    } finally { setMarkPaidLoading(false); }
  }

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // ── Guards ────────────────────────────────────────────────────────────────
  if (hasPermission === null || pinState === 'checking_pin_status') {
    return <div className="p-6 flex items-center justify-center min-h-[300px]"><p className="text-gray-500 text-sm">Checking access…</p></div>;
  }
  if (hasPermission === false) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[300px] text-center">
        <p className="text-4xl mb-3">🔒</p>
        <p className="text-base font-semibold text-gray-700 mb-1">Access Restricted</p>
        <p className="text-sm text-gray-400">You don't have permission to view salary data.<br />Contact the Principal to request access.</p>
      </div>
    );
  }
  if (pinState === 'pin_not_set') {
    return (
      <div className="p-6 max-w-sm mx-auto">
        <h1 className="text-2xl font-semibold text-primary mb-2">Set Salary PIN</h1>
        <p className="text-sm text-gray-500 mb-4">Create a 4-digit PIN to protect salary data.</p>
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 mb-6">
          <p className="text-xs font-semibold text-amber-800 mb-1">⚠️ Write this PIN down — it cannot be recovered if lost.</p>
        </div>
        <Card>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">New PIN (4 digits)</label>
              <input type="password" inputMode="numeric" maxLength={4} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="••••" value={setupPin} onChange={e => setSetupPin(e.target.value.replace(/\D/g, '').slice(0, 4))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Confirm PIN</label>
              <input type="password" inputMode="numeric" maxLength={4} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="••••" value={setupConfirm} onChange={e => setSetupConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))} onKeyDown={e => e.key === 'Enter' && handleSetupPin()} />
            </div>
            {setupError && <p className="text-xs text-red-500">{setupError}</p>}
            <Button onClick={handleSetupPin} disabled={setupLoading}>{setupLoading ? 'Setting…' : 'Set PIN'}</Button>
          </div>
        </Card>
      </div>
    );
  }
  if (pinState === 'pin_required') {
    return (
      <div className="p-6 max-w-sm mx-auto">
        <h1 className="text-2xl font-semibold text-primary mb-2">Salary — PIN Required</h1>
        <p className="text-sm text-gray-500 mb-6">Enter your 4-digit PIN to access salary data.</p>
        <Card>
          <div className="flex flex-col gap-4">
            {lockedUntil ? (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-center">
                <p className="text-sm font-semibold text-red-700 mb-1">Account Locked</p>
                <p className="text-xs text-red-500">Try again in <span className="font-bold">{Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}</span></p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">PIN</label>
                  <input type="password" inputMode="numeric" maxLength={4} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="••••" value={verifyPin} onChange={e => setVerifyPin(e.target.value.replace(/\D/g, '').slice(0, 4))} onKeyDown={e => e.key === 'Enter' && handleVerifyPin()} autoFocus />
                </div>
                {verifyError && <p className="text-xs text-red-500">{verifyError}</p>}
                <Button onClick={handleVerifyPin} disabled={verifyLoading}>{verifyLoading ? 'Verifying…' : 'Unlock'}</Button>
              </>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // ── Main content ──────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-primary">Salary Management</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setShowChangePin(v => !v); setCpError(''); }}>🔑 Change PIN</Button>
          <Button size="sm" variant="ghost" onClick={() => { salarySessionUnlocked = false; setPinState('pin_required'); }}>🔒 Lock</Button>
        </div>
      </div>

      {/* Change PIN inline */}
      {showChangePin && (
        <Card>
          <p className="text-sm font-semibold text-gray-700 mb-3">Change Salary PIN</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[['Current PIN', cpCurrent, setCpCurrent], ['New PIN', cpNew, setCpNew], ['Confirm New PIN', cpConfirm, setCpConfirm]].map(([label, val, setter]: any) => (
              <div key={label}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input type="password" inputMode="numeric" maxLength={4} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="••••" value={val} onChange={e => setter(e.target.value.replace(/\D/g, '').slice(0, 4))} />
              </div>
            ))}
          </div>
          {cpError && <p className="text-xs text-red-500 mt-2">{cpError}</p>}
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={handleChangePin} disabled={cpLoading}>{cpLoading ? 'Saving…' : 'Save'}</Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowChangePin(false); setCpCurrent(''); setCpNew(''); setCpConfirm(''); setCpError(''); }}>Cancel</Button>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['staff', 'records'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'staff' ? 'Staff & Salary Config' : 'Monthly Records'}
          </button>
        ))}
      </div>

      {/* ── Staff tab ── */}
      {tab === 'staff' && (
        <Card>
          {staffLoading ? (
            <p className="text-sm text-gray-400 py-6 text-center">Loading staff…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-medium text-gray-500">
                    <th className="py-2 px-2 w-8">#</th>
                    <th className="text-left py-2 px-3">Name</th>
                    <th className="text-left py-2 px-3">Role</th>
                    <th className="text-right py-2 px-3">Gross Salary</th>
                    <th className="text-center py-2 px-3">Effective From</th>
                    <th className="text-center py-2 px-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s, idx) => (
                    <tr key={s.user_id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 px-2 text-center text-xs text-gray-400">{idx + 1}</td>
                      <td className="py-2 px-3 font-medium text-gray-800">{s.staff_name}</td>
                      <td className="py-2 px-3 text-gray-500 text-xs capitalize">{s.role}</td>
                      <td className="py-2 px-3 text-right">
                        {s.gross_salary
                          ? <span className="font-medium text-gray-800">₹{Number(s.gross_salary).toLocaleString('en-IN')}</span>
                          : <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Not set</span>
                        }
                      </td>
                      <td className="py-2 px-3 text-center text-xs text-gray-500">
                        {s.effective_from ? new Date(s.effective_from).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => openAssignModal(s)}
                          className="text-xs px-3 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20"
                        >
                          {s.gross_salary ? 'Edit / Increment' : 'Assign Salary'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {staff.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-sm text-gray-400">No staff found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── Records tab ── */}
      {tab === 'records' && (
        <div className="space-y-4">
          {/* Month selector + working days */}
          <Card>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Month</label>
                <div className="flex gap-2">
                  <select className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={recordMonth} onChange={e => setRecordMonth(parseInt(e.target.value))}>
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                  <input type="number" className="w-24 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={recordYear} onChange={e => setRecordYear(parseInt(e.target.value))} />
                </div>
              </div>
              <div className="flex items-end gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Working Days {workingDays ? <span className="text-green-600 font-semibold">({workingDays.working_days} set)</span> : <span className="text-amber-600">(not set)</span>}
                  </label>
                  <input type="number" min={1} max={31} className="w-20 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder={workingDays ? String(workingDays.working_days) : '26'}
                    value={wdDays} onChange={e => setWdDays(e.target.value)} />
                </div>
                <Button size="sm" onClick={handleSaveWorkingDays} disabled={wdLoading}>
                  {wdLoading ? 'Saving…' : 'Set Days'}
                </Button>
              </div>
              {wdMsg && <p className={`text-xs ${wdMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{wdMsg}</p>}
            </div>
          </Card>

          {/* Records table */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">
                {MONTHS[recordMonth - 1]} {recordYear} — {records.length} record{records.length !== 1 ? 's' : ''}
              </p>
            </div>
            {recordsLoading ? (
              <p className="text-sm text-gray-400 py-6 text-center">Loading…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs font-medium text-gray-500">
                      <th className="py-2 px-2 w-8">#</th>
                      <th className="text-left py-2 px-3">Staff</th>
                      <th className="text-right py-2 px-3">Gross</th>
                      <th className="text-center py-2 px-3">Present/WD</th>
                      <th className="text-right py-2 px-3">Net</th>
                      <th className="text-center py-2 px-3">Status</th>
                      <th className="text-center py-2 px-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((rec, idx) => (
                      <tr key={rec.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-2 text-center text-xs text-gray-400">{idx + 1}</td>
                        <td className="py-2 px-3 font-medium text-gray-800">{rec.staff_name}</td>
                        <td className="py-2 px-3 text-right text-gray-600 text-xs">₹{Number(rec.gross_salary).toLocaleString('en-IN')}</td>
                        <td className="py-2 px-3 text-center text-xs text-gray-500">{rec.present_days}/{rec.working_days}</td>
                        <td className="py-2 px-3 text-right font-semibold text-gray-800">₹{Number(rec.net_salary).toLocaleString('en-IN')}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rec.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {rec.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {rec.status === 'draft' && (
                            <button onClick={() => { setMarkPaidId(rec.id); setMarkPaidError(''); }}
                              className="text-xs px-2.5 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200">
                              Mark Paid
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {records.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center">
                          <p className="text-sm text-gray-400 mb-3">No records for this month.</p>
                          <p className="text-xs text-gray-400">Go to "Staff & Salary Config" tab and click "Generate Record" per staff member.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Generate per-staff buttons */}
          {workingDays && staff.filter(s => s.gross_salary).length > 0 && (
            <Card>
              <p className="text-sm font-semibold text-gray-700 mb-3">Generate Records for {MONTHS[recordMonth - 1]} {recordYear}</p>
              <div className="flex flex-wrap gap-2">
                {staff.filter(s => s.gross_salary).map(s => {
                  const hasRecord = records.some(r => r.user_id === s.user_id);
                  return (
                    <button key={s.user_id}
                      onClick={() => { if (!hasRecord) { setGenTarget(s); setGenPresent(String(workingDays.working_days)); setGenAbsent('0'); setGenError(''); } }}
                      disabled={hasRecord}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${hasRecord ? 'bg-gray-100 text-gray-400 cursor-default' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                    >
                      {hasRecord ? `✓ ${s.staff_name}` : `+ ${s.staff_name}`}
                    </button>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Assign Salary modal ── */}
      {assignTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="font-semibold text-gray-800 mb-1">
              {assignTarget.gross_salary ? 'Edit / Increment Salary' : 'Assign Salary'} — {assignTarget.staff_name}
            </h2>
            <p className="text-xs text-gray-500 mb-4 capitalize">{assignTarget.role}</p>

            {/* Offer letter pre-fill */}
            {offerLetters.length > 0 && (
              <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 p-3">
                <p className="text-xs font-semibold text-blue-800 mb-2">📄 From signed offer letter</p>
                {offerLetters.slice(0, 1).map(ol => (
                  <div key={ol.id} className="flex items-center justify-between">
                    <span className="text-xs text-blue-700">
                      ₹{Number(ol.gross_salary).toLocaleString('en-IN')} · from {new Date(ol.start_date).toLocaleDateString('en-IN')}
                    </span>
                    <button
                      onClick={() => { setAssignGross(String(ol.gross_salary)); setAssignEffectiveFrom(ol.start_date); }}
                      className="text-xs px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Use this
                    </button>
                  </div>
                ))}
              </div>
            )}

            {assignTarget.gross_salary && (
              <div className="mb-4 rounded-lg bg-gray-50 border border-gray-200 p-3 flex items-center justify-between">
                <span className="text-xs text-gray-600">Current: <strong>₹{Number(assignTarget.gross_salary).toLocaleString('en-IN')}</strong></span>
                {parseFloat(assignGross) > assignTarget.gross_salary && (
                  <span className="text-xs text-green-600 font-semibold">
                    +₹{(parseFloat(assignGross) - assignTarget.gross_salary).toLocaleString('en-IN')} increment
                  </span>
                )}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Gross Salary (₹)</label>
                <input type="number" min={1} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="e.g. 25000" value={assignGross} onChange={e => setAssignGross(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Effective From</label>
                <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={assignEffectiveFrom} onChange={e => setAssignEffectiveFrom(e.target.value)} />
              </div>
            </div>

            {assignError && <p className="text-xs text-red-500 mt-3">{assignError}</p>}
            {assignSuccess && <p className="text-xs text-green-600 mt-3">{assignSuccess}</p>}

            <div className="flex gap-2 justify-end mt-4">
              <Button size="sm" variant="ghost" onClick={() => setAssignTarget(null)}>Cancel</Button>
              <Button size="sm" onClick={handleAssignSalary} disabled={assignLoading}>
                {assignLoading ? 'Saving…' : assignTarget.gross_salary ? 'Update Salary' : 'Assign Salary'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Generate record modal ── */}
      {genTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="font-semibold text-gray-800 mb-1">Generate Salary Record</h2>
            <p className="text-xs text-gray-500 mb-4">
              {genTarget.staff_name} · {MONTHS[recordMonth - 1]} {recordYear} · ₹{Number(genTarget.gross_salary).toLocaleString('en-IN')} gross
            </p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Present Days</label>
                <input type="number" min={0} max={workingDays?.working_days ?? 31}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={genPresent} onChange={e => setGenPresent(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Absent Days</label>
                <input type="number" min={0}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={genAbsent} onChange={e => setGenAbsent(e.target.value)} />
              </div>
            </div>
            {genError && <p className="text-xs text-red-500 mb-3">{genError}</p>}
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setGenTarget(null)}>Cancel</Button>
              <Button size="sm" onClick={handleGenerateRecord} disabled={genLoading}>
                {genLoading ? 'Generating…' : 'Generate'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mark Paid modal ── */}
      {markPaidId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Mark Salary as Paid</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payment Mode</label>
                <select className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={markPaidMode} onChange={e => setMarkPaidMode(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payment Date</label>
                <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={markPaidDate} onChange={e => setMarkPaidDate(e.target.value)} />
              </div>
              {markPaidError && <p className="text-xs text-red-500">{markPaidError}</p>}
              <div className="flex gap-2 mt-1">
                <Button onClick={handleMarkPaid} disabled={markPaidLoading} className="flex-1">
                  {markPaidLoading ? 'Saving…' : 'Confirm Payment'}
                </Button>
                <Button variant="ghost" onClick={() => setMarkPaidId(null)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
