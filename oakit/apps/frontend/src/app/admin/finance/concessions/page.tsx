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
        concession_ids: Array.from(selectedForBulk),
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
          <h2 className="text-sm font-semibold text-gray-700">Pending Approvals</h2>
          {selectedForBulk.size > 0 && (
            <Button size="sm" onClick={handleBulkApprove} disabled={bulkLoading}>
              {bulkLoading ? 'Approving…' : `Approve Selected (${selectedForBulk.size})`}
            </Button>
          )}
        </div>
        {pendingLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <div className="space-y-2">
            {pending.map(c => (
              <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                <input
                  type="checkbox"
                  checked={selectedForBulk.has(c.id)}
                  onChange={() => toggleBulkSelect(c.id)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{c.student_name}</p>
                  <p className="text-xs text-gray-600">
                    {c.fee_head_name} · {c.type === 'fixed' ? `₹${c.value}` : `${c.value}%`}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{c.reason}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleApprove(c.id)}
                    className="text-xs px-3 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(c.id)}
                    className="text-xs px-3 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
            {pending.length === 0 && (
              <p className="text-sm text-gray-400 py-4 text-center">No pending approvals</p>
            )}
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
            <p className="text-xs text-gray-500 mb-2">Showing concessions for {appliedStudent.name}</p>
            <div className="space-y-2">
              {applied.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{c.fee_head_name}</p>
                    <p className="text-xs text-gray-600">
                      {c.type === 'fixed' ? `₹${c.value}` : `${c.value}%`} · {c.reason}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    c.status === 'approved' ? 'bg-green-100 text-green-700' :
                    c.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>{c.status}</span>
                </div>
              ))}
              {applied.length === 0 && (
                <p className="text-sm text-gray-400 py-4 text-center">No concessions applied</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 py-4 text-center">Search for a student to view concessions</p>
        )}
      </Card>
    </div>
  );
}
