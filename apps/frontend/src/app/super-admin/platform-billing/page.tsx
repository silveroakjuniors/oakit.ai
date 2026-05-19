'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPut, apiPost, apiPatch } from '@/lib/api';
import { getToken } from '@/lib/auth';

interface SchoolBillingSummary {
  id: string;
  name: string;
  school_code: string;
  cycle_revenue_inr: string;
  status: string;
  active_students: number;
  per_student_paise: number;
  per_student_inr: string;
  setup_fee_inr: string;
  gst_enabled: boolean;
  gst_percentage: number;
  billing_cycle: string;
  outstanding_invoices: number;
  outstanding_inr: string;
  total_paid_inr: string;
  monthly_revenue_inr: string;
}

interface BillingConfig {
  per_student_paise: number;
  setup_fee_paise: number;
  ai_credits_included_paise: number;
  gst_enabled: boolean;
  gst_percentage: number;
  school_gstin: string | null;
  platform_gstin: string | null;
  billing_cycle: string;
  notes: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  period_from: string;
  period_to: string;
  line_items: { description: string; quantity: number; unit_price: number; amount: number }[];
  subtotal: number;
  discount: number;
  discount_type: string | null;
  discount_description: string | null;
  gst_amount: number;
  total: number;
  gst_enabled: boolean;
  gst_percentage: number;
  school_gstin: string | null;
  student_count: number;
  status: string;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
}

// Display helper — amounts stored as rupees (decimal)
function fmt(n: number) { return Number(n).toFixed(2); }

const STATUS_COLORS: Record<string, string> = {
  draft: 'text-gray-400 bg-gray-900/30',
  sent: 'text-blue-400 bg-blue-900/30',
  paid: 'text-emerald-400 bg-emerald-900/30',
  overdue: 'text-red-400 bg-red-900/30',
  cancelled: 'text-gray-500 bg-gray-900/20',
};

const DARK = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' };
const inp = 'w-full px-3 py-2 rounded-xl border border-white/10 text-sm bg-white/5 text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-emerald-400';
const sel = 'w-full px-3 py-2 rounded-xl border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-400 appearance-none';
const selStyle = { background: '#1a2a1f' };

export default function PlatformBillingPage() {
  const [schools, setSchools] = useState<SchoolBillingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SchoolBillingSummary | null>(null);
  const [config, setConfig] = useState<BillingConfig | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [configLoading, setConfigLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'config' | 'invoices'>('config');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [invoiceForm, setInvoiceForm] = useState({
    period_from: new Date().toISOString().slice(0, 7) + '-01',
    period_to: new Date().toISOString().slice(0, 7) + '-' + new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate(),
    include_setup_fee: false,
    include_ai_credits: false,
    discount_type: 'none' as 'none' | 'percentage' | 'flat' | 'months',
    discount_value: '',
    discount_description: '',
    notes: '',
  });
  const [generating, setGenerating] = useState(false);
  const token = getToken();

  function flash(m: string, isErr = false) {
    if (isErr) { setError(m); setMsg(''); } else { setMsg(m); setError(''); }
    setTimeout(() => { setMsg(''); setError(''); }, 5000);
  }

  function load() {
    if (!token) return;
    setLoading(true);
    apiGet<SchoolBillingSummary[]>('/api/v1/super-admin/platform-billing/overview', token)
      .then(setSchools).catch(console.error).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function openSchool(s: SchoolBillingSummary) {
    setSelected(s);
    setTab('config');
    setConfigLoading(true);
    try {
      const data = await apiGet<{ config: BillingConfig }>(`/api/v1/super-admin/platform-billing/${s.id}/config`, token!);
      setConfig(data.config);
      const invData = await apiGet<Invoice[]>(`/api/v1/super-admin/platform-billing/${s.id}/invoices`, token!);
      setInvoices(invData);
    } catch (e: any) { flash(e.message, true); }
    finally { setConfigLoading(false); }
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !selected || !config) return;
    setSaving(true);
    try {
      await apiPut(`/api/v1/super-admin/platform-billing/${selected.id}/config`, config, token);
      flash('✓ Billing config saved');
      load();
    } catch (e: any) { flash(e.message, true); }
    finally { setSaving(false); }
  }

  async function handleGenerateInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !selected) return;
    setGenerating(true);
    try {
      const payload = {
        ...invoiceForm,
        discount_value: invoiceForm.discount_type !== 'none' && invoiceForm.discount_value
          ? Number(invoiceForm.discount_value) : undefined,
      };
      const inv = await apiPost<Invoice>(`/api/v1/super-admin/platform-billing/${selected.id}/invoices`, payload, token);
      setInvoices(prev => [inv, ...prev]);
      flash(`✓ Invoice ${inv.invoice_number} generated — Total: ₹${fmt(inv.total)}`);
      setTab('invoices');
    } catch (e: any) { flash(e.message, true); }
    finally { setGenerating(false); }
  }

  async function deleteInvoice(invoiceId: string, invoiceNumber: string) {
    if (!token || !confirm(`Delete invoice ${invoiceNumber}? This cannot be undone.`)) return;
    try {
      const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/+$/, '') || 'https://oakit-api-gateway.onrender.com';
      await fetch(`${apiBase}/api/v1/super-admin/platform-billing/invoices/${invoiceId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      setInvoices(prev => prev.filter(i => i.id !== invoiceId));
      flash('✓ Invoice deleted');
    } catch (e: any) { flash(e.message, true); }
  }

  async function updateInvoiceStatus(invoiceId: string, status: string) {
    if (!token) return;
    try {
      const updated = await apiPatch<Invoice>(`/api/v1/super-admin/platform-billing/invoices/${invoiceId}`, { status }, token);
      setInvoices(prev => prev.map(i => i.id === invoiceId ? updated : i));
      flash(`✓ Invoice marked as ${status}`);
    } catch (e: any) { flash(e.message, true); }
  }

  // Platform totals
  const totalMonthlyRevenue = schools.reduce((s, sc) => s + parseFloat(sc.cycle_revenue_inr ?? sc.monthly_revenue_inr), 0);
  const totalOutstanding = schools.reduce((s, sc) => s + parseFloat(sc.outstanding_inr), 0);
  const totalPaid = schools.reduce((s, sc) => s + parseFloat(sc.total_paid_inr), 0);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Platform Billing</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Per-school billing, invoices, GST configuration</p>
      </div>

      {/* Platform totals */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Cycle Revenue', value: `₹${totalMonthlyRevenue.toFixed(2)}`, color: 'text-emerald-400' },
          { label: 'Outstanding', value: `₹${totalOutstanding.toFixed(2)}`, color: totalOutstanding > 0 ? 'text-amber-400' : 'text-white/40' },
          { label: 'Total Collected', value: `₹${totalPaid.toFixed(2)}`, color: 'text-blue-400' },
        ].map(c => (
          <div key={c.label} className="rounded-2xl p-4 text-center" style={DARK}>
            <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* Schools table */}
      {loading ? <p className="text-white/40 text-sm">Loading...</p> : (
        <div className="rounded-2xl overflow-hidden mb-6" style={DARK}>
          <table className="w-full text-sm">
            <thead style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <tr>
                {['School', 'Students', 'Per Student/Mo', 'Cycle Revenue', 'Outstanding', 'GST', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schools.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white">{s.name}</p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.school_code}</p>
                  </td>
                  <td className="px-4 py-3 text-white/60">{s.active_students}</td>
                  <td className="px-4 py-3 text-white/60">₹{s.per_student_inr}</td>
                  <td className="px-4 py-3 text-emerald-400 font-semibold">
                   ₹{s.cycle_revenue_inr ?? s.monthly_revenue_inr}
                    <span className="text-white/30 text-xs ml-1">/{s.billing_cycle || 'mo'}</span>
                  </td>
                  <td className="px-4 py-3">
                    {parseFloat(s.outstanding_inr) > 0
                      ? <span className="text-amber-400 font-semibold">₹{s.outstanding_inr}</span>
                      : <span className="text-white/30">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.gst_enabled ? 'text-emerald-400 bg-emerald-900/30' : 'text-white/30 bg-white/5'}`}>
                      {s.gst_enabled ? `${s.gst_percentage}%` : 'No GST'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openSchool(s)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg text-emerald-300 border border-emerald-700/50 hover:bg-emerald-900/30">
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* School billing modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
            style={{ background: '#0f1a13', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="px-6 pt-6 pb-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <h2 className="text-base font-bold text-white">{selected.name}</h2>
                <p className="text-xs text-white/40">{selected.active_students} active students · {selected.school_code}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-white/40 hover:text-white text-xl">✕</button>
            </div>

            {(msg || error) && (
              <div className={`mx-6 mt-4 px-4 py-2.5 rounded-xl text-sm ${msg ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'}`}>
                {msg || error}
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 px-6 pt-4 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {(['config', 'invoices'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === t ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}>
                  {t === 'config' ? '⚙️ Config' : `🧾 Invoices (${invoices.length})`}
                </button>
              ))}
            </div>

            <div className="p-6">
              {configLoading ? <p className="text-white/40 text-sm">Loading...</p> : (
                <>
                  {/* Config tab */}
                  {tab === 'config' && config && (
                    <form onSubmit={handleSaveConfig} className="space-y-5">
                      {/* Charges */}
                      <div>
                        <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">Charges</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-white/40 mb-1 block">Per Student / Month (₹)</label>
                            <input type="number" min="0" step="0.01" placeholder="e.g. 50"
                              value={config.per_student_paise / 100}
                              onChange={e => setConfig(c => c ? { ...c, per_student_paise: Math.round(parseFloat(e.target.value || '0') * 100) } : c)}
                              className={inp} />
                          </div>
                          <div>
                            <label className="text-xs text-white/40 mb-1 block">One-time Setup Fee (₹)</label>
                            <input type="number" min="0" step="0.01" placeholder="e.g. 5000"
                              value={config.setup_fee_paise / 100}
                              onChange={e => setConfig(c => c ? { ...c, setup_fee_paise: Math.round(parseFloat(e.target.value || '0') * 100) } : c)}
                              className={inp} />
                          </div>
                          <div>
                            <label className="text-xs text-white/40 mb-1 block">AI Credits Included (₹)</label>
                            <input type="number" min="0" step="0.01" placeholder="e.g. 2000"
                              value={config.ai_credits_included_paise / 100}
                              onChange={e => setConfig(c => c ? { ...c, ai_credits_included_paise: Math.round(parseFloat(e.target.value || '0') * 100) } : c)}
                              className={inp} />
                          </div>
                          <div>
                            <label className="text-xs text-white/40 mb-1 block">Billing Cycle</label>
                            <select value={config.billing_cycle}
                              onChange={e => setConfig(c => c ? { ...c, billing_cycle: e.target.value } : c)}
                              className={sel} style={selStyle}>
                              <option value="monthly">Monthly</option>
                              <option value="quarterly">Quarterly</option>
                              <option value="annual">Annual</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* GST */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-bold text-white/40 uppercase tracking-widest">GST Settings</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-white/40">Enable GST</span>
                            <button type="button"
                              onClick={() => setConfig(c => c ? { ...c, gst_enabled: !c.gst_enabled } : c)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${config.gst_enabled ? 'bg-emerald-600' : 'bg-white/20'}`}>
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${config.gst_enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                            </button>
                          </div>
                        </div>
                        {config.gst_enabled && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-white/40 mb-1 block">GST % (e.g. 18)</label>
                              <input type="number" min="0" max="100" step="0.01"
                                value={config.gst_percentage}
                                onChange={e => setConfig(c => c ? { ...c, gst_percentage: parseFloat(e.target.value || '0') } : c)}
                                className={inp} />
                            </div>
                            <div>
                              <label className="text-xs text-white/40 mb-1 block">School GSTIN (optional)</label>
                              <input type="text" placeholder="22AAAAA0000A1Z5"
                                value={config.school_gstin || ''}
                                onChange={e => setConfig(c => c ? { ...c, school_gstin: e.target.value || null } : c)}
                                className={inp} />
                            </div>
                            <div className="col-span-2">
                              <label className="text-xs text-white/40 mb-1 block">Platform GSTIN (optional)</label>
                              <input type="text" placeholder="Platform GST number"
                                value={config.platform_gstin || ''}
                                onChange={e => setConfig(c => c ? { ...c, platform_gstin: e.target.value || null } : c)}
                                className={inp} />
                            </div>
                          </div>
                        )}
                        {!config.gst_enabled && (
                          <p className="text-xs text-white/30">GST is disabled. Enable to add GST to invoices.</p>
                        )}
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="text-xs text-white/40 mb-1 block">Internal Notes</label>
                        <textarea rows={2} placeholder="Any billing notes..."
                          value={config.notes || ''}
                          onChange={e => setConfig(c => c ? { ...c, notes: e.target.value || null } : c)}
                          className={`${inp} resize-none`} />
                      </div>

                      <button type="submit" disabled={saving}
                        className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                        style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}>
                        {saving ? 'Saving...' : 'Save Config'}
                      </button>
                    </form>
                  )}

                  {/* Invoices tab */}
                  {tab === 'invoices' && (
                    <div className="space-y-4">
                      {/* Generate invoice form */}
                      <form onSubmit={handleGenerateInvoice} className="rounded-2xl p-4 space-y-3" style={DARK}>
                        <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Generate Invoice</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-white/40 mb-1 block">Period From</label>
                            <input type="date" value={invoiceForm.period_from}
                              onChange={e => setInvoiceForm(p => ({ ...p, period_from: e.target.value }))}
                              className={inp} />
                          </div>
                          <div>
                            <label className="text-xs text-white/40 mb-1 block">Period To</label>
                            <input type="date" value={invoiceForm.period_to}
                              onChange={e => setInvoiceForm(p => ({ ...p, period_to: e.target.value }))}
                              className={inp} />
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
                            <input type="checkbox" checked={invoiceForm.include_setup_fee}
                              onChange={e => setInvoiceForm(p => ({ ...p, include_setup_fee: e.target.checked }))}
                              className="rounded" />
                            Include setup fee
                          </label>
                          <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
                            <input type="checkbox" checked={invoiceForm.include_ai_credits}
                              onChange={e => setInvoiceForm(p => ({ ...p, include_ai_credits: e.target.checked }))}
                              className="rounded" />
                            Include AI credits
                          </label>
                        </div>
                        <input type="text" placeholder="Notes (optional)" value={invoiceForm.notes}
                          onChange={e => setInvoiceForm(p => ({ ...p, notes: e.target.value }))}
                          className={inp} />

                        {/* Discount */}
                        <div>
                          <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Discount (optional)</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-white/40 mb-1 block">Discount Type</label>
                              <select value={invoiceForm.discount_type}
                                onChange={e => setInvoiceForm(p => ({ ...p, discount_type: e.target.value as any, discount_value: '' }))}
                                className={sel} style={selStyle}>
                                <option value="none">No Discount</option>
                                <option value="percentage">Percentage (%)</option>
                                <option value="flat">Flat Amount (₹)</option>
                                <option value="months">Free Months</option>
                              </select>
                            </div>
                            {invoiceForm.discount_type !== 'none' && (
                              <div>
                                <label className="text-xs text-white/40 mb-1 block">
                                  {invoiceForm.discount_type === 'percentage' ? 'Discount %' :
                                   invoiceForm.discount_type === 'flat' ? 'Amount (₹)' : 'Free Months'}
                                </label>
                                <input type="number" min="0"
                                  step={invoiceForm.discount_type === 'months' ? '1' : '0.01'}
                                  placeholder={invoiceForm.discount_type === 'percentage' ? 'e.g. 10' :
                                               invoiceForm.discount_type === 'flat' ? 'e.g. 5000' : 'e.g. 2'}
                                  value={invoiceForm.discount_value}
                                  onChange={e => setInvoiceForm(p => ({ ...p, discount_value: e.target.value }))}
                                  className={inp} />
                              </div>
                            )}
                          </div>
                          {invoiceForm.discount_type !== 'none' && (
                            <input type="text" placeholder="Discount reason (e.g. Early bird, Loyalty)" value={invoiceForm.discount_description}
                              onChange={e => setInvoiceForm(p => ({ ...p, discount_description: e.target.value }))}
                              className={`${inp} mt-2`} />
                          )}
                        </div>
                        <button type="submit" disabled={generating}
                          className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                          style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}>
                          {generating ? 'Generating...' : 'Generate Invoice'}
                        </button>
                      </form>

                      {/* Invoice list */}
                      {!invoices.length ? (
                        <p className="text-white/30 text-sm text-center py-4">No invoices yet</p>
                      ) : invoices.map(inv => (
                        <div key={inv.id} className="rounded-2xl p-4" style={DARK}>
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div>
                              <p className="font-bold text-white text-sm">{inv.invoice_number}</p>
                              <p className="text-xs text-white/40">
                                {new Date(inv.period_from).toLocaleDateString('en-IN')} – {new Date(inv.period_to).toLocaleDateString('en-IN')}
                                {' · '}{inv.student_count} students
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-white text-lg">₹{fmt(inv.total)}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[inv.status] || ''}`}>{inv.status}</span>
                            </div>
                          </div>
                          {/* Line items */}
                          <div className="space-y-1 mb-3 text-xs">
                            {inv.line_items.map((li, i) => (
                              <div key={i} className="flex justify-between text-white/50">
                                <span>{li.description}</span>
                                <span>₹{fmt(li.amount)}</span>
                              </div>
                            ))}
                            {inv.discount > 0 && (
                              <div className="flex justify-between text-amber-400">
                                <span>Discount{inv.discount_description ? ` (${inv.discount_description})` : ''}</span>
                                <span>−₹{fmt(inv.discount)}</span>
                              </div>
                            )}
                            {inv.gst_enabled && inv.gst_amount > 0 && (
                              <div className="flex justify-between text-white/50">
                                <span>GST ({inv.gst_percentage}%)</span>
                                <span>₹{fmt(inv.gst_amount)}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-bold text-white border-t border-white/10 pt-1 mt-1">
                              <span>Total</span>
                              <span>₹{fmt(inv.total)}</span>
                            </div>
                          </div>
                          {/* Actions */}
                          <div className="flex gap-2 flex-wrap">
                            {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                              <>
                                {inv.status === 'draft' && (
                                  <button onClick={() => updateInvoiceStatus(inv.id, 'sent')}
                                    className="text-xs px-3 py-1.5 rounded-lg text-blue-300 border border-blue-700/50 hover:bg-blue-900/30">
                                    Mark Sent
                                  </button>
                                )}
                                <button onClick={() => updateInvoiceStatus(inv.id, 'paid')}
                                  className="text-xs px-3 py-1.5 rounded-lg text-emerald-300 border border-emerald-700/50 hover:bg-emerald-900/30">
                                  Mark Paid
                                </button>
                                <button onClick={() => updateInvoiceStatus(inv.id, 'cancelled')}
                                  className="text-xs px-3 py-1.5 rounded-lg text-red-300 border border-red-700/50 hover:bg-red-900/30">
                                  Cancel
                                </button>
                              </>
                            )}
                            {(inv.status === 'draft' || inv.status === 'cancelled') && (
                              <button onClick={() => deleteInvoice(inv.id, inv.invoice_number)}
                                className="text-xs px-3 py-1.5 rounded-lg text-red-400 border border-red-800/50 hover:bg-red-900/30 ml-auto">
                                🗑 Delete
                              </button>
                            )}
                          </div>
                          {inv.paid_at && (
                            <p className="text-xs text-emerald-400 mt-1">Paid on {new Date(inv.paid_at).toLocaleDateString('en-IN')}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
