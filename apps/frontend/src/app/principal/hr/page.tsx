'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost, apiPatch, API_BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';
import {
  ChevronLeft, FileText, CalendarDays, CheckCircle2, XCircle,
  Clock, Plus, Download, Users, Loader2, ChevronDown
} from 'lucide-react';

interface OfferLetter {
  id: string; staff_name: string; staff_email: string; role: string;
  start_date: string; gross_salary: number;
  components: { name: string; amount: number }[];
  employment_terms: string | null; pdf_url: string | null;
  status: 'pending' | 'signed' | 'declined'; signed_at: string | null;
  created_by_name: string | null; created_at: string;
}
interface LeaveRequest {
  id: string; staff_name: string; staff_email: string;
  leave_type: string; from_date: string; to_date: string; days: number;
  reason: string | null; status: 'pending' | 'approved' | 'rejected';
  review_note: string | null; reviewed_at: string | null; created_at: string;
}
interface StaffUser { id: string; name: string; email: string; role_name: string; }

const LEAVE_TYPES = ['sick', 'casual', 'earned', 'unpaid', 'other'];

export default function PrincipalHRPage() {
  const router = useRouter();
  const token = getToken() || '';
  const [tab, setTab] = useState<'offers' | 'leaves'>('leaves');
  const [offers, setOffers] = useState<OfferLetter[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [offerForm, setOfferForm] = useState({
    user_id: '', role: '', start_date: '', gross_salary: '',
    employment_terms: 'This offer is subject to satisfactory completion of background verification. Standard school policies apply.',
    components: [{ name: 'Basic', amount: '' }, { name: 'HRA', amount: '' }, { name: 'Other Allowances', amount: '' }],
  });
  const [creatingOffer, setCreatingOffer] = useState(false);
  const [offerMsg, setOfferMsg] = useState('');

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    Promise.all([
      apiGet<OfferLetter[]>('/api/v1/staff/hr/offer-letters', token).then(setOffers).catch(() => {}),
      apiGet<LeaveRequest[]>('/api/v1/staff/hr/leaves', token).then(setLeaves).catch(() => {}),
      apiGet<any[]>('/api/v1/admin/users', token).then(data => {
        // admin/users returns 'role' field (not role_name)
        const staffRoles = ['teacher', 'admin', 'principal'];
        setStaff(data.filter(u => staffRoles.includes(u.role)).map(u => ({ id: u.id, name: u.name, email: u.mobile || '', role_name: u.role })));
      }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  async function reviewLeave(id: string, status: 'approved' | 'rejected', note?: string) {
    setReviewing(id);
    try {
      const updated = await apiPatch<LeaveRequest>(`/api/v1/staff/hr/leaves/${id}`, { status, review_note: note || null }, token);
      setLeaves(prev => prev.map(l => l.id === id ? updated : l));
    } catch { /* ignore */ } finally { setReviewing(null); }
  }

  async function createOffer() {
    if (!offerForm.user_id || !offerForm.role || !offerForm.start_date || !offerForm.gross_salary) return;
    setCreatingOffer(true); setOfferMsg('');
    try {
      const components = offerForm.components
        .filter(c => c.name && c.amount)
        .map(c => ({ name: c.name, amount: parseFloat(c.amount) }));
      const newOffer = await apiPost<OfferLetter>('/api/v1/staff/hr/offer-letters', {
        user_id: offerForm.user_id,
        role: offerForm.role,
        start_date: offerForm.start_date,
        gross_salary: parseFloat(offerForm.gross_salary),
        components,
        employment_terms: offerForm.employment_terms,
      }, token);
      setOffers(prev => [newOffer, ...prev]);
      setOfferMsg('Offer letter created and sent to staff member.');
      setShowOfferForm(false);
    } catch (e: any) { setOfferMsg(e.message || 'Failed to create offer letter'); }
    finally { setCreatingOffer(false); }
  }

  const statusBadge = (status: string) => {
    if (status === 'approved' || status === 'signed') return 'bg-emerald-100 text-emerald-700';
    if (status === 'rejected' || status === 'declined') return 'bg-red-100 text-red-600';
    return 'bg-amber-100 text-amber-700';
  };

  const pendingLeaves = leaves.filter(l => l.status === 'pending');

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="text-white px-4 py-3 flex items-center gap-3 shrink-0"
        style={{ background: 'linear-gradient(135deg, #0a1f14 0%, #1a3c2e 100%)' }}>
        <button onClick={() => router.back()} className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <p className="text-sm font-bold">Staff HR</p>
          <p className="text-xs text-white/70">Offer Letters · Leave Requests</p>
        </div>
        {pendingLeaves.length > 0 && (
          <span className="bg-amber-400 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-full">
            {pendingLeaves.length} pending
          </span>
        )}
      </header>

      {/* Tabs */}
      <div className="flex bg-white border-b border-neutral-100 px-4 pt-3 gap-1">
        {([
          { id: 'leaves', label: 'Leave Requests', Icon: CalendarDays, badge: pendingLeaves.length },
          { id: 'offers', label: 'Offer Letters',  Icon: FileText,     badge: 0 },
        ] as const).map(({ id, label, Icon, badge }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-xs font-semibold border-b-2 transition-all relative ${
              tab === id ? 'border-primary-600 text-primary-700 bg-primary-50' : 'border-transparent text-neutral-400 hover:text-neutral-600'
            }`}>
            <Icon className="w-3.5 h-3.5" /> {label}
            {badge > 0 && <span className="ml-1 bg-amber-400 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>}
          </button>
        ))}
      </div>

      <div className="flex-1 p-4 space-y-3 max-w-2xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-neutral-300" />
          </div>
        ) : (
          <>
            {/* ── Leave Requests ── */}
            {tab === 'leaves' && (
              leaves.length === 0 ? (
                <div className="text-center py-16">
                  <CalendarDays className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
                  <p className="text-sm text-neutral-400">No leave requests yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {leaves.map(l => (
                    <div key={l.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${l.status === 'pending' ? 'border-amber-200' : 'border-neutral-100'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-bold text-neutral-800">{l.staff_name}</p>
                          <p className="text-xs text-neutral-400 capitalize">{l.leave_type} leave · {l.days} day{l.days !== 1 ? 's' : ''}</p>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            {new Date(l.from_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} –{' '}
                            {new Date(l.to_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                          {l.reason && <p className="text-xs text-neutral-400 mt-1 italic">"{l.reason}"</p>}
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${statusBadge(l.status)}`}>
                          {l.status}
                        </span>
                      </div>
                      {l.status === 'pending' && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-neutral-100">
                          <button onClick={() => reviewLeave(l.id, 'approved')} disabled={reviewing === l.id}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50">
                            {reviewing === l.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            Approve
                          </button>
                          <button onClick={() => reviewLeave(l.id, 'rejected')} disabled={reviewing === l.id}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-red-200 text-red-600 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors disabled:opacity-50">
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {/* ── Offer Letters ── */}
            {tab === 'offers' && (
              <>
                <button onClick={() => setShowOfferForm(v => !v)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl text-sm font-bold transition-colors">
                  <Plus className="w-4 h-4" /> Create Offer Letter
                </button>

                {showOfferForm && (
                  <div className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm space-y-3">
                    <p className="text-sm font-bold text-neutral-800">New Offer Letter</p>
                    <div>
                      <label className="text-xs font-medium text-neutral-600 mb-1 block">Staff Member</label>
                      <select value={offerForm.user_id} onChange={e => setOfferForm(f => ({ ...f, user_id: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/30">
                        <option value="">Select staff…</option>
                        {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role_name})</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-neutral-600 mb-1 block">Role / Designation</label>
                        <input value={offerForm.role} onChange={e => setOfferForm(f => ({ ...f, role: e.target.value }))}
                          placeholder="e.g. Class Teacher"
                          className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-neutral-600 mb-1 block">Start Date</label>
                        <input type="date" value={offerForm.start_date} onChange={e => setOfferForm(f => ({ ...f, start_date: e.target.value }))}
                          className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-neutral-600 mb-1 block">Gross Salary (₹/month)</label>
                      <input type="number" value={offerForm.gross_salary} onChange={e => setOfferForm(f => ({ ...f, gross_salary: e.target.value }))}
                        placeholder="0"
                        className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-neutral-600 mb-2 block">Salary Components</label>
                      {offerForm.components.map((c, i) => (
                        <div key={i} className="flex gap-2 mb-2">
                          <input value={c.name} onChange={e => setOfferForm(f => ({ ...f, components: f.components.map((x, j) => j === i ? { ...x, name: e.target.value } : x) }))}
                            placeholder="Component name"
                            className="flex-1 px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                          <input type="number" value={c.amount} onChange={e => setOfferForm(f => ({ ...f, components: f.components.map((x, j) => j === i ? { ...x, amount: e.target.value } : x) }))}
                            placeholder="₹"
                            className="w-24 px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                        </div>
                      ))}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-neutral-600 mb-1 block">Employment Terms</label>
                      <textarea value={offerForm.employment_terms} onChange={e => setOfferForm(f => ({ ...f, employment_terms: e.target.value }))}
                        rows={3} className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                    </div>
                    {offerMsg && <p className={`text-xs font-medium ${offerMsg.includes('created') ? 'text-emerald-600' : 'text-red-500'}`}>{offerMsg}</p>}
                    <button onClick={createOffer} disabled={creatingOffer || !offerForm.user_id || !offerForm.role || !offerForm.start_date || !offerForm.gross_salary}
                      className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                      {creatingOffer ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                      Generate & Send Offer Letter
                    </button>
                  </div>
                )}

                {offerMsg && !showOfferForm && (
                  <p className="text-xs text-emerald-600 font-medium text-center">{offerMsg}</p>
                )}

                {offers.length === 0 ? (
                  <div className="text-center py-10">
                    <FileText className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
                    <p className="text-sm text-neutral-400">No offer letters created yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {offers.map(o => (
                      <div key={o.id} className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-bold text-neutral-800">{o.staff_name}</p>
                            <p className="text-xs text-neutral-500">{o.role} · ₹{o.gross_salary.toLocaleString('en-IN')}/mo</p>
                            <p className="text-xs text-neutral-400 mt-0.5">
                              From {new Date(o.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadge(o.status)}`}>
                              {o.status}
                            </span>
                            {o.pdf_url && (
                              <a href={o.pdf_url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600">
                                <Download className="w-3 h-3" /> PDF
                              </a>
                            )}
                          </div>
                        </div>
                        {o.status === 'signed' && o.signed_at && (
                          <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Signed {new Date(o.signed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
