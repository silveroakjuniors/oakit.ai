'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost, API_BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Card, Button } from '@/components/ui';

interface Student {
  id: string;
  name: string;
  class_name?: string;
}

interface FeeHead {
  id: string;
  name: string;
  assigned_amount: number;
}

interface Concession {
  id: string;
  student_id: string;
  student_name: string;
  fee_head_name: string;
  type: 'fixed' | 'percentage';
  value: number;
  reason: string;
  status: string;
  created_at: string;
  rejection_reason?: string;
}

export default function ConcessionsPage() {
  const token = getToken() || '';

  // Create form
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [feeHeads, setFeeHeads] = useState<FeeHead[]>([]);
  const [feeHeadId, setFeeHeadId] = useState('');
  const [concessionType, setConcessionType] = useState<'fixed' | 'percentage'>('fixed');
  const [concessionValue, setConcessionValue] = useState('');
  const [reason, setReason] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState(false);

  // Pending approvals
  const [pending, setPending] = useState<Concession[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [selectedForBulk, setSelectedForBulk] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Applied concessions
  const [appliedStudent, setAppliedStudent] = useState<Student | null>(null);
  const [applied, setApplied] = useState<Concession[]>([]);
  const [appliedLoading, setAppliedLoading] = useState(false);

  useEffect(() => {
    loadPending();
  }, []);

  // Search students
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setShowDropdown(false); return; }
    const timer = setTimeout(async () => {
      try {
        const data = await apiGet<Student[]>(`/api/v1/admin/students?search=${encodeURIComponent(searchQuery)}`, token);
        setSearchResults(Array.isArray(data) ? data : []);
        setShowDropdown(true);
      } catch { setSearchResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function selectStudent(student: Student) {
    setSelectedStudent(student);
    setShowDropdown(false);
    setSearchQuery(student.name);
    setCreateError('');
    setCreateSuccess(false);
    // Load fee heads for this student
    try {
      const invoice = await apiGet<{ accounts: FeeHead[] }>(`/api/v1/financial/payments/invoice/${student.id}`, token);
      setFeeHeads(invoice.accounts || []);
      if (invoice.accounts.length > 0) setFeeHeadId(invoice.accounts[0].id);
    } catch { setFeeHeads([]); }
  }

  async function loadPending() {
    setPendingLoading(true);
    try {
      const data = await apiGet<Concession[]>('/api/v1/financial/concessions/pending', token);
      setPending(Array.isArray(data) ? data : []);
    } catch { setPending([]); }
    finally { setPendingLoading(false); }
  }

  async function handleCreate() {
    setCreateError('');
    setCreateSuccess(false);
    if (!selectedStudent) { setCreateError('Select a student.'); return; }
    if (!feeHeadId) { setCreateError('Select a fee head.'); return; }
    const val = parseFloat(concessionValue);
    if (!val || val <= 0) { setCreateError('Enter a valid value.'); return; }
    if (!reason.trim()) { setCreateError('Enter a reason.'); return; }
    setCreateLoading(true);
    try {
      await apiPost('/api/v1/financial/concessions', {
        student_id: selectedStudent.id,
        fee_head_id: feeHeadId,
        type: concessionType,
        value: val,
        reason: reason.trim(),
      }, token);
      setCreateSuccess(true);
      setConcessionValue('');
      setReason('');
      await loadPending();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create concession.');
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleApprove(id: string) {
    try {
      await apiPost(`/api/v1/financial/concessions/${id}/approve`, {}, token);
      await loadPending();
    } catch { /* ignore */ }
  }

  async function handleReject(id: string) {
    const rejectionReason = prompt('Enter rejection reason:');
    if (!rejectionReason) return;
    try {
      await apiPost(`/api/v1/financial/concessions/${id}/reject`, { rejection_reason: rejectionReason }, token);
      await loadPending();
    } catch { /* ignore */ }
  }

  async function handleBulkApprove() {
    if (selectedForBulk.size === 0) return;
    setBulkLoading(true);
    try {
      await apiPost('/api/v1/financial/concessions/bulk-approve', {
        ids: Array.from(selectedForBulk),
      }, token);
      setSelectedForBulk(new Set());
      await loadPending();
    } catch { /* ignore */ }
    finally { setBulkLoading(false); }
  }

  async function loadApplied(student: Student) {
    setAppliedStudent(student);
    setAppliedLoading(true);
    try {
      const data = await apiGet<Concession[]>(`/api/v1/financial/concessions/student/${student.id}`, token);
      setApplied(Array.isArray(data) ? data : []);
    } catch { setApplied([]); }
    finally { setAppliedLoading(false); }
  }

  function toggleBulkSelect(id: string) {
    setSelectedForBulk(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-primary">Concession Management</h1>
      </div>

      {/* Create concession */}
      <Card className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Create Concession</h2>
        <div className="space-y-4">
          <div className="relative">
            <label className="block text-xs font-medium text-gray-600 mb-1">Student</label>
            <input
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Search student…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
            />
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {searchResults.map(s => (
                  <button
                    key={s.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
                    onClick={() => selectStudent(s)}
                  >
                    <span className="font-medium text-gray-800">{s.name}</span>
                    {s.class_name && <span className="text-gray-500 ml-2 text-xs">{s.class_name}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedStudent && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fee Head</label>
                <select
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={feeHeadId}
                  onChange={e => setFeeHeadId(e.target.value)}
                >
                  {feeHeads.map(fh => (
                    <option key={fh.id} value={fh.id}>{fh.name} (₹{fh.assigned_amount.toLocaleString('en-IN')})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={concessionType}
                    onChange={e => setConcessionType(e.target.value as 'fixed' | 'percentage')}
                  >
                    <option value="fixed">Fixed Amount</option>
                    <option value="percentage">Percentage</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Value {concessionType === 'percentage' ? '(%)' : '(₹)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="0"
                    value={concessionValue}
                    onChange={e => setConcessionValue(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Reason</label>
                <textarea
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Reason for concession…"
                  rows={3}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                />
              </div>
            </>
          )}
          {createError && <p className="text-xs text-red-500">{createError}</p>}
          {createSuccess && <p className="text-xs text-green-600">✓ Concession created and sent for approval.</p>}
          <Button onClick={handleCreate} disabled={createLoading || !selectedStudent}>
            {createLoading ? 'Creating…' : 'Create Concession'}
          </Button>
        </div>
      </Card>

      {/* Pending approvals */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">
            Pending Approvals {pending.length > 0 && <span className="ml-1 text-xs text-gray-400">({pending.length})</span>}
          </h2>
          <div className="flex items-center gap-3">
            {pending.length > 0 && (
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedForBulk.size === pending.length && pending.length > 0}
                  onChange={() => {
                    if (selectedForBulk.size === pending.length) setSelectedForBulk(new Set());
                    else setSelectedForBulk(new Set(pending.map(c => c.id)));
                  }}
                  className="rounded"
                />
                Select all
              </label>
            )}
            {selectedForBulk.size > 0 && (
              <Button size="sm" onClick={handleBulkApprove} disabled={bulkLoading}>
                {bulkLoading ? 'Approving…' : `✓ Approve Selected (${selectedForBulk.size})`}
              </Button>
            )}
          </div>
        </div>
        {pendingLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="py-2 px-2 text-xs font-medium text-gray-400 w-8">#</th>
                  <th className="py-2 px-2 w-8"></th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Student</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Fee Head</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Concession</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Reason</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">Date</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((c, idx) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 px-2 text-center text-xs text-gray-400">{idx + 1}</td>
                    <td className="py-2 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedForBulk.has(c.id)}
                        onChange={() => toggleBulkSelect(c.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="py-2 px-3 font-medium text-gray-800">{c.student_name}</td>
                    <td className="py-2 px-3 text-gray-600 text-xs">{c.fee_head_name}</td>
                    <td className="py-2 px-3 text-right font-medium text-gray-800">
                      {c.type === 'fixed' ? `₹${Number(c.value).toLocaleString('en-IN')}` : `${c.value}%`}
                    </td>
                    <td className="py-2 px-3 text-gray-500 text-xs max-w-[160px] truncate">{c.reason}</td>
                    <td className="py-2 px-3 text-center text-gray-500 text-xs">
                      {new Date(c.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex gap-1.5 justify-center">
                        <button
                          onClick={() => handleApprove(c.id)}
                          className="text-xs px-2.5 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 font-medium"
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => handleReject(c.id)}
                          className="text-xs px-2.5 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200"
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pending.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400 text-sm">No pending approvals</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Applied concessions */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Applied Concessions</h2>
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">Search Student</label>
          <input
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Type student name…"
            onChange={e => {
              const q = e.target.value;
              if (!q.trim()) return;
              setTimeout(async () => {
                try {
                  const data = await apiGet<Student[]>(`/api/v1/admin/students?search=${encodeURIComponent(q)}`, token);
                  if (data.length > 0) loadApplied(data[0]);
                } catch { /* ignore */ }
              }, 300);
            }}
          />
        </div>
        {appliedLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : appliedStudent ? (
          <div>
            <p className="text-xs text-gray-500 mb-3">Showing concessions for <strong>{appliedStudent.name}</strong></p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="py-2 px-2 text-xs font-medium text-gray-400 w-8">#</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Fee Head</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Concession</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Reason</th>
                    <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">Status</th>
                    {applied.some(c => c.rejection_reason) && (
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Rejection Note</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {applied.map((c, idx) => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 px-2 text-center text-xs text-gray-400">{idx + 1}</td>
                      <td className="py-2 px-3 font-medium text-gray-800">{c.fee_head_name}</td>
                      <td className="py-2 px-3 text-right text-gray-700">
                        {c.type === 'fixed' ? `₹${Number(c.value).toLocaleString('en-IN')}` : `${c.value}%`}
                      </td>
                      <td className="py-2 px-3 text-gray-500 text-xs max-w-[160px] truncate">{c.reason}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          c.status === 'approved' ? 'bg-green-100 text-green-700' :
                          c.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>{c.status}</span>
                      </td>
                      {applied.some(x => x.rejection_reason) && (
                        <td className="py-2 px-3 text-xs text-red-500">{c.rejection_reason || '—'}</td>
                      )}
                    </tr>
                  ))}
                  {applied.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-400 text-sm">No concessions applied</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 py-4 text-center">Search for a student to view concessions</p>
        )}
      </Card>
    </div>
  );
}
