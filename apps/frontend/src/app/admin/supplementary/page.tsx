'use client';

import { useState, useEffect } from 'react';
import { getToken } from '@/lib/auth';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { Button, Card, Badge } from '@/components/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Pool { id: string; name: string; description: string; language: string; activity_count: number; }
interface Activity { id: string; title: string; description: string; position: number; }
interface Assignment { id: string; pool_name: string; class_name: string; frequency_mode: string; interval_days: number; start_date: string; end_date: string; }
interface Class { id: string; name: string; }

export default function SupplementaryPage() {
  const token = getToken() || '';
  const [pools, setPools] = useState<Pool[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tab, setTab] = useState<'pools' | 'assignments'>('pools');

  // Pool form
  const [newPoolName, setNewPoolName] = useState('');
  const [newPoolDesc, setNewPoolDesc] = useState('');
  const [newPoolLang, setNewPoolLang] = useState('English');
  const [poolLoading, setPoolLoading] = useState(false);

  // Activity form
  const [newActivityTitle, setNewActivityTitle] = useState('');
  const [newActivityDesc, setNewActivityDesc] = useState('');
  const [actLoading, setActLoading] = useState(false);

  // Assignment form
  const [assignPoolId, setAssignPoolId] = useState('');
  const [assignClassId, setAssignClassId] = useState('');
  const [assignFreq, setAssignFreq] = useState<'weekly' | 'interval'>('weekly');
  const [assignInterval, setAssignInterval] = useState(7);
  const [assignStart, setAssignStart] = useState('');
  const [assignEnd, setAssignEnd] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  const [error, setError] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const [poolsData, assignData, classData] = await Promise.all([
        apiGet<Pool[]>('/api/v1/admin/supplementary/pools', token),
        apiGet<Assignment[]>('/api/v1/admin/supplementary/assignments', token),
        apiGet<Class[]>('/api/v1/admin/classes', token),
      ]);
      setPools(poolsData);
      setAssignments(assignData);
      setClasses(classData);
    } catch (e: any) { setError(e.message); }
  }

  async function loadActivities(poolId: string) {
    try {
      const data = await apiGet<Activity[]>(`/api/v1/admin/supplementary/pools/${poolId}/activities`, token);
      setActivities(data);
    } catch { /* ignore */ }
  }

  async function createPool() {
    if (!newPoolName.trim()) return;
    setPoolLoading(true);
    setError('');
    try {
      await apiPost('/api/v1/admin/supplementary/pools', { name: newPoolName.trim(), description: newPoolDesc, language: newPoolLang }, token);
      setNewPoolName(''); setNewPoolDesc(''); setNewPoolLang('English');
      await loadAll();
    } catch (e: any) { setError(e.message); }
    finally { setPoolLoading(false); }
  }

  async function deletePool(id: string) {
    if (!confirm('Delete this pool and all its activities?')) return;
    try {
      await apiDelete(`/api/v1/admin/supplementary/pools/${id}`, token);
      if (selectedPool?.id === id) { setSelectedPool(null); setActivities([]); }
      await loadAll();
    } catch (e: any) { setError(e.message); }
  }

  async function selectPool(p: Pool) {
    setSelectedPool(p);
    await loadActivities(p.id);
  }

  async function addActivity() {
    if (!selectedPool || !newActivityTitle.trim()) return;
    setActLoading(true);
    setError('');
    try {
      await apiPost(`/api/v1/admin/supplementary/pools/${selectedPool.id}/activities`, { title: newActivityTitle.trim(), description: newActivityDesc }, token);
      setNewActivityTitle(''); setNewActivityDesc('');
      await loadActivities(selectedPool.id);
      await loadAll();
    } catch (e: any) { setError(e.message); }
    finally { setActLoading(false); }
  }

  async function deleteActivity(id: string) {
    if (!selectedPool) return;
    try {
      await apiDelete(`/api/v1/admin/supplementary/pools/${selectedPool.id}/activities/${id}`, token);
      await loadActivities(selectedPool.id);
      await loadAll();
    } catch (e: any) { setError(e.message); }
  }

  async function createAssignment() {
    if (!assignPoolId || !assignClassId || !assignStart || !assignEnd) return;
    setAssignLoading(true);
    setError('');
    try {
      await apiPost('/api/v1/admin/supplementary/assignments', {
        activity_pool_id: assignPoolId,
        class_id: assignClassId,
        frequency_mode: assignFreq,
        interval_days: assignFreq === 'interval' ? assignInterval : undefined,
        start_date: assignStart,
        end_date: assignEnd,
      }, token);
      setAssignPoolId(''); setAssignClassId(''); setAssignStart(''); setAssignEnd('');
      await loadAll();
    } catch (e: any) { setError(e.message); }
    finally { setAssignLoading(false); }
  }

  async function deleteAssignment(id: string) {
    try {
      await apiDelete(`/api/v1/admin/supplementary/assignments/${id}`, token);
      await loadAll();
    } catch (e: any) { setError(e.message); }
  }

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-semibold text-primary mb-1">Supplementary Activities</h1>
      <p className="text-sm text-gray-500 mb-6">Manage rhymes, stories, public speaking, and other supplementary programs. Assign them to classes and the system will schedule them across the year.</p>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {(['pools', 'assignments'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm capitalize transition-colors ${tab === t ? 'border-b-2 border-primary text-primary font-medium' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'pools' ? 'Activity Pools' : 'Class Assignments'}
          </button>
        ))}
      </div>

      {/* ── Pools Tab ── */}
      {tab === 'pools' && (
        <div className="flex gap-6">
          {/* Left: pool list */}
          <div className="w-72 shrink-0">
            <Card className="mb-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Create New Pool</h2>
              <div className="flex flex-col gap-2">
                <input value={newPoolName} onChange={e => setNewPoolName(e.target.value)}
                  placeholder="Pool name (e.g. English Rhymes)"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                <input value={newPoolDesc} onChange={e => setNewPoolDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                <select value={newPoolLang} onChange={e => setNewPoolLang(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {['English', 'Hindi', 'Kannada', 'None'].map(l => <option key={l}>{l}</option>)}
                </select>
                <Button size="sm" onClick={createPool} loading={poolLoading} disabled={!newPoolName.trim()}>
                  Create Pool
                </Button>
              </div>
            </Card>

            <div className="flex flex-col gap-2">
              {pools.map(p => (
                <div key={p.id}
                  onClick={() => selectPool(p)}
                  className={`cursor-pointer rounded-xl border p-3 transition-colors ${selectedPool?.id === p.id ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.language} · {p.activity_count} activities</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deletePool(p.id); }}
                      className="text-xs text-red-400 hover:text-red-600 ml-2">✕</button>
                  </div>
                </div>
              ))}
              {pools.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No pools yet</p>}
            </div>
          </div>

          {/* Right: activities */}
          <div className="flex-1">
            {selectedPool ? (
              <Card>
                <h2 className="text-sm font-semibold text-gray-700 mb-1">{selectedPool.name}</h2>
                <p className="text-xs text-gray-400 mb-4">{selectedPool.description || 'No description'} · {selectedPool.language}</p>

                {/* Add activity */}
                <div className="flex gap-2 mb-4">
                  <input value={newActivityTitle} onChange={e => setNewActivityTitle(e.target.value)}
                    placeholder="Activity title (e.g. Twinkle Twinkle)"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    onKeyDown={e => e.key === 'Enter' && addActivity()} />
                  <input value={newActivityDesc} onChange={e => setNewActivityDesc(e.target.value)}
                    placeholder="Description (optional)"
                    className="w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  <Button size="sm" onClick={addActivity} loading={actLoading} disabled={!newActivityTitle.trim()}>
                    Add
                  </Button>
                </div>

                {/* Activity list */}
                <div className="flex flex-col gap-1">
                  {activities.map((a, i) => (
                    <div key={a.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 group">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-300 w-5 text-right">{i + 1}.</span>
                        <div>
                          <p className="text-sm text-gray-800">{a.title}</p>
                          {a.description && <p className="text-xs text-gray-400">{a.description}</p>}
                        </div>
                      </div>
                      <button onClick={() => deleteActivity(a.id)}
                        className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        Remove
                      </button>
                    </div>
                  ))}
                  {activities.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No activities yet — add some above</p>}
                </div>
              </Card>
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                Select a pool to manage its activities
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Assignments Tab ── */}
      {tab === 'assignments' && (
        <div className="flex gap-6">
          {/* Create assignment */}
          <div className="w-80 shrink-0">
            <Card>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Assign Pool to Class</h2>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Activity Pool</label>
                  <select value={assignPoolId} onChange={e => setAssignPoolId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">Select pool...</option>
                    {pools.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Class</label>
                  <select value={assignClassId} onChange={e => setAssignClassId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">Select class...</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Frequency</label>
                  <select value={assignFreq} onChange={e => setAssignFreq(e.target.value as any)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="weekly">Once per week</option>
                    <option value="interval">Every N working days</option>
                  </select>
                </div>
                {assignFreq === 'interval' && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Every how many working days?</label>
                    <input type="number" min={1} max={30} value={assignInterval}
                      onChange={e => setAssignInterval(parseInt(e.target.value) || 7)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Start Date</label>
                  <input type="date" value={assignStart} onChange={e => setAssignStart(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">End Date</label>
                  <input type="date" value={assignEnd} onChange={e => setAssignEnd(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <Button onClick={createAssignment} loading={assignLoading}
                  disabled={!assignPoolId || !assignClassId || !assignStart || !assignEnd}>
                  Assign & Schedule
                </Button>
                <p className="text-xs text-gray-400">The system will automatically distribute activities across working days for the full date range.</p>
              </div>
            </Card>
          </div>

          {/* Assignment list */}
          <div className="flex-1">
            <div className="flex flex-col gap-3">
              {assignments.map(a => (
                <Card key={a.id}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-800">{a.pool_name}</p>
                      <p className="text-sm text-gray-500">{a.class_name}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge label={a.frequency_mode === 'weekly' ? 'Weekly' : `Every ${a.interval_days} days`} variant="info" />
                        <span className="text-xs text-gray-400">
                          {new Date(a.start_date).toLocaleDateString()} → {new Date(a.end_date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => deleteAssignment(a.id)}
                      className="text-xs text-red-400 hover:text-red-600">Remove</button>
                  </div>
                </Card>
              ))}
              {assignments.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No assignments yet. Create a pool first, add activities, then assign it to a class.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
