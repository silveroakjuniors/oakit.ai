'use client';

import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost, API_BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Card, Button } from '@/components/ui';

// Module-level session flag — not persisted to localStorage
let salarySessionUnlocked = false;

type PinState =
  | 'checking_pin_status'
  | 'pin_not_set'
  | 'pin_required'
  | 'unlocked';

interface SalaryRecord {
  id: string;
  user_id: string;
  staff_name: string;
  net_salary: number;
  status: string;
  year: number;
  month: number;
}

export default function SalaryPage() {
  const token = getToken() || '';
  const [pinState, setPinState] = useState<PinState>(
    salarySessionUnlocked ? 'unlocked' : 'checking_pin_status'
  );

  // Setup form
  const [setupPin, setSetupPin] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [setupError, setSetupError] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);

  // Verify form
  const [verifyPin, setVerifyPin] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const MAX_ATTEMPTS = 3;

  // Salary content
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [generateMsg, setGenerateMsg] = useState<Record<string, string>>({});

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check PIN status on mount
  useEffect(() => {
    if (salarySessionUnlocked) {
      setPinState('unlocked');
      loadSalaryRecords();
      return;
    }
    checkPinStatus();
  }, []);

  // Countdown timer for lockout
  useEffect(() => {
    if (lockedUntil) {
      const tick = () => {
        const remaining = Math.max(0, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 1000));
        setCountdown(remaining);
        if (remaining === 0) {
          setLockedUntil(null);
          setAttempts(0);
          if (countdownRef.current) clearInterval(countdownRef.current);
        }
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
    } catch {
      setPinState('pin_required');
    }
  }

  async function handleSetupPin() {
    setSetupError('');
    if (!/^\d{4}$/.test(setupPin)) { setSetupError('PIN must be exactly 4 digits.'); return; }
    if (setupPin !== setupConfirm) { setSetupError('PINs do not match.'); return; }
    setSetupLoading(true);
    try {
      await apiPost('/api/v1/financial/salary/pin/set', { pin: setupPin }, token);
      setSetupPin('');
      setSetupConfirm('');
      setPinState('pin_required');
    } catch (err: unknown) {
      setSetupError(err instanceof Error ? err.message : 'Failed to set PIN.');
    } finally {
      setSetupLoading(false);
    }
  }

  async function handleVerifyPin() {
    if (lockedUntil) return;
    setVerifyError('');
    if (!/^\d{4}$/.test(verifyPin)) { setVerifyError('Enter a 4-digit PIN.'); return; }
    setVerifyLoading(true);
    try {
      await apiPost('/api/v1/financial/salary/pin/verify', { pin: verifyPin }, token);
      salarySessionUnlocked = true;
      setVerifyPin('');
      setPinState('unlocked');
      loadSalaryRecords();
    } catch (err: unknown) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      const remaining = MAX_ATTEMPTS - newAttempts;
      if (remaining <= 0) {
        // Try to extract locked_until from error response
        const msg = err instanceof Error ? err.message : '';
        const match = msg.match(/locked_until[":]+\s*"?([^",}]+)"?/);
        if (match) {
          setLockedUntil(match[1]);
        } else {
          // Default 15 min lockout
          setLockedUntil(new Date(Date.now() + 15 * 60 * 1000).toISOString());
        }
        setVerifyError('Too many failed attempts. Account locked.');
      } else {
        setVerifyError(`Incorrect PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
      }
      setVerifyPin('');
    } finally {
      setVerifyLoading(false);
    }
  }

  async function loadSalaryRecords() {
    setSalaryLoading(true);
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const data = await apiGet<SalaryRecord[]>(
        `/api/v1/financial/salary?year=${year}&month=${month}`,
        token
      );
      setSalaryRecords(Array.isArray(data) ? data : []);
    } catch {
      setSalaryRecords([]);
    } finally {
      setSalaryLoading(false);
    }
  }

  async function handleGenerate(userId: string) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    setGenerateMsg(prev => ({ ...prev, [userId]: 'Generating…' }));
    try {
      await apiPost(`/api/v1/financial/salary/records/generate/${userId}/${year}/${month}`, {}, token);
      setGenerateMsg(prev => ({ ...prev, [userId]: '✓ Generated' }));
      await loadSalaryRecords();
    } catch (err: unknown) {
      setGenerateMsg(prev => ({ ...prev, [userId]: err instanceof Error ? err.message : 'Failed' }));
    }
  }

  // ── Render: checking ──────────────────────────────────────────────────────
  if (pinState === 'checking_pin_status') {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <p className="text-gray-500 text-sm">Checking PIN status…</p>
      </div>
    );
  }

  // ── Render: PIN setup ─────────────────────────────────────────────────────
  if (pinState === 'pin_not_set') {
    return (
      <div className="p-6 max-w-sm mx-auto">
        <h1 className="text-2xl font-semibold text-primary mb-2">Set Salary PIN</h1>
        <p className="text-sm text-gray-500 mb-6">
          Create a 4-digit PIN to protect salary data. You will need this PIN every session.
        </p>
        <Card>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">New PIN (4 digits)</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="••••"
                value={setupPin}
                onChange={e => setSetupPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="••••"
                value={setupConfirm}
                onChange={e => setSetupConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onKeyDown={e => e.key === 'Enter' && handleSetupPin()}
              />
            </div>
            {setupError && <p className="text-xs text-red-500">{setupError}</p>}
            <Button onClick={handleSetupPin} disabled={setupLoading}>
              {setupLoading ? 'Setting PIN…' : 'Set PIN'}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ── Render: PIN verify ────────────────────────────────────────────────────
  if (pinState === 'pin_required') {
    return (
      <div className="p-6 max-w-sm mx-auto">
        <h1 className="text-2xl font-semibold text-primary mb-2">Salary — PIN Required</h1>
        <p className="text-sm text-gray-500 mb-6">
          Enter your 4-digit PIN to access salary data.
        </p>
        <Card>
          <div className="flex flex-col gap-4">
            {lockedUntil ? (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-center">
                <p className="text-sm font-semibold text-red-700 mb-1">Account Locked</p>
                <p className="text-xs text-red-500">
                  Too many failed attempts. Try again in{' '}
                  <span className="font-bold">{Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}</span>
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="••••"
                    value={verifyPin}
                    onChange={e => setVerifyPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    onKeyDown={e => e.key === 'Enter' && handleVerifyPin()}
                    autoFocus
                  />
                </div>
                {verifyError && <p className="text-xs text-red-500">{verifyError}</p>}
                <Button onClick={handleVerifyPin} disabled={verifyLoading}>
                  {verifyLoading ? 'Verifying…' : 'Unlock'}
                </Button>
              </>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // ── Render: Salary content ────────────────────────────────────────────────
  const now = new Date();
  const monthLabel = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Salary Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">{monthLabel}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => { salarySessionUnlocked = false; setPinState('pin_required'); }}>
          🔒 Lock
        </Button>
      </div>

      <p className="text-sm text-gray-500 mb-4">Salary management loaded</p>

      {salaryLoading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Loading salary records…</p>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Staff Name</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Net Salary</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {salaryRecords.map(rec => (
                  <tr key={rec.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium text-gray-800">{rec.staff_name}</td>
                    <td className="py-2 px-3 text-right text-gray-700">
                      ₹{rec.net_salary.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        rec.status === 'paid' ? 'bg-green-100 text-green-700' :
                        rec.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {rec.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => handleGenerate(rec.user_id)}
                        className="text-xs px-3 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        {generateMsg[rec.user_id] || 'Generate'}
                      </button>
                    </td>
                  </tr>
                ))}
                {salaryRecords.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-400 text-sm">
                      No salary records for this month. Use Generate to create them.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
