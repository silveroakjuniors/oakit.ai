'use client';

import { useEffect, useState } from 'react';
import { getToken } from '@/lib/auth';
import { apiGet } from '@/lib/api';
import ProgressBar from '@/components/ui/ProgressBar';
import Badge from '@/components/ui/Badge';
import { Card } from '@/components/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface CoverageItem {
  section_id: string;
  section_label: string;
  class_name: string;
  class_teacher_name: string | null;
  total_chunks: number;
  covered_chunks: number;
  coverage_pct: number;
  has_curriculum: boolean;
  last_completion_date: string | null;
  plans_this_week: number;
  special_days_this_week: number;
  flagged: boolean;
  flag_note: string | null;
}

interface ChunkInfo { id: string; topic_label: string; }
interface SupplementaryActivity { pool_name: string; activity_title: string; status: string; }
interface DayPlan {
  plan_date: string;
  status: string;
  chunk_ids: string[];
  completion_id: string | null;
  covered_chunk_ids: string[] | null;
  submitted_at: string | null;
  edited_at: string | null;
  submitted_by_name: string | null;
  submitted_late: boolean;
  days_late: number;
  chunks: ChunkInfo[];
  special_day_label: string | null;
  special_day_type: string | null;
  supplementary_activities: SupplementaryActivity[];
}
interface Anomaly { teacher_name: string; late_count: number; total_count: number; message: string; }
interface SectionDetail {
  section: { id: string; label: string; class_name: string; class_teacher_name: string | null };
  plans: DayPlan[];
  anomalies: Anomaly[];
}

function coverageColor(pct: number) {
  if (pct >= 70) return 'text-green-700';
  if (pct >= 40) return 'text-amber-600';
  return 'text-red-600';
}

function DetailPanel({ sectionId, onClose }: { sectionId: string; onClose: () => void }) {
  const token = getToken() || '';
  const [detail, setDetail] = useState<SectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<SectionDetail>(`/api/v1/principal/coverage/${sectionId}`, token)
      .then(setDetail)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [sectionId]);

  const DAY_TYPE_ICONS: Record<string, string> = {
    settling: '🌱', revision: '📝', exam: '📋', event: '🎉',
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-end">
      <div className="bg-white h-full w-full max-w-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              {detail?.section.class_name} – Section {detail?.section.label}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {detail?.section.class_teacher_name
                ? `👩‍🏫 Class Teacher: ${detail.section.class_teacher_name}`
                : '⚠ No class teacher assigned'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {loading && <p className="p-5 text-gray-400 text-sm">Loading...</p>}
        {error && <p className="p-5 text-red-500 text-sm">{error}</p>}

        {detail && (
          <div className="flex-1 overflow-y-auto">
            {/* Anomaly alerts */}
            {detail.anomalies.length > 0 && (
              <div className="mx-4 mt-4 flex flex-col gap-2">
                {detail.anomalies.map((a, i) => (
                  <div key={i} className="bg-red-50 border border-red-300 rounded-xl px-4 py-3 flex gap-3">
                    <span className="text-red-500 text-lg shrink-0">⚠</span>
                    <div>
                      <p className="text-xs font-semibold text-red-700">Late Submission Alert</p>
                      <p className="text-xs text-red-600 mt-0.5">{a.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 flex flex-col gap-3">
              {detail.plans.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No day plans generated yet</p>
              )}

              {detail.plans.map(plan => {
                const dateStr = plan.plan_date?.split('T')[0];
                const isCompleted = !!plan.completion_id;
                const coveredCount = plan.covered_chunk_ids?.length || 0;
                const totalCount = plan.chunk_ids?.length || 0;
                const isSpecial = !!plan.special_day_label;
                const hasSupplementary = plan.supplementary_activities?.length > 0;

                return (
                  <div key={plan.plan_date}
                    className={`rounded-xl border p-4 ${
                      plan.submitted_late ? 'border-amber-300 bg-amber-50' :
                      isCompleted ? 'border-green-200 bg-green-50' :
                      isSpecial ? 'border-blue-200 bg-blue-50' :
                      'border-gray-200 bg-white'
                    }`}>

                    {/* Date + status row */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {new Date(dateStr + 'T12:00:00').toLocaleDateString('en-IN', {
                            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                          })}
                        </p>
                        {isSpecial && (
                          <p className="text-xs text-blue-700 mt-0.5">
                            {DAY_TYPE_ICONS[plan.special_day_type || ''] || '📅'} {plan.special_day_label}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {isCompleted ? (
                          <Badge label={`✓ ${coveredCount}/${totalCount} covered`} variant="success" />
                        ) : (
                          <Badge label="Not submitted" variant="neutral" />
                        )}
                        {plan.submitted_late && (
                          <Badge label={`⚠ ${plan.days_late}d late`} variant="warning" />
                        )}
                      </div>
                    </div>

                    {/* Planned topics */}
                    {plan.chunks.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-gray-500 mb-1">Planned topics</p>
                        <div className="flex flex-col gap-1">
                          {plan.chunks.map(chunk => {
                            const isCovered = plan.covered_chunk_ids?.includes(chunk.id);
                            return (
                              <div key={chunk.id} className="flex items-center gap-2 text-xs">
                                <span className={isCovered ? 'text-green-500' : 'text-gray-300'}>
                                  {isCovered ? '✓' : '○'}
                                </span>
                                <span className={isCovered ? 'text-gray-700' : 'text-gray-400'}>
                                  {chunk.topic_label || 'Topic'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Supplementary activities */}
                    {hasSupplementary && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-gray-500 mb-1">🎵 Activities</p>
                        <div className="flex flex-col gap-1">
                          {plan.supplementary_activities.map((sa, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className={sa.status === 'completed' ? 'text-green-500' : 'text-gray-300'}>
                                {sa.status === 'completed' ? '✓' : '○'}
                              </span>
                              <span className="text-gray-600">
                                <span className="text-gray-400">{sa.pool_name}:</span> {sa.activity_title}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Completion metadata */}
                    {isCompleted && (
                      <div className={`border-t pt-2 mt-2 ${plan.submitted_late ? 'border-amber-200' : 'border-green-200'}`}>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                          {plan.submitted_by_name && (
                            <span>👤 Marked by: <span className="font-medium text-gray-700">{plan.submitted_by_name}</span></span>
                          )}
                          {plan.submitted_at && (
                            <span>🕐 {new Date(plan.submitted_at).toLocaleString('en-IN', {
                              day: 'numeric', month: 'short',
                              hour: '2-digit', minute: '2-digit'
                            })}</span>
                          )}
                          {plan.edited_at && (
                            <span className="text-amber-600">✏ Edited: {new Date(plan.edited_at).toLocaleString('en-IN', {
                              day: 'numeric', month: 'short',
                              hour: '2-digit', minute: '2-digit'
                            })}</span>
                          )}
                          {plan.submitted_late && (
                            <span className="text-amber-700 font-medium">
                              ⚠ Submitted {plan.days_late} day{plan.days_late > 1 ? 's' : ''} after plan date
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CoverageReportPage() {
  const [items, setItems] = useState<CoverageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const token = getToken() || '';

  useEffect(() => {
    apiGet<CoverageItem[]>('/api/v1/principal/coverage', token)
      .then(setItems)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Group by class
  const byClass: Record<string, CoverageItem[]> = {};
  items.forEach(item => {
    if (!byClass[item.class_name]) byClass[item.class_name] = [];
    byClass[item.class_name].push(item);
  });

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <a href="/principal" className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</a>
        <h1 className="text-2xl font-bold text-gray-900">Coverage Report</h1>
      </div>

      {error && <p className="text-red-500 mb-4">{error}</p>}
      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : (
        <div className="flex flex-col gap-8">
          {Object.entries(byClass).map(([className, sections]) => (
            <div key={className}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{className}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sections.map(item => (
                  <div key={item.section_id}
                    onClick={() => setSelectedSection(item.section_id)}
                    className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow">

                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-gray-800">{item.class_name} – Section {item.section_label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {item.class_teacher_name ? `👩‍🏫 ${item.class_teacher_name}` : '⚠ No class teacher'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {item.flagged && <Badge label="Flagged" variant="danger" />}
                        {!item.has_curriculum && <Badge label="No curriculum" variant="neutral" />}
                      </div>
                    </div>

                    {/* Coverage bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">Curriculum coverage</span>
                        <span className={`text-sm font-bold ${coverageColor(item.coverage_pct)}`}>
                          {item.coverage_pct}%
                        </span>
                      </div>
                      <ProgressBar percent={item.coverage_pct} />
                      <p className="text-xs text-gray-400 mt-1">
                        {item.covered_chunks} of {item.total_chunks} chunks covered
                      </p>
                    </div>

                    {/* This week */}
                    <div className="flex items-center gap-3 text-xs border-t border-gray-100 pt-3">
                      <span className="text-gray-500">This week:</span>
                      <span className="text-gray-700">{item.plans_this_week} plan{item.plans_this_week !== 1 ? 's' : ''}</span>
                      {item.special_days_this_week > 0 && (
                        <span className="text-blue-600">· {item.special_days_this_week} special day{item.special_days_this_week !== 1 ? 's' : ''}</span>
                      )}
                    </div>

                    {/* Last activity */}
                    {item.last_completion_date && (
                      <p className="text-xs text-gray-400 mt-2">
                        Last completion: {new Date(item.last_completion_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    )}

                    <p className="text-xs text-primary mt-2 font-medium">View day-by-day →</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="text-gray-400">No sections found</p>}
        </div>
      )}

      {selectedSection && (
        <DetailPanel sectionId={selectedSection} onClose={() => setSelectedSection(null)} />
      )}
    </div>
  );
}
