'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Download, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { API_BASE } from '@/lib/api';

interface SavedReport {
  id: string;
  student_name: string;
  class_name: string;
  report_type: 'progress' | 'term' | 'annual';
  from_date: string;
  to_date: string;
  created_at: string;
  ai_report?: string;
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

function ReportCard({ report, token }: { report: SavedReport; token: string }) {
  const [expanded, setExpanded] = useState(false);
  const [fullReport, setFullReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const typeColors: Record<string, { bg: string; text: string }> = {
    progress: { bg: '#DCFCE7', text: '#166534' },
    term:     { bg: '#DBEAFE', text: '#1E40AF' },
    annual:   { bg: '#EDE9FE', text: '#5B21B6' },
  };
  const c = typeColors[report.report_type] || typeColors.progress;

  async function loadFull() {
    if (fullReport !== null) { setExpanded(e => !e); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/parent/reports/${report.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setFullReport(data.ai_report || '');
      setExpanded(true);
    } catch {
      setFullReport('Could not load report content.');
      setExpanded(true);
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf() {
    setDownloading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/parent/reports/${report.id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('PDF failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Report_${report.student_name.replace(/\s+/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('PDF download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  // Render AI report text with basic section formatting
  function renderReport(text: string) {
    const sections = text.split(/\n##\s+/).filter(Boolean);
    return (
      <div className="space-y-3 mt-3">
        {sections.map((section, i) => {
          const lines = section.split('\n').filter(l => l.trim());
          const heading = lines[0]?.trim() || '';
          const body = lines.slice(1).join('\n').trim();
          if (i === 0 && !heading.startsWith('##')) {
            return (
              <div key={i} className="rounded-xl p-3" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <p className="text-xs leading-relaxed" style={{ color: '#166534' }}>{section.trim()}</p>
              </div>
            );
          }
          return (
            <div key={i} className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
              <div className="px-3 py-2" style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <p className="text-xs font-semibold" style={{ color: '#0F172A' }}>{heading}</p>
              </div>
              <div className="px-3 py-2.5">
                {body.split('\n').filter(l => l.trim()).map((line, j) => (
                  <p key={j} className="text-xs leading-relaxed mb-1 last:mb-0" style={{ color: '#374151' }}>{line.trim()}</p>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{report.student_name}</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
                style={{ background: c.bg, color: c.text }}>{report.report_type}</span>
            </div>
            <p className="text-xs" style={{ color: '#64748B' }}>{report.class_name}</p>
            <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
              {report.from_date} → {report.to_date}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={downloadPdf}
              disabled={downloading}
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all"
              style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }}>
              {downloading
                ? <Loader2 size={12} className="animate-spin" />
                : <Download size={12} />}
              PDF
            </button>
            <button
              onClick={loadFull}
              disabled={loading}
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all"
              style={{ background: '#E8F3EF', color: '#1F7A5A', border: '1px solid #A7D4C0' }}>
              {loading
                ? <Loader2 size={12} className="animate-spin" />
                : expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {expanded ? 'Hide' : 'View'}
            </button>
          </div>
        </div>

        {expanded && fullReport !== null && renderReport(fullReport)}
      </div>
    </div>
  );
}

export default function ReportsTab({ token, activeChild }: Props) {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError('');
    const url = activeChild
      ? `${API_BASE}/api/v1/parent/reports?student_id=${activeChild.id}`
      : `${API_BASE}/api/v1/parent/reports`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setReports(d.reports || d || []);
      })
      .catch(() => setError('Could not load reports'))
      .finally(() => setLoading(false));
  }, [token, activeChild?.id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#1F7A5A' }} />
        <p className="text-sm" style={{ color: '#64748B' }}>Loading reports…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl p-4" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#E8F3EF' }}>
            <FileText size={18} style={{ color: '#1F7A5A' }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>Progress Reports</p>
            <p className="text-xs" style={{ color: '#64748B' }}>
              {activeChild ? `Reports shared for ${activeChild.name}` : 'All reports shared by school'}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl p-4 text-center" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <p className="text-sm" style={{ color: '#DC2626' }}>{error}</p>
        </div>
      )}

      {!error && reports.length === 0 && (
        <div className="rounded-xl p-8 text-center" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <span className="text-4xl block mb-3">📋</span>
          <p className="text-sm font-semibold" style={{ color: '#334155' }}>No reports yet</p>
          <p className="text-xs mt-1" style={{ color: '#64748B' }}>
            Reports will appear here once your school shares them with you.
          </p>
        </div>
      )}

      {reports.map(r => (
        <ReportCard key={r.id} report={r} token={token} />
      ))}
    </div>
  );
}
