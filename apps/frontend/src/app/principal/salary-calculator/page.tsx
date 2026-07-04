'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, API_BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';
import {
  ChevronLeft, Calculator, Plus, Trash2, Download, Users, Loader2,
} from 'lucide-react';

interface StaffMember {
  user_id: string;
  name: string;
  role: string;
  gross_salary: number;
  is_manual?: boolean;
}

interface CalcRow {
  id: string;
  name: string;
  role: string;
  gross_salary: number;
  deduction_days: number;
  net_salary: number;
  per_day_rate: number;
  is_manual: boolean;
}

export default function SalaryCalculatorPage() {
  const router = useRouter();
  const token = getToken() || '';
  const [loading, setLoading] = useState(true);
  const [workingDays, setWorkingDays] = useState(26);
  const [rows, setRows] = useState<CalcRow[]>([]);
  const [exporting, setExporting] = useState(false);

  // Manual staff entry
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualRole, setManualRole] = useState('');
  const [manualSalary, setManualSalary] = useState('');

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    loadStaff();
  }, [token]);

  async function loadStaff() {
    setLoading(true);
    try {
      const data = await apiGet<any[]>('/api/v1/financial/salary/staff', token);
      const staffRows: CalcRow[] = (data || [])
        .filter((s: any) => s.gross_salary)
        .map((s: any) => ({
          id: s.user_id,
          name: s.staff_name || s.name || 'Unknown',
          role: s.role || '',
          gross_salary: Number(s.gross_salary) || 0,
          deduction_days: 0,
          net_salary: Number(s.gross_salary) || 0,
          per_day_rate: 0,
          is_manual: false,
        }));
      setRows(staffRows);
    } catch {
      setRows([]);
    } finally { setLoading(false); }
  }

  function recalcRow(row: CalcRow, wd: number): CalcRow {
    const perDay = wd > 0 ? row.gross_salary / wd : 0;
    const deduction = row.deduction_days * perDay;
    const net = Math.max(0, row.gross_salary - deduction);
    return { ...row, per_day_rate: perDay, net_salary: net };
  }

  function recalcAll(newWd?: number) {
    const wd = newWd ?? workingDays;
    setRows(prev => prev.map(r => recalcRow(r, wd)));
  }

  function updateWorkingDays(val: number) {
    setWorkingDays(val);
    setRows(prev => prev.map(r => recalcRow(r, val)));
  }

  function updateDeduction(id: string, days: number) {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, deduction_days: days };
      return recalcRow(updated, workingDays);
    }));
  }

  function updateGross(id: string, gross: number) {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, gross_salary: gross };
      return recalcRow(updated, workingDays);
    }));
  }

  function addManualStaff() {
    if (!manualName.trim() || !manualSalary.trim()) return;
    const newRow: CalcRow = {
      id: `manual_${Date.now()}`,
      name: manualName.trim(),
      role: manualRole.trim() || 'Staff',
      gross_salary: Number(manualSalary) || 0,
      deduction_days: 0,
      net_salary: Number(manualSalary) || 0,
      per_day_rate: workingDays > 0 ? Number(manualSalary) / workingDays : 0,
      is_manual: true,
    };
    setRows(prev => [...prev, recalcRow(newRow, workingDays)]);
    setManualName('');
    setManualRole('');
    setManualSalary('');
    setShowAddManual(false);
  }

  function removeRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id));
  }

  const totalGross = rows.reduce((s, r) => s + r.gross_salary, 0);
  const totalDeductions = rows.reduce((s, r) => s + (r.gross_salary - r.net_salary), 0);
  const totalNet = rows.reduce((s, r) => s + r.net_salary, 0);

  async function exportPdf() {
    setExporting(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/principal/salary-calculator/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ working_days: workingDays, rows }),
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `salary-calculator-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { alert('Failed to export PDF'); }
    finally { setExporting(false); }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 px-4 py-3 flex items-center gap-3"
        style={{ background: 'linear-gradient(135deg, #1B4332 0%, #2d6a4f 100%)' }}>
        <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-white truncate">Salary Calculator</h1>
          <p className="text-[10px] text-white/60">Quick salary payout calculation</p>
        </div>
        <button onClick={exportPdf} disabled={exporting || rows.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50">
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          PDF
        </button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : (
        <div className="px-4 py-4 max-w-2xl mx-auto space-y-4">

          {/* Working Days Input */}
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calculator size={14} className="text-indigo-500" />
              <p className="text-xs font-bold text-neutral-700">Working Days This Month</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={31}
                value={workingDays}
                onChange={e => updateWorkingDays(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 text-center text-lg font-black text-indigo-600 border border-indigo-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <p className="text-[11px] text-neutral-500 flex-1">
                Total working days to consider for per-day salary calculation. Deduction = (Deduction Days x Gross) / Working Days.
              </p>
            </div>
          </div>

          {/* Staff List */}
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-emerald-500" />
                <p className="text-xs font-bold text-neutral-700">Staff ({rows.length})</p>
              </div>
              <button onClick={() => setShowAddManual(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-semibold rounded-lg transition-all">
                <Plus size={12} /> Add Staff
              </button>
            </div>

            {/* Rows */}
            <div className="divide-y divide-neutral-50">
              {rows.map((row, idx) => (
                <div key={row.id} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] text-neutral-400 font-mono mt-1 shrink-0 w-5">{idx + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <p className="text-xs font-semibold text-neutral-800 truncate">{row.name}</p>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-500 font-medium shrink-0">{row.role}</span>
                        {row.is_manual && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium shrink-0">manual</span>}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[9px] text-neutral-400 block mb-0.5">Gross Salary</label>
                          <input
                            type="number"
                            min={0}
                            value={row.gross_salary || ''}
                            onChange={e => updateGross(row.id, Number(e.target.value) || 0)}
                            className="w-full text-xs font-semibold text-neutral-800 border border-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-neutral-400 block mb-0.5">Deduct Days</label>
                          <input
                            type="number"
                            min={0}
                            max={workingDays}
                            value={row.deduction_days || ''}
                            onChange={e => updateDeduction(row.id, Math.max(0, Number(e.target.value) || 0))}
                            className="w-full text-xs font-semibold text-neutral-800 border border-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-300"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-neutral-400 block mb-0.5">Net Salary</label>
                          <p className="text-xs font-black text-emerald-600 px-2 py-1.5">
                            {row.net_salary.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </p>
                        </div>
                      </div>
                    </div>
                    {row.is_manual && (
                      <button onClick={() => removeRow(row.id)} className="text-neutral-300 hover:text-red-400 mt-1 shrink-0">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {rows.length === 0 && (
                <p className="text-xs text-neutral-400 text-center py-8">No staff loaded. Configure salary in Finance &gt; Salary or add manually below.</p>
              )}
            </div>
          </div>

          {/* Total Summary */}
          {rows.length > 0 && (
            <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl border border-emerald-200 p-4">
              <p className="text-xs font-bold text-emerald-800 mb-2">Monthly Payout Summary</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-[10px] text-neutral-500 mb-0.5">Total Gross</p>
                  <p className="text-sm font-black text-neutral-800">{totalGross.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                </div>
                <div>
                  <p className="text-[10px] text-neutral-500 mb-0.5">Deductions</p>
                  <p className="text-sm font-black text-red-600">{totalDeductions.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                </div>
                <div>
                  <p className="text-[10px] text-neutral-500 mb-0.5">Net Payout</p>
                  <p className="text-sm font-black text-emerald-700">{totalNet.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Manual Staff Modal */}
      {showAddManual && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowAddManual(false)}>
          <div className="relative w-full sm:w-[400px] bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-5"
            onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold text-neutral-800 mb-4">Add Non-System Staff</p>
            <p className="text-[10px] text-neutral-400 mb-3">For caretakers, drivers, or anyone not onboarded to the system.</p>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-neutral-500 font-medium block mb-1">Name</label>
                <input value={manualName} onChange={e => setManualName(e.target.value)}
                  placeholder="e.g., Raju (Driver)"
                  className="w-full text-sm border border-neutral-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="text-[10px] text-neutral-500 font-medium block mb-1">Role</label>
                <input value={manualRole} onChange={e => setManualRole(e.target.value)}
                  placeholder="e.g., Driver, Caretaker, Cook"
                  className="w-full text-sm border border-neutral-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="text-[10px] text-neutral-500 font-medium block mb-1">Monthly Gross Salary</label>
                <input type="number" value={manualSalary} onChange={e => setManualSalary(e.target.value)}
                  placeholder="e.g., 12000"
                  className="w-full text-sm border border-neutral-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAddManual(false)}
                className="flex-1 py-2.5 text-xs font-semibold text-neutral-500 bg-neutral-100 rounded-xl hover:bg-neutral-200 transition-all">
                Cancel
              </button>
              <button onClick={addManualStaff} disabled={!manualName.trim() || !manualSalary.trim()}
                className="flex-1 py-2.5 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50">
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
