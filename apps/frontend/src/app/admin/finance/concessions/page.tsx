'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Card, Button } from '@/components/ui';

interface Student {
  id: string;
  name: string;
  class_name?: string;
  section_label?: string;
  father_name?: string;
  mother_name?: string;
  parent_contact?: string;
  mother_contact?: string;
}

interface ClassOption {
  id: string;
  name: string;
}

interface FeeHead {
  id: string;
  fee_head_id: string;
  fee_head_name: string;
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
  approved_at?: string;
  class_name?: string;
}

type Tab = 'pending' | 'all';

export default function ConcessionsPage() {
  const token = getToken() || '';

  const [tab, setTab] = useState<Tab>('pending');

  // Classes
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');

  // Create form — bulk
  const [feeHeads, setFeeHeads] = useState<FeeHead[]>([]);
  const [feeHeadId, setFeeHeadId] = useState('');
  const [concessionType, setConcessionType] = useState<'fixed' | 'percentage'>('fixed');
  const [concessionValue, setConcessionValue] = useState('');
  const [reason, setReason] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState(false);

  // Bulk student list
  const [bulkStudents, setBulkStudents] = useState<Array<{ id: string; name: string; concession_locked: boolean; has_pending_concession: boolean; has_approved_concession: boolean }>>([]);
  const [bulkStudentsLoading, setBulkStudentsLoading] = useState(false);
  const [selectedBulkStudents, setSelectedBulkStudents] = useState<Set<string>>(new Set());

  // Keep these for backward compat (search still used in some places)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Pending
  const [pending, setPending] = useState<Concession[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [selectedForBulk, setSelectedForBulk] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState<Concession | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);
  const [rejectError, setRejectError] = useState('');

  // All concessions tab
  const [allConcessions, setAllConcessions] = useState<Concession[]>([]);
  const [allLoading, setAllLoading] = useState(false);
  const [allClassFilter, setAllClassFilter] = useState('');
  const [allStatusFilter, setAllStatusFilter] = useState('');

  useEffect(() => {
    loadPending();
    loadClasses();
  }, []);

  useEffect(() => {
    if (tab === 'all') loadAll();
  }, [tab]);

  // Load fee heads when class is selected
  useEffect(() => {
    if (!selectedClassId) { setFeeHeads([]); setFeeHeadId(''); setBulkStudents([]); setSelectedBulkStudents(new Set()); return; }
    apiGet<{ accounts: FeeHead[] }>(`/api/v1/financial/concessions/fee-heads-for-class?class_id=${selectedClassId}`, token)
      .then(d => { setFeeHeads(d?.accounts || []); setFeeHeadId(''); setBulkStudents([]); setSelectedBulkStudents(new Set()); })
      .catch(() => setFeeHeads([]));
  }, [selectedClassId]);

  // Load students for selected fee head
  useEffect(() => {
    if (!selectedClassId || !feeHeadId) { setBulkStudents([]); setSelectedBulkStudents(new Set()); return; }
    setBulkStudentsLoading(true);
    apiGet<Array<{ id: string; name: string; concession_locked: boolean; has_pending_concession: boolean; has_approved_concession: boolean }>>(
      `/api/v1/financial/concessions/students-for-fee-head?class_id=${selectedClassId}&fee_head_id=${feeHeadId}`, token
    ).then(d => {
      setBulkStudents(Array.isArray(d) ? d : []);
      setSelectedBulkStudents(new Set());
    }).catch(() => setBulkStudents([])).finally(() => setBulkStudentsLoading(false));
  }, [feeHeadId]);

  async function loadClasses() {
    try {
      const data = await apiGet<ClassOption[]>('/api/v1/financial/fee-structures/classes', token);
      setClasses(Array.isArray(data) ? data : []);
    } catch { setClasses([]); }
  }

  async function loadPending() {
    setPendingLoading(true);
    try {
      const data = await apiGet<Concession[]>('/api/v1/financial/concessions/pending', token);
      setPending(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      console.error('loadPending failed:', err);
      setPending([]);
    }
    finally { setPendingLoading(false); }
  }

  async function loadAll() {
    setAllLoading(true);
    try {
      const params = new URLSearchParams();
      if (allStatusFilter) params.set('status', allStatusFilter);
      if (allClassFilter) params.set('class_id', allClassFilter);
      const data = await apiGet<Concession[]>(`/api/v1/financial/concessions?${params.toString()}`, token);
      setAllConcessions(Array.isArray(data) ? data : []);
    } catch { setAllConcessions([]); }
    finally { setAllLoading(false); }
  }

  // Student search for create form
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setShowDropdown(false); return; }
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search: searchQuery });
        if (selectedClassId) params.set('class_id', selectedClassId);
        const data = await apiGet<Student[]>(`/api/v1/admin/students?${params.toString()}`, token);
        setSearchResults(Array.isArray(data) ? data : []);
        setShowDropdown(true);
      } catch { setSearchResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedClassId]);

  async function selectStudent(student: Student) {
    setSelectedStudent(student);
    setShowDropdown(false);
    setSearchQuery(student.name);
    setCreateError('');
    setCreateSuccess(false);
    try {
      const invoice = await apiGet<{ accounts: FeeHead[] }>(`/api/v1/financial/payments/invoice/${student.id}`, token);
      setFeeHeads(invoice.accounts || []);
      if (invoice.accounts.length > 0) setFeeHeadId(invoice.accounts[0].fee_head_id);
    } catch { setFeeHeads([]); }
  }

  async function handleCreate() {
    setCreateError('');
    setCreateSuccess(false);
    if (!feeHeadId) { setCreateError('Select a fee head.'); return; }
    if (selectedBulkStudents.size === 0) { setCreateError('Select at least one student.'); return; }
    const val = parseFloat(concessionValue);
    if (!val || val <= 0) { setCreateError('Enter a valid value.'); return; }
    if (!reason.trim()) { setCreateError('Enter a reason.'); return; }
    setCreateLoading(true);
    try {
      const result = await apiPost<{ created: number; skipped_locked: number; skipped_duplicate: number; message: string }>(
        '/api/v1/financial/concessions/bulk-create',
        {
          fee_head_id: feeHeadId,
          type: concessionType,
          value: val,
          reason: reason.trim(),
          student_ids: Array.from(selectedBulkStudents),
        },
        token
      );
      setCreateSuccess(true);
      setConcessionValue('');
      setReason('');
      setSelectedBulkStudents(new Set());
      await loadPending();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create concession.');
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleApprove(id: string) {
    setActionError('');
    // Optimistically remove from list immediately
    setPending(prev => prev.filter(c => c.id !== id));
    setSelectedForBulk(prev => { const next = new Set(prev); next.delete(id); return next; });
    try {
      await apiPost(`/api/v1/financial/concessions/${id}/approve`, {}, token);
      // Don't reload — optimistic removal is correct. Reload only if needed.
    } catch (err: unknown) {
      // Restore on failure by reloading
      await loadPending();
      setActionError(err instanceof Error ? err.message : 'Failed to approve.');
    }
  }

  async function handleBulkApprove() {
    if (selectedForBulk.size === 0) return;
    setActionError('');
    // Optimistically remove selected from list
    const ids = Array.from(selectedForBulk);
    setPending(prev => prev.filter(c => !ids.includes(c.id)));
    setSelectedForBulk(new Set());
    setBulkLoading(true);
    try {
      await apiPost('/api/v1/financial/concessions/bulk-approve', { ids }, token);
      await loadPending();
    } catch (err: unknown) {
      await loadPending();
      setActionError(err instanceof Error ? err.message : 'Bulk approve failed.');
    } finally { setBulkLoading(false); }
  }

  async function submitReject() {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) { setRejectError('Enter a rejection reason.'); return; }
    setRejectLoading(true);
    setRejectError('');
    try {
      await apiPost(`/api/v1/financial/concessions/${rejectTarget.id}/reject`, { rejection_reason: rejectReason.trim() }, token);
      setRejectTarget(null);
      setRejectReason('');
      await loadPending();
      if (tab === 'all') await loadAll();
    } catch (err: unknown) {
      setRejectError(err instanceof Error ? err.message : 'Failed to reject.');
    } finally { setRejectLoading(false); }
  }

  function toggleBulkSelect(id: string) {
    setSelectedForBulk(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function getContactDisplay(s: Student) {
    return s.parent_contact || s.mother_contact || '';
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      pending_approval: 'bg-yellow-100 text-yellow-700',
    };
    return map[status] ?? 'bg-gray-100 text-gray-500';
  };

  const filteredAll = allConcessions.filter(c => {
    if (allStatusFilter && c.status !== allStatusFilter) return false;
    if (allClassFilter && !c.class_name) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-primary">Concession Management</h1>

      {/* ── Create concession ── */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Create Concession — Bulk</h2>
        <div className="space-y-4">
          {/* Step 1: Select class + fee head */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Class <span className="text-red-500">*</span></label>
              <select
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={selectedClassId}
                onChange={e => { setSelectedClassId(e.target.value); setFeeHeads([]); setFeeHeadId(''); setSearchResults([]); setSelectedStudent(null); }}
              >
                <option value="">Select class…</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {selectedClassId && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fee Head <span className="text-red-500">*</span></label>
                {feeHeads.length === 0
                  ? <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mt-1">No fee heads for this class</p>
                  : <select className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={feeHeadId} onChange={e => setFeeHeadId(e.target.value)}>
                      <option value="">Select fee head…</option>
                      {feeHeads.map(fh => <option key={fh.fee_head_id} value={fh.fee_head_id}>{fh.fee_head_name}</option>)}
                    </select>
                }
              </div>
            )}
          </div>

          {feeHeadId && (
            <>
              {/* Concession amount + reason */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={concessionType} onChange={e => setConcessionType(e.target.value as 'fixed' | 'percentage')}>
                    <option value="fixed">Fixed Amount (₹)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Value {concessionType === 'percentage' ? '(%)' : '(₹)'}</label>
                  <input type="number" min="1" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="0" value={concessionValue} onChange={e => setConcessionValue(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Reason <span className="text-red-500">*</span></label>
                <textarea className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Reason for concession…" rows={2} value={reason} onChange={e => setReason(e.target.value)} />
              </div>

              {/* Student list with checkboxes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600">Select Students <span className="text-red-500">*</span></label>
                  {bulkStudents.length > 0 && (
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                      <input type="checkbox"
                        checked={selectedBulkStudents.size === bulkStudents.length}
                        onChange={() => setSelectedBulkStudents(
                          selectedBulkStudents.size === bulkStudents.length
                            ? new Set()
                            : new Set(bulkStudents.map(s => s.id))
                        )} />
                      Select all ({bulkStudents.length})
                    </label>
                  )}
                </div>
                {bulkStudentsLoading ? (
                  <p className="text-xs text-gray-400 py-3">Loading students…</p>
                ) : bulkStudents.length === 0 ? (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">No students assigned to this fee head</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg max-h-52 overflow-y-auto">
                    {bulkStudents.map(s => (
                      <label key={s.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-50 last:border-0 ${s.concession_locked ? 'opacity-40' : ''}`}>
                        <input type="checkbox"
                          disabled={s.concession_locked}
                          checked={selectedBulkStudents.has(s.id)}
                          onChange={() => {
                            setSelectedBulkStudents(prev => {
                              const next = new Set(prev);
                              if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                              return next;
                            });
                          }} />
                        <span className="flex-1 text-sm text-gray-800">{s.name}</span>
                        {s.concession_locked && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">No concession</span>}
                        {s.has_pending_concession && <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Pending</span>}
                        {s.has_approved_concession && <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Approved</span>}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {createError && <p className="text-xs text-red-500">{createError}</p>}
          {createSuccess && <p className="text-xs text-green-600">Concession(s) submitted for approval.</p>}
          <Button onClick={handleCreate} disabled={createLoading || !feeHeadId || selectedBulkStudents.size === 0 || !concessionValue || !reason.trim()}>
            {createLoading ? 'Submitting…' : `Submit for Approval (${selectedBulkStudents.size} student${selectedBulkStudents.size !== 1 ? 's' : ''})`}
          </Button>
        </div>
      </Card>

      {/* ── Tabs: Pending / All ── */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['pending', 'all'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'pending' ? `Pending Approvals${pending.length > 0 ? ` (${pending.length})` : ''}` : 'All Concessions'}
          </button>
        ))}
      </div>

      {actionError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* ── Pending tab ── */}
      {tab === 'pending' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {pending.length > 0 && (
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                  <input type="checkbox" className="rounded"
                    checked={selectedForBulk.size === pending.length && pending.length > 0}
                    onChange={() => selectedForBulk.size === pending.length ? setSelectedForBulk(new Set()) : setSelectedForBulk(new Set(pending.map(c => c.id)))}
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
            <p className="text-sm text-gray-400 py-6 text-center">Loading…</p>
          ) : pending.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No pending approvals</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-medium text-gray-500">
                    <th className="py-2 px-2 w-8">#</th>
                    <th className="py-2 px-2 w-8"></th>
                    <th className="text-left py-2 px-3">Student</th>
                    <th className="text-left py-2 px-3">Fee Head</th>
                    <th className="text-right py-2 px-3">Concession</th>
                    <th className="text-left py-2 px-3">Reason</th>
                    <th className="text-center py-2 px-3">Date</th>
                    <th className="text-center py-2 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((c, idx) => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 px-2 text-center text-xs text-gray-400">{idx + 1}</td>
                      <td className="py-2 px-2 text-center">
                        <input type="checkbox" className="rounded" checked={selectedForBulk.has(c.id)} onChange={() => toggleBulkSelect(c.id)} />
                      </td>
                      <td className="py-2 px-3 font-medium text-gray-800">{c.student_name}</td>
                      <td className="py-2 px-3 text-gray-600 text-xs">{c.fee_head_name}</td>
                      <td className="py-2 px-3 text-right font-medium text-gray-800">
                        {c.type === 'fixed' ? `₹${Number(c.value).toLocaleString('en-IN')}` : `${c.value}%`}
                      </td>
                      <td className="py-2 px-3 text-gray-500 text-xs max-w-[160px] truncate" title={c.reason}>{c.reason}</td>
                      <td className="py-2 px-3 text-center text-gray-500 text-xs">{new Date(c.created_at).toLocaleDateString('en-IN')}</td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex gap-1.5 justify-center">
                          <button onClick={() => handleApprove(c.id)} className="text-xs px-2.5 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 font-medium">
                            ✓ Approve
                          </button>
                          <button onClick={() => { setRejectTarget(c); setRejectReason(''); setRejectError(''); }} className="text-xs px-2.5 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200">
                            ✕ Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── All concessions tab ── */}
      {tab === 'all' && (
        <Card>
          {/* Filters */}
          <div className="flex gap-3 mb-4">
            <div className="w-44">
              <label className="block text-xs font-medium text-gray-600 mb-1">Class</label>
              <select className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={allClassFilter} onChange={e => setAllClassFilter(e.target.value)}>
                <option value="">All Classes</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="w-44">
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={allStatusFilter} onChange={e => setAllStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="pending_approval">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button size="sm" onClick={loadAll} disabled={allLoading}>
                {allLoading ? 'Loading…' : 'Apply'}
              </Button>
            </div>
          </div>

          {allLoading ? (
            <p className="text-sm text-gray-400 py-6 text-center">Loading…</p>
          ) : filteredAll.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No concessions found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-medium text-gray-500">
                    <th className="py-2 px-2 w-8">#</th>
                    <th className="text-left py-2 px-3">Student</th>
                    <th className="text-left py-2 px-3">Fee Head</th>
                    <th className="text-right py-2 px-3">Concession</th>
                    <th className="text-left py-2 px-3">Reason</th>
                    <th className="text-center py-2 px-3">Status</th>
                    <th className="text-center py-2 px-3">Date</th>
                    <th className="text-left py-2 px-3">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAll.map((c, idx) => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 px-2 text-center text-xs text-gray-400">{idx + 1}</td>
                      <td className="py-2 px-3 font-medium text-gray-800">{c.student_name}</td>
                      <td className="py-2 px-3 text-gray-600 text-xs">{c.fee_head_name}</td>
                      <td className="py-2 px-3 text-right font-medium text-gray-800">
                        {c.type === 'fixed' ? `₹${Number(c.value).toLocaleString('en-IN')}` : `${c.value}%`}
                      </td>
                      <td className="py-2 px-3 text-gray-500 text-xs max-w-[140px] truncate" title={c.reason}>{c.reason}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(c.status)}`}>
                          {c.status === 'pending_approval' ? 'Pending' : c.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center text-gray-500 text-xs">{new Date(c.created_at).toLocaleDateString('en-IN')}</td>
                      <td className="py-2 px-3 text-xs text-red-500">{c.rejection_reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── Reject modal ── */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="font-semibold text-gray-800 mb-1">Reject Concession</h2>
            <p className="text-xs text-gray-500 mb-4">
              <strong>{rejectTarget.student_name}</strong> — {rejectTarget.fee_head_name} ·{' '}
              {rejectTarget.type === 'fixed' ? `₹${Number(rejectTarget.value).toLocaleString('en-IN')}` : `${rejectTarget.value}%`}
            </p>
            <label className="block text-xs font-medium text-gray-600 mb-1">Rejection reason</label>
            <textarea
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 mb-3"
              rows={3}
              placeholder="Enter reason for rejection…"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              autoFocus
            />
            {rejectError && <p className="text-xs text-red-500 mb-3">{rejectError}</p>}
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => { setRejectTarget(null); setRejectReason(''); setRejectError(''); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={submitReject} disabled={rejectLoading} className="bg-red-600 hover:bg-red-700 text-white">
                {rejectLoading ? 'Rejecting…' : 'Reject'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
