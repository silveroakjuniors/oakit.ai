'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { getToken, clearToken } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface CoveredChunk { id: string; topic_label: string; }
interface Absence {
  student_id: string;
  student_name: string;
  date: string;
  covered_chunks: CoveredChunk[];
}
interface CompletedTask { id: string; student_name: string; topic_label: string; absence_date: string; done_at: string; }

export default function ParentPage() {
  const router = useRouter();
  const token = getToken() || '';
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [completed, setCompleted] = useState<CompletedTask[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [abs, comp] = await Promise.all([
        apiGet<Absence[]>('/api/v1/parent/absences', token),
        apiGet<CompletedTask[]>('/api/v1/parent/missed-topics/completed', token),
      ]);
      setAbsences(abs);
      setCompleted(comp);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function markDone(taskId: string) {
    try {
      await fetch(`${API_BASE}/api/v1/parent/missed-topics/${taskId}/done`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadData();
    } catch { /* ignore */ }
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="bg-primary text-white px-4 py-3 flex items-center justify-between">
        <h1 className="font-semibold">Parent Portal</h1>
        <button onClick={() => { clearToken(); router.push('/login'); }} className="text-sm text-white/60 hover:text-white">Sign out</button>
      </header>

      <div className="p-4 max-w-lg mx-auto">
        {loading ? (
          <p className="text-center text-gray-400 py-8">Loading...</p>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Absences & Missed Topics</h2>

            {absences.length === 0 ? (
              <Card className="text-center py-8">
                <p className="text-gray-400">No absences recorded</p>
              </Card>
            ) : (
              <div className="flex flex-col gap-3 mb-6">
                {absences.map((absence, i) => (
                  <Card key={i}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-800">{absence.student_name}</p>
                        <p className="text-xs text-gray-400">
                          Absent on {new Date(absence.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    {absence.covered_chunks.length > 0 ? (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Topics covered that day:</p>
                        <div className="flex flex-col gap-1">
                          {absence.covered_chunks.map(chunk => (
                            <div key={chunk.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                              <span className="text-sm text-gray-700">{chunk.topic_label}</span>
                              <Button size="sm" variant="ghost" onClick={() => markDone(chunk.id)}>
                                Mark done
                              </Button>
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

            {/* Completed tasks */}
            {completed.length > 0 && (
              <div>
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="text-sm text-primary hover:underline mb-3"
                >
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
          </>
        )}
      </div>
    </div>
  );
}
