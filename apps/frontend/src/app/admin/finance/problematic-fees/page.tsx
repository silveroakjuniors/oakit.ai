'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Card, Button } from '@/components/ui';
import { AlertTriangle, CheckCircle2, Clock, ChevronDown, ChevronUp, Send } from 'lucide-react';

interface PaymentEntry {
  id: string;
  amount: number;
  payment_mode: string;
  payment_date: string;
  receipt_number: string;
  override_status: string | null;
  override_reason: string | null;
  student_name: string;
  class_name: string;
  fee_head_name: string;
  recorded_by: string | null;
  created_at: string;
}

interface DuplicateGroup {
  reference_number: string;
  payment_count: number;
  total_amount: number;
  earliest_date: string;
  latest_date: string;
  has_pending: boolean;
  has_approved: boolean;
  has_unreviewed: boolean;
  payments: PaymentEntry[];
}

function fmt(n: number | string) {
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function OverrideBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">Needs review</span>;
  if (status === 'pending_approval') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold flex items-center gap-1 w-fit"><Clock className="w-3 h-3"/>Pending principal</span>;
  if (status === 'approved')        return <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold flex items-center gap-1 w-fit"><CheckCircle2 className="w-3 h-3"/>Approved</span>;
  if (status === 'rejected')        return <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">Rejected</span>;
  return null;
}

export default function ProblematicFeesPage() {
  const token = getToken() || '';
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Expanded group
  const [expanded, setExpanded] = useState<string | null>(null);

  // Per-payment override submission
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');
  const [submitErr, setSubmitErr] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setError('');
    try {
      const data = await apiGet<DuplicateGroup[]>('/api/v1/financial/payments/duplicate-references', token);
      setGroups(Array.isArray(data) ? data : []);
    } catch (e: any) { setError(e?.message || 'Failed to load'); }
    finally { setLoading(false); }
  }

  async function submitOverride(paymentId: string) {
    if (!reason.trim()) { setSubmitErr('Please enter a reason explaining why the reference is shared.'); return; }
    setSubmitting(true); setSubmitErr(''); setSubmitMsg('');
    try {
      await apiPost(`/api/v1/financial/payments/${paymentId}/request-override`, { override_reason: reason.trim() }, token);
      setSubmitMsg('Sent to Principal for approval.');
      setOverrideId(null);
      setReason('');
      await load();
    } catch (e: any) { setSubmitErr(e?.message || 'Failed to submit'); }
    finally { setSubmitting(false); }
  }

  const needsReview  = groups.filter(g => g.has_unreviewed && !g.has_pending && !g.has_approved);
  const pending      = groups.filter(g => g.has_pending);
  const resolved     = groups.filter(g => g.has_approved && !g.has_unreviewed && !g.has_pending);

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-start gap-3 mb-5">
        <div className="mt-0.5 p-2 rounded-xl bg-amber-100">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Problematic Fee Report</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Payments sharing the same reference number (UTR/transaction ID). These require a reason and Principal approval.
          </p>
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">{error}</div>}
      {submitMsg && <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/>{submitMsg}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>
      ) : groups.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-700">No duplicate reference numbers found</p>
            <p className="text-xs text-gray-400 mt-1">All payments have unique reference numbers.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* Summary counts */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">{needsReview.length}</p>
              <p className="text-xs text-amber-600 font-semibold mt-0.5">Needs Review</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">{pending.length}</p>
              <p className="text-xs text-blue-600 font-semibold mt-0.5">Pending Principal</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{resolved.length}</p>
              <p className="text-xs text-green-600 font-semibold mt-0.5">Resolved</p>
            </div>
          </div>

          {/* Groups */}
          {groups.map(group => (
            <Card key={group.reference_number}>
              {/* Group header */}
              <button
                className="w-full text-left"
                onClick={() => setExpanded(expanded === group.reference_number ? null : group.reference_number)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-800 font-mono">{group.reference_number}</span>
                      <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold">
                        {group.payment_count} payments
                      </span>
                      {group.has_unreviewed && !group.has_pending && !group.has_approved && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5"/>Needs review
                        </span>
                      )}
                      {group.has_pending && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5"/>Pending principal
                        </span>
                      )}
                      {group.has_approved && !group.has_unreviewed && !group.has_pending && (
                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5"/>Approved
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Total: <span className="font-semibold text-gray-700">{fmt(group.total_amount)}</span>
                      &nbsp;&middot;&nbsp;
                      {new Date(group.earliest_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                      {group.earliest_date !== group.latest_date && ` – ${new Date(group.latest_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}`}
                    </p>
                  </div>
                  {expanded === group.reference_number
                    ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 mt-1"/>
                    : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 mt-1"/>}
                </div>
              </button>

              {/* Expanded payments list */}
              {expanded === group.reference_number && (
                <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
                  {group.payments.map(p => (
                    <div key={p.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-bold text-gray-800">{p.student_name}</span>
                            <span className="text-xs text-gray-500">{p.class_name}</span>
                            <span className="text-xs text-gray-400">&middot;</span>
                            <span className="text-xs text-gray-500">{p.fee_head_name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="font-bold text-gray-700">{fmt(p.amount)}</span>
                            <span className="capitalize">{p.payment_mode?.replace(/_/g,' ')}</span>
                            <span>{new Date(p.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                            <span className="font-mono text-gray-400">{p.receipt_number}</span>
                          </div>
                          {p.override_reason && (
                            <p className="text-xs text-gray-500 mt-1.5 italic">
                              Reason: &ldquo;{p.override_reason}&rdquo;
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-2">
                          <OverrideBadge status={p.override_status} />
                          {/* Show "Add reason + send" only for unreviewed or rejected */}
                          {(!p.override_status || p.override_status === 'rejected') && (
                            <button
                              onClick={() => { setOverrideId(p.id); setReason(''); setSubmitErr(''); setSubmitMsg(''); }}
                              className="text-[10px] px-2.5 py-1 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 flex items-center gap-1">
                              <Send className="w-3 h-3"/>Send for approval
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline reason form */}
                      {overrideId === p.id && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">
                            Explain why this reference number is shared <span className="text-red-500">*</span>
                          </label>
                          <textarea rows={2}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-200 resize-none"
                            placeholder="e.g. Parent paid fees for siblings in a single transaction. Ref: 948697334273 covers both Aariv and Aanya's June instalment."
                            value={reason} onChange={e => setReason(e.target.value)} />
                          {submitErr && <p className="text-xs text-red-600 mt-1">{submitErr}</p>}
                          <div className="flex gap-2 mt-2">
                            <Button size="sm"
                              className="bg-amber-500 hover:bg-amber-600 text-white"
                              disabled={submitting || !reason.trim()}
                              onClick={() => submitOverride(p.id)}>
                              {submitting ? 'Sending…' : 'Send to Principal'}
                            </Button>
                            <Button size="sm" variant="ghost"
                              onClick={() => setOverrideId(null)} disabled={submitting}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
