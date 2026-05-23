'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPatch } from '@/lib/api';
import { getToken } from '@/lib/auth';

interface StaffMember { id: string; name: string; email: string; mobile: string; role_name: string; }
interface LeaveRequest {
  id: string; user_id: string; leave_type: string; start_date: string; end_date: string;
  reason: string; status: string; staff_name: string; staff_email: string; created_at: string;
  review_note?: string;
}
interface OfferLetter {
  id: string; staff_name: string; role: string; start_date: string;
  gross_salary: number; status: string; pdf_url: string | null; created_at: string;
}
interface Resignation {
  id: string; staff_name: string; event_date: string;
  resignation_status: string; notice_period_days: number; created_at: string;
}

type Tab = 'leave' | 'offer-letters' | 'resignations';

export default function AdminHRPage() {
  const [tab, setTab] = useState<Tab>('leave');
  const [leave, setLeave] = useState<LeaveRequest[]>([]);
  const [offerLetters, setOfferLetters] = useState<OfferLetter[]>([]);
  const [resignations, setResignations] = useState<Resignation[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const token = getToken();

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    if (tab === 'leave') {
      apiGet<LeaveRequest[]>('/api/v1/principal/hr/leave', token)
        .then(setLeave).catch(console.error).finally(() => setLoading(false));
    } else if (tab === 'offer-letters') {
      apiGet<OfferLetter[]>('/api/v1/principal/hr/offer-letters', token)
        .then(setOfferLetters).catch(console.error).finally(() => setLoading(false));
    } else {
      apiGet<Resignation[]>('/api/v1/principal/hr/resignations', token)
        .then(setResignations).catch(console.error).finally(() => setLoading(false));
    }
  }, [tab, token]);

  async function reviewLeave(id: string, status: 'approved' | 'rejected') {
    if (!token) return;
    try {
      await apiPatch(`/api/v1/principal/hr/leave/${id}`, { status, review_note: reviewNote }, token);
      setLeave(prev => prev.map(l => l.id === id ? { ...l, status, review_note: reviewNote } : l));
      setReviewingId(null);
      setReviewNote('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function acknowledgeResignation(id: string) {
    if (!token) return;
    try {
      await apiPatch(`/api/v1/principal/hr/resignations/${id}/acknowledge`, {}, token);
      setResignations(prev => prev.map(r => r.id === id ? { ...r, resignation_status: 'acknowledged' } : r));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
  }

  const statusColor = (s: string) =>
    s === 'approved' || s === 'acknowledged' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    s === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
    s === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
    'bg-gray-50 text-gray-500 border-gray-200';

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">HR Management</h1>
        <p className="text-sm text-gray-500 mt-1">Leave requests, offer letters, and resignations</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 border-b border-gray-100 pb-2">
        {([
          { key: 'leave', label: '🏖️ Leave Requests' },
          { key: 'offer-letters', label: '📄 Offer Letters' },
          { key: 'resignations', label: '👋 Resignations' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t.key ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'text-gray-500 hover:bg-gray-50'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <div className="text-gray-400 text-sm">Loading...</div> : (
        <>
          {/* Leave Requests */}
          {tab === 'leave' && (
            <div className="space-y-3">
              {!leave.length ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">No leave requests</div>
              ) : leave.map(l => (
                <div key={l.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-900 text-sm">{l.staff_name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor(l.status)}`}>{l.status}</span>
                      </div>
                      <p className="text-xs text-gray-500">{l.leave_type} · {new Date(l.start_date).toLocaleDateString('en-IN')} – {new Date(l.end_date).toLocaleDateString('en-IN')}</p>
                      <p className="text-xs text-gray-600 mt-1">{l.reason}</p>
                      {l.review_note && <p className="text-xs text-gray-400 mt-1 italic">Note: {l.review_note}</p>}
                    </div>
                    {l.status === 'pending' && (
                      <div className="shrink-0">
                        {reviewingId === l.id ? (
                          <div className="space-y-2 w-48">
                            <input type="text" placeholder="Review note (optional)" value={reviewNote}
                              onChange={e => setReviewNote(e.target.value)}
                              className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-300" />
                            <div className="flex gap-1.5">
                              <button onClick={() => reviewLeave(l.id, 'approved')}
                                className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">Approve</button>
                              <button onClick={() => reviewLeave(l.id, 'rejected')}
                                className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">Reject</button>
                            </div>
                            <button onClick={() => setReviewingId(null)} className="w-full text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setReviewingId(l.id)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
                            Review
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Offer Letters */}
          {tab === 'offer-letters' && (
            <div className="space-y-3">
              {!offerLetters.length ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">No offer letters yet</div>
              ) : offerLetters.map(ol => (
                <div key={ol.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-900 text-sm">{ol.staff_name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor(ol.status)}`}>{ol.status}</span>
                      </div>
                      <p className="text-xs text-gray-500">{ol.role} · Starts {new Date(ol.start_date).toLocaleDateString('en-IN')}</p>
                      <p className="text-xs text-gray-600 mt-0.5">Gross: ₹{Number(ol.gross_salary).toLocaleString('en-IN')}/month</p>
                    </div>
                    {ol.pdf_url && (
                      <a href={ol.pdf_url} target="_blank" rel="noopener noreferrer"
                        className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100">
                        📄 View PDF
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Resignations */}
          {tab === 'resignations' && (
            <div className="space-y-3">
              {!resignations.length ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">No resignations</div>
              ) : resignations.map(r => (
                <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-900 text-sm">{r.staff_name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor(r.resignation_status || 'pending')}`}>
                          {r.resignation_status || 'pending'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Submitted {new Date(r.event_date).toLocaleDateString('en-IN')}
                        {r.notice_period_days ? ` · ${r.notice_period_days} days notice` : ''}
                      </p>
                    </div>
                    {(!r.resignation_status || r.resignation_status === 'pending') && (
                      <button onClick={() => acknowledgeResignation(r.id)}
                        className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
