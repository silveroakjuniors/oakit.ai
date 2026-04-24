'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard, Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { API_BASE } from '@/lib/api';

interface FeeAccount {
  id: string;
  fee_head_name: string;
  fee_type: string;
  assigned_amount: number;
  outstanding_balance: number;
  status: 'pending' | 'partial' | 'paid' | 'overdue';
  due_date?: string;
}

interface FeesSummary {
  student_name: string;
  class_name: string;
  total_assigned: number;
  total_outstanding: number;
  total_paid: number;
  accounts: FeeAccount[];
}

interface Child {
  id: string;
  name: string;
  class_name: string;
  section_label: string;
}

interface Props {
  token: string;
  activeChild: Child | null;
}

const STATUS_CONFIG = {
  paid:    { icon: CheckCircle2, color: '#16A34A', bg: '#DCFCE7', label: 'Paid' },
  partial: { icon: Clock,        color: '#D97706', bg: '#FEF3C7', label: 'Partial' },
  pending: { icon: Clock,        color: '#2563EB', bg: '#DBEAFE', label: 'Due' },
  overdue: { icon: AlertCircle,  color: '#DC2626', bg: '#FEE2E2', label: 'Overdue' },
};

function formatAmount(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function FeesTab({ token, activeChild }: Props) {
  const [summary, setSummary] = useState<FeesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !activeChild) { setLoading(false); return; }
    setLoading(true);
    setError('');
    fetch(`${API_BASE}/api/v1/parent/fees?student_id=${activeChild.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setSummary(d);
      })
      .catch(() => setError('Could not load fee details'))
      .finally(() => setLoading(false));
  }, [token, activeChild?.id]);

  if (!activeChild) {
    return (
      <div className="rounded-xl p-8 text-center" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <span className="text-4xl block mb-3">💳</span>
        <p className="text-sm font-semibold" style={{ color: '#334155' }}>No child selected</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#1F7A5A' }} />
        <p className="text-sm" style={{ color: '#64748B' }}>Loading fee details…</p>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="space-y-4">
        {/* Header card */}
        <div className="rounded-xl p-4" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#FFF7ED' }}>
              <CreditCard size={18} style={{ color: '#EA580C' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>Fee Details</p>
              <p className="text-xs" style={{ color: '#64748B' }}>{activeChild.name} · {activeChild.class_name}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl p-8 text-center" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <span className="text-4xl block mb-3">💳</span>
          <p className="text-sm font-semibold" style={{ color: '#334155' }}>No fee records found</p>
          <p className="text-xs mt-1" style={{ color: '#64748B' }}>
            Fee details will appear here once your school sets them up.
          </p>
        </div>
      </div>
    );
  }

  const outstanding = summary.total_outstanding;
  const paid = summary.total_paid;
  const total = summary.total_assigned;
  const paidPct = total > 0 ? Math.round((paid / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg,#1F7A5A,#166A4D)', boxShadow: '0 4px 20px rgba(31,122,90,0.25)' }}>
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={16} style={{ color: 'rgba(255,255,255,0.7)' }} />
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Fee Summary
            </p>
          </div>
          <p className="text-white text-2xl font-black mb-0.5">{formatAmount(outstanding)}</p>
          <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.65)' }}>Outstanding balance</p>

          {/* Progress bar */}
          <div className="h-2 rounded-full mb-2" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <div className="h-2 rounded-full transition-all" style={{ width: `${paidPct}%`, background: '#4ADE80' }} />
          </div>
          <div className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
            <span>{formatAmount(paid)} paid</span>
            <span>{paidPct}% of {formatAmount(total)}</span>
          </div>
        </div>
      </div>

      {/* Fee breakdown */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#64748B' }}>
            Fee Breakdown
          </p>
        </div>
        <div className="divide-y divide-gray-50">
          {summary.accounts.map(acc => {
            const cfg = STATUS_CONFIG[acc.status] || STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            return (
              <div key={acc.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: cfg.bg }}>
                  <Icon size={14} style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#0F172A' }}>{acc.fee_head_name}</p>
                  <p className="text-xs" style={{ color: '#64748B' }}>
                    {acc.fee_type}
                    {acc.due_date && ` · Due ${new Date(acc.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold" style={{ color: acc.status === 'paid' ? '#16A34A' : acc.status === 'overdue' ? '#DC2626' : '#0F172A' }}>
                    {formatAmount(acc.outstanding_balance)}
                  </p>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                </div>
              </div>
            );
          })}
          {summary.accounts.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm" style={{ color: '#94A3B8' }}>No fee items found</p>
            </div>
          )}
        </div>
      </div>

      {/* Contact school note */}
      <div className="rounded-xl p-4" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
        <p className="text-xs" style={{ color: '#166534' }}>
          💡 To make a payment or for any fee-related queries, please contact the school office directly.
        </p>
      </div>
    </div>
  );
}
