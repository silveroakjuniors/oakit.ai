'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card } from '@/components/ui';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { getToken, clearToken } from '@/lib/auth';
import ProgressBar from '@/components/ui/ProgressBar';
import Badge from '@/components/ui/Badge';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ─── Types ───────────────────────────────────────────────────────────────────
interface CoveredChunk { id: string; topic_label: string; }
interface Absence { student_id: string; student_name: string; date: string; covered_chunks: CoveredChunk[]; }
interface CompletedTask { id: string; student_name: string; topic_label: string; absence_date: string; done_at: string; }

interface FeedItem { student_id: string; student_name: string; type: 'curriculum' | 'special_day' | 'empty'; topic_labels?: string[]; settling_day_note?: string; label?: string; }
interface AttendanceRecord { attend_date: string; status: 'present' | 'absent'; }
interface AttendanceHistory { student_id: string; student_name: string; records: AttendanceRecord[]; attendance_pct: number; }
interface Notification { id: string; section_name: string; completion_date: string; chunks_covered: number; is_read: boolean; created_at: string; }
interface ProgressItem { student_id: string; student_name: string; coverage_pct: number; has_curriculum: boolean; }

type Tab = 'feed' | 'attendance' | 'notifications' | 'progress' | 'absences' | 'settings';

export default function ParentPage() {
  const router = useRouter();
  const token = getToken() || '';
  const [tab, setTab] = useState<Tab>('feed');

  // Legacy absences state
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [completed, setCompleted] = useState<CompletedTask[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);

  // New state
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceHistory[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [translationSettings, setTranslationSettings] = useState<{ enabled: boolean; language: string }>({ enabled: false, language: 'en' });
  const [calendarStatus, setCalendarStatus] = useState<{ connected: boolean; provider?: string; expires_at?: string } | null>(null);

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [feedData, attData, notifData, progData, absData, compData] = await Promise.allSettled([
        apiGet<FeedItem[]>('/api/v1/parent/feed', token),
        apiGet<AttendanceHistory[]>('/api/v1/parent/attendance', token),
        apiGet<Notification[]>('/api/v1/parent/notifications', token),
        apiGet<ProgressItem[]>('/api/v1/parent/progress', token),
        apiGet<Absence[]>('/api/v1/parent/absences', token),
        apiGet<CompletedTask[]>('/api/v1/parent/missed-topics/completed', token),
      ]);
      if (feedData.status === 'fulfilled') setFeed(feedData.value);
      if (attData.status === 'fulfilled') setAttendanceHistory(attData.value);
      if (notifData.status === 'fulfilled') setNotifications(notifData.value);
      if (progData.status === 'fulfilled') setProgress(progData.value);
      if (absData.status === 'fulfilled') setAbsences(absData.value);
      if (compData.status === 'fulfilled') setCompleted(compData.value);
      // load parent settings (translation prefs etc.)
      try {
        const settings = await apiGet<any>('/api/v1/parent/settings', token);
        if (settings && settings.translation_settings) {
          setTranslationSettings({
            enabled: !!settings.translation_settings.enabled,
            language: settings.translation_settings.language || 'en',
          });
        }
      } catch {
        // ignore settings failures
      }
    } finally { setLoading(false); }
  }

  async function loadCalendarStatus() {
    try {
      const status = await apiGet<{ connected: boolean; provider?: string; expires_at?: string }>('/api/v1/parent/calendar/status', token);
      setCalendarStatus(status);
    } catch {
      setCalendarStatus(null);
    }
  }

  async function markNotificationRead(id: string) {
    try {
      await apiPost(`/api/v1/parent/notifications/${id}/read`, {}, token);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch { /* ignore */ }
  }

  async function markDone(taskId: string) {
    try {
      await fetch(`${API_BASE}/api/v1/parent/missed-topics/${taskId}/done`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      await loadAll();
    } catch { /* ignore */ }
  }

  async function connectCalendar() {
    try {
      const resp = await apiGet<{ authUrl?: string }>(`/api/v1/parent/calendar/connect?provider=google`, token);
      if (resp && resp.authUrl) {
        // redirect to provider auth URL
        window.location.href = resp.authUrl;
      } else {
        alert('Calendar provider not configured');
      }
    } catch (err) {
      alert('Failed to start calendar connect');
    }
  }

  async function exportCalendar() {
    try {
      const res = await fetch(`${API_BASE}/api/v1/parent/calendar/export`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'oakit-events.ics';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export calendar');
    }
  }

  async function revokeCalendar() {
    try {
      await fetch(`${API_BASE}/api/v1/parent/calendar/revoke?provider=google`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      alert('Calendar disconnected');
      await loadCalendarStatus();
    } catch {
      alert('Failed to disconnect');
    }
  }

  const unreadCount = notifications.length;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'feed', label: 'Today' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'notifications', label: `Notifications${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
    { id: 'progress', label: 'Progress' },
    { id: 'absences', label: 'Absences' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-bg">
      <header className="bg-primary text-white px-4 py-3 flex items-center justify-between">
        <h1 className="font-semibold">Parent Portal</h1>
        <button onClick={() => { clearToken(); router.push('/login'); }} className="text-sm text-white/60 hover:text-white">Sign out</button>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm whitespace-nowrap transition-colors ${tab === t.id ? 'border-b-2 border-primary text-primary font-medium' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {loading ? (
          <p className="text-center text-gray-400 py-8">Loading...</p>
        ) : (
          <>
            {/* ── Daily Feed ── */}
            {tab === 'feed' && (
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-gray-800">Today&apos;s Update</h2>
                {feed.length === 0 && <p className="text-gray-400">No updates for today</p>}
                {feed.map((item) => (
                  <Card key={item.student_id}>
                    <p className="font-medium text-gray-800 mb-1">{item.student_name}</p>
                    {item.type === 'curriculum' && (
                      <>
                        {item.settling_day_note && <p className="text-sm text-amber-700 mb-1">{item.settling_day_note}</p>}
                        {item.topic_labels && item.topic_labels.length > 0 ? (
                          <ul className="text-sm text-gray-600 list-disc list-inside">
                            {item.topic_labels.map((t, i) => <li key={i}>{t}</li>)}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-400">Settling day — no new topics</p>
                        )}
                      </>
                    )}
                    {item.type === 'special_day' && (
                      <p className="text-sm text-blue-600">{item.label}</p>
                    )}
                    {item.type === 'empty' && (
                      <p className="text-sm text-gray-400">No activity recorded yet</p>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {/* ── Attendance History ── */}
            {tab === 'attendance' && (
              <div className="flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-gray-800">Attendance (Last 30 Days)</h2>
                {attendanceHistory.map((child) => (
                  <Card key={child.student_id}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-medium text-gray-800">{child.student_name}</p>
                      <Badge label={`${child.attendance_pct}%`} variant={child.attendance_pct >= 75 ? 'success' : 'warning'} />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {child.records.map((r, i) => (
                        <span
                          key={i}
                          title={r.attend_date}
                          className={`w-5 h-5 rounded-sm text-xs flex items-center justify-center ${r.status === 'present' ? 'bg-green-200 text-green-700' : 'bg-red-200 text-red-700'}`}
                        >
                          {r.status === 'present' ? '✓' : '✗'}
                        </span>
                      ))}
                    </div>
                  </Card>
                ))}
                {attendanceHistory.length === 0 && <p className="text-gray-400">No attendance data</p>}
              </div>
            )}

            {/* ── Notifications ── */}
            {tab === 'notifications' && (
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-gray-800">Notifications</h2>
                {notifications.length === 0 && <p className="text-gray-400">No unread notifications</p>}
                {notifications.map((n) => (
                  <Card key={n.id}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{n.section_name}</p>
                        <p className="text-xs text-gray-500">{new Date(n.completion_date).toLocaleDateString()} · {n.chunks_covered} topics covered</p>
                      </div>
                      <button
                        onClick={() => markNotificationRead(n.id)}
                        className="text-xs text-primary hover:underline ml-3 shrink-0"
                      >
                        Mark read
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* ── Progress ── */}
            {tab === 'progress' && (
              <div className="flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-gray-800">Curriculum Progress</h2>
                {progress.map((item) => (
                  <Card key={item.student_id}>
                    <p className="font-medium text-gray-800 mb-3">{item.student_name}</p>
                    {item.has_curriculum ? (
                      <ProgressBar percent={item.coverage_pct} />
                    ) : (
                      <p className="text-sm text-gray-400">No curriculum assigned</p>
                    )}
                  </Card>
                ))}
                {progress.length === 0 && <p className="text-gray-400">No progress data</p>}
              </div>
            )}

            {/* ── Absences (legacy) ── */}
            {tab === 'absences' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Absences & Missed Topics</h2>
                {absences.length === 0 ? (
                  <Card className="text-center py-8"><p className="text-gray-400">No absences recorded</p></Card>
                ) : (
                  <div className="flex flex-col gap-3 mb-6">
                    {absences.map((absence, i) => (
                      <Card key={i}>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-medium text-gray-800">{absence.student_name}</p>
                            <p className="text-xs text-gray-400">Absent on {new Date(absence.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          </div>
                        </div>
                        {absence.covered_chunks.length > 0 ? (
                          <div>
                            <p className="text-xs text-gray-500 mb-2">Topics covered that day:</p>
                            <div className="flex flex-col gap-1">
                              {absence.covered_chunks.map(chunk => (
                                <div key={chunk.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                                  <span className="text-sm text-gray-700">{chunk.topic_label}</span>
                                  <Button size="sm" variant="ghost" onClick={() => markDone(chunk.id)}>Mark done</Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">No topics recorded for this day</p>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
                {completed.length > 0 && (
                  <div>
                    <button onClick={() => setShowCompleted(!showCompleted)} className="text-sm text-primary hover:underline mb-3">
                      {showCompleted ? 'Hide' : 'Show'} completed tasks ({completed.length})
                    </button>
                    {showCompleted && (
                      <div className="flex flex-col gap-2">
                        {completed.map(task => (
                          <div key={task.id} className="flex items-center gap-3 bg-green-50 rounded-lg px-3 py-2">
                            <span className="text-green-500">✓</span>
                            <div>
                              <p className="text-sm text-gray-700">{task.topic_label}</p>
                              <p className="text-xs text-gray-400">{task.student_name} · {new Date(task.absence_date).toLocaleDateString('en-IN')}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Settings ── */}
            {tab === 'settings' && (
              <div className="flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-gray-800">Settings</h2>
                <Card>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800">Translation</p>
                        <p className="text-sm text-gray-500">Automatically translate messages for this account.</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-sm text-gray-700">Enable</label>
                        <input
                          type="checkbox"
                          checked={translationSettings.enabled}
                          onChange={(e) => setTranslationSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-700">Language</label>
                      <select
                        value={translationSettings.language}
                        onChange={(e) => setTranslationSettings(prev => ({ ...prev, language: e.target.value }))}
                        className="border rounded px-2 py-1"
                      >
                        <option value="en">English</option>
                        <option value="hi">Hindi</option>
                        <option value="es">Spanish</option>
                        <option value="ar">Arabic</option>
                        <option value="zh">Chinese (Simplified)</option>
                      </select>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={async () => {
                          try {
                            await apiPut('/api/v1/parent/settings', { translation_settings: translationSettings }, token);
                            alert('Translation settings saved');
                          } catch (err) {
                            alert('Failed to save settings');
                          }
                        }}
                        className="px-4 py-2 bg-primary text-white rounded"
                      >
                        Save
                      </button>
                    </div>
                    <hr />
                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <p className="font-medium text-gray-800">Calendar</p>
                        <p className="text-sm text-gray-500">Connect your personal calendar to receive events.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {calendarStatus && calendarStatus.connected ? (
                          <>
                            <span className="text-sm text-green-600">Connected ({calendarStatus.provider})</span>
                            <button onClick={revokeCalendar} className="px-3 py-2 border rounded text-sm">Disconnect</button>
                          </>
                        ) : (
                          <>
                            <button onClick={connectCalendar} className="px-3 py-2 bg-primary text-white rounded text-sm">Connect</button>
                            <button onClick={exportCalendar} className="px-3 py-2 border rounded text-sm">Export .ics</button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
