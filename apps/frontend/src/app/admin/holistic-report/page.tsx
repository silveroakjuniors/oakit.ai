'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';
import {
  ChevronLeft, Plus, Trash2, GripVertical, Save, CheckCircle2,
  Loader2, ChevronDown, ChevronUp, Eye,
} from 'lucide-react';
import { Button } from '@/UIComponents';

interface SubItem { id: string; label: string; sort_order: number; }
interface Domain  { id: string; label: string; sort_order: number; sub_items: SubItem[]; }
interface ClassInfo { id: string; name: string; }
interface ReportSummary {
  id: string; student_id: string; term: string; status: string;
  student_name: string; class_name: string; section_label: string;
  shared_at: string | null; updated_at: string;
}

const TERM_LABELS: Record<string, string> = {
  mid_term: 'Mid-Term', final_term: 'Final Term',
};

export default function AdminHolisticReportPage() {
  const router = useRouter();
  const token = getToken() || '';

  const [activeTab, setActiveTab] = useState<'template' | 'reports'>('template');
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [domains, setDomains] = useState<Domain[]>([]);
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Reports tab
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [filterTerm, setFilterTerm] = useState('');
  const [loadingReports, setLoadingReports] = useState(false);

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    init();
  }, []);

  async function init() {
    setLoading(true);
    try {
      const [ctx, cls] = await Promise.all([
        apiGet<any>('/api/v1/teacher/context', token),
        apiGet<ClassInfo[]>('/api/v1/admin/classes', token),
      ]);
      setAcademicYear(ctx.academic_year || '');
      setClasses(cls || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function loadTemplate(classId: string) {
    if (!classId || !academicYear) return;
    try {
      const data = await apiGet<{ domains: Domain[] }>(
        `/api/v1/admin/holistic-template/${classId}?year=${academicYear}`, token,
      );
      setDomains(data.domains || []);
      setExpandedDomains(new Set(data.domains.map((d: Domain) => d.id)));
    } catch { setMsg('Failed to load template'); }
  }

  async function loadReports() {
    if (!academicYear) return;
    setLoadingReports(true);
    try {
      let url = `/api/v1/admin/holistic-template/reports/list?year=${academicYear}`;
      if (filterTerm) url += `&term=${filterTerm}`;
      if (selectedClassId) url += `&class_id=${selectedClassId}`;
      const data = await apiGet<ReportSummary[]>(url, token);
      setReports(data || []);
    } catch { setMsg('Failed to load reports'); }
    finally { setLoadingReports(false); }
  }

  useEffect(() => {
    if (selectedClassId && academicYear && activeTab === 'template') {
      loadTemplate(selectedClassId);
    }
  }, [selectedClassId, academicYear]);

  useEffect(() => {
    if (activeTab === 'reports' && academicYear) loadReports();
  }, [activeTab, filterTerm, selectedClassId, academicYear]);

  function addSubItem(domainId: string) {
    setDomains(prev => prev.map(d => {
      if (d.id !== domainId) return d;
      const newItem: SubItem = {
        id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label: '',
        sort_order: (d.sub_items?.length || 0) + 1,
      };
      return { ...d, sub_items: [...(d.sub_items || []), newItem] };
    }));
  }

  function updateSubItem(domainId: string, itemId: string, label: string) {
    setDomains(prev => prev.map(d => {
      if (d.id !== domainId) return d;
      return { ...d, sub_items: d.sub_items.map(i => i.id === itemId ? { ...i, label } : i) };
    }));
  }

  function removeSubItem(domainId: string, itemId: string) {
    setDomains(prev => prev.map(d => {
      if (d.id !== domainId) return d;
      return { ...d, sub_items: d.sub_items.filter(i => i.id !== itemId) };
    }));
  }

  function toggleDomain(domainId: string) {
    setExpandedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domainId)) next.delete(domainId); else next.add(domainId);
      return next;
    });
  }

  async function saveTemplate() {
    if (!selectedClassId || !academicYear) return;
    // Validate
    for (const d of domains) {
      for (const item of d.sub_items) {
        if (!item.label.trim()) {
          setMsg('All sub-item labels must be filled in');
          return;
        }
      }
    }
    setSaving(true); setMsg('');
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/admin/holistic-template/${selectedClassId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ year: academicYear, domains }),
      });
      setMsg('Template saved');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Failed to save');
    } finally { setSaving(false); }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1 rounded-lg hover:bg-neutral-100">
          <ChevronLeft className="w-5 h-5 text-neutral-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-neutral-900">Holistic Report</h1>
          <p className="text-xs text-neutral-400">Configure templates and view reports</p>
        </div>
      </header>

      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4">

        {/* Tabs */}
        <div className="flex bg-neutral-100 rounded-xl p-1">
          {(['template', 'reports'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab ? 'bg-white text-primary shadow-sm' : 'text-neutral-500'
              }`}
            >
              {tab === 'template' ? 'Assessment Template' : 'All Reports'}
            </button>
          ))}
        </div>

        {/* Class selector (shared) */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-neutral-500 mb-1 block">Class</label>
              <select
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Select class...</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-neutral-500 mb-1 block">Academic Year</label>
              <input
                type="text"
                value={academicYear}
                readOnly
                className="w-full px-3 py-2 rounded-xl border border-neutral-100 bg-neutral-50 text-sm text-neutral-500"
              />
            </div>
          </div>
        </div>

        {/* ── Template Tab ── */}
        {activeTab === 'template' && (
          <>
            {!selectedClassId ? (
              <p className="text-sm text-neutral-400 text-center py-6">Select a class to configure its assessment template</p>
            ) : (
              <>
                <p className="text-xs text-neutral-400 px-1">
                  Add sub-items under each domain. These appear on the teacher's form and the PDF report. Sub-items can differ per class.
                </p>

                {domains.map(domain => (
                  <div key={domain.id} className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                    <button
                      onClick={() => toggleDomain(domain.id)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-primary/5 hover:bg-primary/10 transition-colors"
                    >
                      <p className="text-sm font-semibold text-primary">{domain.label}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-400">{domain.sub_items?.length || 0} items</span>
                        {expandedDomains.has(domain.id)
                          ? <ChevronUp className="w-4 h-4 text-neutral-400" />
                          : <ChevronDown className="w-4 h-4 text-neutral-400" />
                        }
                      </div>
                    </button>

                    {expandedDomains.has(domain.id) && (
                      <div className="p-3 flex flex-col gap-2">
                        {domain.sub_items?.map((item, idx) => (
                          <div key={item.id} className="flex items-center gap-2">
                            <GripVertical className="w-4 h-4 text-neutral-300 shrink-0" />
                            <span className="text-xs text-neutral-400 w-5 shrink-0">{idx + 1}.</span>
                            <input
                              type="text"
                              value={item.label}
                              onChange={e => updateSubItem(domain.id, item.id, e.target.value)}
                              placeholder="e.g. Shares and takes turns"
                              className="flex-1 px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                            <button
                              onClick={() => removeSubItem(domain.id, item.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-neutral-300 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}

                        <button
                          onClick={() => addSubItem(domain.id)}
                          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium px-3 py-2 rounded-xl hover:bg-primary/5 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add sub-item
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {msg && (
                  <p className={`text-sm font-medium text-center ${msg === 'Template saved' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {msg === 'Template saved' && <CheckCircle2 className="inline w-4 h-4 mr-1" />}
                    {msg}
                  </p>
                )}

                <Button onClick={saveTemplate} loading={saving} fullWidth>
                  <Save className="w-4 h-4 mr-1.5" />
                  Save Template for {classes.find(c => c.id === selectedClassId)?.name}
                </Button>

                <p className="text-xs text-neutral-400 text-center">
                  Templates are class-specific. Nursery, Jr. KG and Sr. KG can each have different sub-items.
                </p>
              </>
            )}
          </>
        )}

        {/* ── Reports Tab ── */}
        {activeTab === 'reports' && (
          <>
            {/* Term filter */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilterTerm('')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                  !filterTerm ? 'bg-primary text-white border-primary' : 'border-neutral-200 text-neutral-500'
                }`}
              >
                All Terms
              </button>
              {Object.entries(TERM_LABELS).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setFilterTerm(k)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                    filterTerm === k ? 'bg-primary text-white border-primary' : 'border-neutral-200 text-neutral-500'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            {loadingReports ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : reports.length === 0 ? (
              <p className="text-sm text-neutral-400 text-center py-8">No reports found</p>
            ) : (
              <div className="flex flex-col gap-2">
                {reports.map(r => (
                  <div key={r.id} className="bg-white border border-neutral-200 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {r.student_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-800 truncate">{r.student_name}</p>
                      <p className="text-xs text-neutral-400">{r.class_name} — {r.section_label}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium text-neutral-600">{TERM_LABELS[r.term] || r.term}</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        r.status === 'shared'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {r.status === 'shared' ? 'Shared' : 'Draft'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
