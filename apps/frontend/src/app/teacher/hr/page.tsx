'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost, API_BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';
import {
  ChevronLeft, FileText, Wallet, CalendarDays, CheckCircle2,
  Clock, XCircle, Plus, Download, AlertCircle, Loader2, LogOut,
  PenLine, Type,
} from 'lucide-react';
import InlineMicButton from '@/components/InlineMicButton';

interface Payslip {
  id: string; year: number; month: number; gross_salary: number; net_salary: number;
  present_days: number; absent_days: number; leave_days: number;
  deduction_amount: number; status: string; payment_date: string | null;
  payslip_url: string | null; payslip_status: string;
}
interface OfferLetter {
  id: string; role: string; start_date: string; gross_salary: number;
  components: { name: string; amount: number }[];
  employment_terms: string | null; pdf_url: string | null;
  status: 'pending' | 'signed' | 'declined'; signed_at: string | null; created_at: string;
}
interface LeaveRequest {
  id: string; leave_type: string; from_date: string; to_date: string; days: number;
  reason: string | null; status: 'pending' | 'approved' | 'rejected';
  review_note: string | null; reviewed_at: string | null; created_at: string;
}
interface ResignationRecord {
  id: string; event_type: string; last_working_day?: string;
  notice_period_days?: number; resignation_reason?: string;
  resignation_status?: string; created_at: string;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const LEAVE_TYPES = ['sick', 'casual', 'earned', 'unpaid', 'other'];

// ── SignatureCapture component ────────────────────────────────────────────────
interface SignatureCaptureProps {
  offerId: string;
  token: string;
  onSigned: (updated: OfferLetter) => void;
}

function SignatureCapture({ offerId, token, onSigned }: SignatureCaptureProps) {
  const [mode, setMode] = useState<'typed' | 'drawn'>('typed');
  const [typedName, setTypedName] = useState('');
  const [hasStrokes, setHasStrokes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  // Drawing helpers
  const getPos = (e: PointerEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as PointerEvent).clientX - rect.left, y: (e as PointerEvent).clientY - rect.top };
  };

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const onPointerDown = (e: PointerEvent) => {
      isDrawing.current = true;
      const { x, y } = getPos(e, canvas);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDrawing.current) return;
      const { x, y } = getPos(e, canvas);
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasStrokes(true);
    };
    const onPointerUp = () => { isDrawing.current = false; };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      isDrawing.current = true;
      const { x, y } = getPos(e, canvas);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!isDrawing.current) return;
      const { x, y } = getPos(e, canvas);
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasStrokes(true);
    };
    const onTouchEnd = (e: TouchEvent) => { e.preventDefault(); isDrawing.current = false; };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  async function submit() {
    setError('');
    if (mode === 'typed' && !typedName.trim()) {
      setError('Please type your name to sign.');
      return;
    }
    if (mode === 'drawn' && !hasStrokes) {
      setError('Please draw your signature.');
      return;
    }
    setSubmitting(true);
    try {
      let signature_value = typedName.trim();
      if (mode === 'drawn') {
        signature_value = canvasRef.current!.toDataURL('image/png');
      }
      const updated = await apiPost<OfferLetter>(
        `/api/v1/staff/hr/offer-letters/${offerId}/sign`,
        { signature_type: mode, signature_value },
        token,
      );
      onSigned(updated);
    } catch (e: any) {
      setError(e.message || 'Failed to sign offer letter');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border border-neutral-200 rounded-xl p-4 space-y-3 mt-3">
      <p className="text-xs font-bold text-neutral-700">Sign Offer Letter</p>

      {/* Mode toggle */}
      <div className="flex gap-1 bg-neutral-100 rounded-xl p-1">
        <button onClick={() => setMode('typed')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === 'typed' ? 'bg-white shadow-sm text-neutral-800' : 'text-neutral-500'}`}>
          <Type className="w-3.5 h-3.5" /> Type Name
        </button>
        <button onClick={() => setMode('drawn')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === 'drawn' ? 'bg-white shadow-sm text-neutral-800' : 'text-neutral-500'}`}>
          <PenLine className="w-3.5 h-3.5" /> Draw Signature
        </button>
      </div>

      {mode === 'typed' && (
        <input value={typedName} onChange={e => setTypedName(e.target.value)}
          placeholder="Type your full name…"
          className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
      )}

      {mode === 'drawn' && (
        <div className="space-y-2">
          <canvas ref={canvasRef} width={300} height={120}
            className="w-full border border-neutral-200 rounded-xl bg-white touch-none cursor-crosshair" />
          <button onClick={clearCanvas}
            className="text-xs text-neutral-500 hover:text-neutral-700 underline">
            Clear
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

      <button onClick={submit} disabled={submitting}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50">
        {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
        Submit Signature
      </button>
    </div>
  );
}

export default function TeacherHRPage() {
  const router = useRouter();
  const token = getToken() || '';
  const [tab, setTab] = useState<'payslips' | 'offer' | 'leave' | 'resignation'>('payslips');
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [offers, setOffers] = useState<OfferLetter[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [resignations, setResignations] = useState<ResignationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState<string | null>(null);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leave_type: 'sick', from_date: '', to_date: '', reason: '' });
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveMsg, setLeaveMsg] = useState('');

  // Resignation form state
  const today = new Date().toISOString().split('T')[0];
  const [resignForm, setResignForm] = useState({ last_working_day: '', reason: '' });
  const [submittingResign, setSubmittingResign] = useState(false);
  const [resignMsg, setResignMsg] = useState('');
  const [resignNoticeDays, setResignNoticeDays] = useState<number | null>(null);

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    Promise.all([
      apiGet<Payslip[]>('/api/v1/staff/hr/my-payslips', token).then(setPayslips).catch(() => {}),
      apiGet<OfferLetter[]>('/api/v1/staff/hr/my-offer-letters', token).then(setOffers).catch(() => {}),
      apiGet<LeaveRequest[]>('/api/v1/staff/hr/my-leaves', token).then(setLeaves).catch(() => {}),
      apiGet<ResignationRecord[]>('/api/v1/teacher/hr/resignations', token).then(setResignations).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  async function declineOffer(id: string) {
    setSigning(id + '_decline');
    try {
      const updated = await apiPost<OfferLetter>(`/api/v1/staff/hr/offer-letters/${id}/decline`, {}, token);
      setOffers(prev => prev.map(o => o.id === id ? updated : o));
    } catch { /* ignore */ } finally { setSigning(null); }
  }

  function handleSigned(updated: OfferLetter) {
    setOffers(prev => prev.map(o => o.id === updated.id ? updated : o));
  }

  async function submitResignation() {
    if (!resignForm.last_working_day) return;
    setSubmittingResign(true); setResignMsg('');
    try {
      const res = await apiPost<{ notice_period_days: number }>('/api/v1/teacher/hr/resignations', resignForm, token);
      setResignNoticeDays(res.notice_period_days);
      setResignMsg('success');
      // Refresh resignations
      apiGet<ResignationRecord[]>('/api/v1/teacher/hr/resignations', token).then(setResignations).catch(() => {});
    } catch (e: any) {
      if (e.message?.includes('RESIGNATION_EXISTS') || e.message?.includes('active resignation')) {
        setResignMsg('exists');
      } else {
        setResignMsg(e.message || 'Failed to submit resignation');
      }
    } finally { setSubmittingResign(false); }
  }

  async function submitLeave() {
    if (!leaveForm.from_date || !leaveForm.to_date) return;
    setSubmittingLeave(true); setLeaveMsg('');
    try {
      const newLeave = await apiPost<LeaveRequest>('/api/v1/staff/hr/my-leaves', leaveForm, token);
      setLeaves(prev => [newLeave, ...prev]);
      setLeaveMsg('Leave application submitted successfully.');
      setShowLeaveForm(false);
      setLeaveForm({ leave_type: 'sick', from_date: '', to_date: '', reason: '' });
    } catch (e: any) { setLeaveMsg(e.message || 'Failed to submit'); }
    finally { setSubmittingLeave(false); }
  }

  const statusBadge = (status: string) => {
    if (status === 'approved' || status === 'signed') return 'bg-emerald-100 text-emerald-700';
    if (status === 'rejected' || status === 'declined') return 'bg-red-100 text-red-600';
    return 'bg-amber-100 text-amber-700';
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="text-white px-4 py-3 flex items-center gap-3 shrink-0"
        style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 100%)' }}>
        <button onClick={() => router.back()} className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="text-sm font-bold">My HR</p>
          <p className="text-xs text-white/70">Salary · Leave · Offer Letter</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex bg-white border-b border-neutral-100 px-4 pt-3 gap-1">
        {([
          { id: 'payslips',    label: 'Salary Slips', Icon: Wallet },
          { id: 'offer',       label: 'Offer Letter', Icon: FileText },
          { id: 'leave',       label: 'Leave',        Icon: CalendarDays },
          { id: 'resignation', label: 'Resignation',  Icon: LogOut },
        ] as const).map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-xs font-semibold border-b-2 transition-all ${
              tab === id ? 'border-primary-600 text-primary-700 bg-primary-50' : 'border-transparent text-neutral-400 hover:text-neutral-600'
            }`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      <div className="flex-1 p-4 space-y-3 max-w-lg mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-neutral-300" />
          </div>
        ) : (
          <>
            {/* ── Salary Slips ── */}
            {tab === 'payslips' && (
              payslips.length === 0 ? (
                <div className="text-center py-16">
                  <Wallet className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
                  <p className="text-sm text-neutral-400">No salary slips released yet</p>
                  <p className="text-xs text-neutral-300 mt-1">Your payslips will appear here once released by admin</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {payslips.map(p => (
                    <div key={p.id} className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-bold text-neutral-800">{MONTHS[p.month - 1]} {p.year}</p>
                          <p className="text-xs text-neutral-400">{p.present_days} present · {p.absent_days} absent · {p.leave_days} leave</p>
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadge(p.status)}`}>
                          {p.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-neutral-50 rounded-xl p-2.5">
                          <p className="text-[10px] text-neutral-400">Gross</p>
                          <p className="text-sm font-bold text-neutral-800">₹{p.gross_salary.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="bg-emerald-50 rounded-xl p-2.5">
                          <p className="text-[10px] text-neutral-400">Net Pay</p>
                          <p className="text-sm font-bold text-emerald-700">₹{p.net_salary.toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                      {p.payslip_url && (
                        <a href={p.payslip_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full py-2 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-50 transition-colors">
                          <Download className="w-3.5 h-3.5" /> Download Payslip
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {/* ── Offer Letters ── */}
            {tab === 'offer' && (
              offers.length === 0 ? (
                <div className="text-center py-16">
                  <FileText className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
                  <p className="text-sm text-neutral-400">No offer letters yet</p>
                  <p className="text-xs text-neutral-300 mt-1">Offer letters from your school will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {offers.map(o => (
                    <div key={o.id} className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-bold text-neutral-800">{o.role}</p>
                          <p className="text-xs text-neutral-400">
                            From {new Date(o.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadge(o.status)}`}>
                          {o.status}
                        </span>
                      </div>

                      <div className="bg-neutral-50 rounded-xl p-3 mb-3">
                        <p className="text-xs text-neutral-500 mb-1">Gross Salary</p>
                        <p className="text-lg font-black text-neutral-800">₹{o.gross_salary.toLocaleString('en-IN')}<span className="text-xs font-normal text-neutral-400">/month</span></p>
                        {o.components?.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {o.components.map((c, i) => (
                              <div key={i} className="flex justify-between text-xs text-neutral-500">
                                <span>{c.name}</span>
                                <span>₹{c.amount.toLocaleString('en-IN')}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {o.employment_terms && (
                        <p className="text-xs text-neutral-500 mb-3 leading-relaxed">{o.employment_terms}</p>
                      )}

                      <div className="flex gap-2">
                        {o.pdf_url && (
                          <a href={o.pdf_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-2 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors">
                            <Download className="w-3.5 h-3.5" /> View PDF
                          </a>
                        )}
                        {o.status === 'pending' && (
                          <button onClick={() => declineOffer(o.id)} disabled={signing === o.id + '_decline'}
                            className="px-3 py-2 border border-red-200 text-red-600 rounded-xl text-xs font-medium hover:bg-red-50 transition-colors disabled:opacity-50">
                            Decline
                          </button>
                        )}
                        {o.status === 'signed' && (
                          <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Signed on {new Date(o.signed_at!).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                      {o.status === 'pending' && (
                        <SignatureCapture offerId={o.id} token={token} onSigned={handleSigned} />
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {/* ── Leave ── */}
            {tab === 'leave' && (
              <>
                <button onClick={() => setShowLeaveForm(v => !v)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl text-sm font-bold transition-colors">
                  <Plus className="w-4 h-4" /> Apply for Leave
                </button>

                {showLeaveForm && (
                  <div className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm space-y-3">
                    <p className="text-sm font-bold text-neutral-800">New Leave Application</p>
                    <div>
                      <label className="text-xs font-medium text-neutral-600 mb-1 block">Leave Type</label>
                      <select value={leaveForm.leave_type} onChange={e => setLeaveForm(f => ({ ...f, leave_type: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/30">
                        {LEAVE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-neutral-600 mb-1 block">From</label>
                        <input type="date" value={leaveForm.from_date} onChange={e => setLeaveForm(f => ({ ...f, from_date: e.target.value }))}
                          className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-neutral-600 mb-1 block">To</label>
                        <input type="date" value={leaveForm.to_date} min={leaveForm.from_date}
                          onChange={e => setLeaveForm(f => ({ ...f, to_date: e.target.value }))}
                          className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-neutral-600 mb-1 block">Reason (optional)</label>
                      <div className="flex gap-2 items-start">
                        <textarea value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
                          rows={2} placeholder="Brief reason for leave…"
                          className="flex-1 px-3 py-2.5 border border-neutral-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                        <InlineMicButton onTranscript={t => setLeaveForm(f => ({ ...f, reason: (f.reason ? f.reason + ' ' : '') + t }))} />
                      </div>
                    </div>
                    {leaveMsg && <p className={`text-xs font-medium ${leaveMsg.includes('success') ? 'text-emerald-600' : 'text-red-500'}`}>{leaveMsg}</p>}
                    <button onClick={submitLeave} disabled={submittingLeave || !leaveForm.from_date || !leaveForm.to_date}
                      className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                      {submittingLeave ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Submit Application
                    </button>
                  </div>
                )}

                {leaveMsg && !showLeaveForm && (
                  <p className="text-xs text-emerald-600 font-medium text-center">{leaveMsg}</p>
                )}

                {leaves.length === 0 ? (
                  <div className="text-center py-10">
                    <CalendarDays className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
                    <p className="text-sm text-neutral-400">No leave applications yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {leaves.map(l => (
                      <div key={l.id} className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-semibold text-neutral-800 capitalize">{l.leave_type} Leave</p>
                            <p className="text-xs text-neutral-500 mt-0.5">
                              {new Date(l.from_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} –{' '}
                              {new Date(l.to_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {' '}· {l.days} day{l.days !== 1 ? 's' : ''}
                            </p>
                            {l.reason && <p className="text-xs text-neutral-400 mt-1">{l.reason}</p>}
                            {l.review_note && (
                              <p className="text-xs text-neutral-500 mt-1 italic">Note: {l.review_note}</p>
                            )}
                          </div>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${statusBadge(l.status)}`}>
                            {l.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Resignation ── */}
            {tab === 'resignation' && (() => {
              const pending = resignations.find(r => r.resignation_status === 'pending');
              return pending ? (
                <div className="bg-white rounded-2xl border border-amber-200 p-4 shadow-sm space-y-2">
                  <p className="text-sm font-bold text-neutral-800">Resignation Submitted</p>
                  {pending.last_working_day && (
                    <p className="text-xs text-neutral-600">
                      Last working day: <span className="font-semibold">{new Date(pending.last_working_day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </p>
                  )}
                  {pending.notice_period_days != null && (
                    <p className="text-xs text-neutral-600">Notice period: <span className="font-semibold">{pending.notice_period_days} days</span></p>
                  )}
                  <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadge(pending.resignation_status || 'pending')}`}>
                    {pending.resignation_status || 'pending'}
                  </span>
                </div>
              ) : resignMsg === 'success' ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-sm font-bold text-emerald-700">Resignation submitted</p>
                  {resignNoticeDays != null && (
                    <p className="text-xs text-emerald-600">Your notice period is {resignNoticeDays} days.</p>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm space-y-3">
                  <p className="text-sm font-bold text-neutral-800">Submit Resignation</p>
                  <div>
                    <label className="text-xs font-medium text-neutral-600 mb-1 block">Last Working Day</label>
                    <input type="date" min={today} value={resignForm.last_working_day}
                      onChange={e => setResignForm(f => ({ ...f, last_working_day: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-neutral-600 mb-1 block">Reason (optional)</label>
                    <textarea value={resignForm.reason} onChange={e => setResignForm(f => ({ ...f, reason: e.target.value }))}
                      rows={3} placeholder="Brief reason…"
                      className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                  </div>
                  {resignMsg === 'exists' && (
                    <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> You already have an active resignation.
                    </p>
                  )}
                  {resignMsg && resignMsg !== 'exists' && resignMsg !== 'success' && (
                    <p className="text-xs text-red-500 font-medium">{resignMsg}</p>
                  )}
                  <button onClick={submitResignation} disabled={submittingResign || !resignForm.last_working_day}
                    className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {submittingResign ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                    Submit Resignation
                  </button>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
