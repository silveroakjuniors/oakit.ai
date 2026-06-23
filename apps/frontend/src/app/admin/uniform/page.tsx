'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';

interface UniformRequest {
  id: string;
  child_name: string;
  class_name: string;
  parent_name: string;
  contact_number: string;
  height_cm: number | null;
  weight_kg: number | null;
  chest_cm: number | null;
  shirt_length_cm: number | null;
  pant_length_cm: number | null;
  status: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-amber-50 text-amber-700 border-amber-200',
  confirmed:  'bg-blue-50 text-blue-700 border-blue-200',
  dispatched: 'bg-purple-50 text-purple-700 border-purple-200',
  delivered:  'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function cmToIn(cm: number | null) {
  if (!cm) return '—';
  return `${(cm / 2.54).toFixed(1)}"`;
}

export default function AdminUniformPage() {
  const [requests, setRequests] = useState<UniformRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const token = getToken();

  useEffect(() => {
    if (!token) return;
    const params = filter !== 'all' ? `?status=${filter}` : '';
    apiGet<UniformRequest[]>(`/api/v1/admin/uniform${params}`, token)
      .then(setRequests).catch(console.error).finally(() => setLoading(false));
  }, [token, filter]);

  const counts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    confirmed: requests.filter(r => r.status === 'confirmed').length,
    dispatched: requests.filter(r => r.status === 'dispatched').length,
    delivered: requests.filter(r => r.status === 'delivered').length,
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Uniform Sizing Requests</h1>
        <p className="text-sm text-gray-500 mt-1">View and manage uniform sizing submissions from parents</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 border-b border-gray-100 pb-2 flex-wrap">
        {(['all', 'pending', 'confirmed', 'dispatched', 'delivered'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              filter === f ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'text-gray-500 hover:bg-gray-50'
            }`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'all' ? ` (${requests.length})` : ` (${counts[f]})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm">Loading...</div>
      ) : !requests.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
          No uniform requests found
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="text-left py-2 font-semibold">Child</th>
                <th className="text-left py-2 font-semibold">Class</th>
                <th className="text-left py-2 font-semibold">Parent</th>
                <th className="text-left py-2 font-semibold">Contact</th>
                <th className="text-right py-2 font-semibold">Height</th>
                <th className="text-right py-2 font-semibold">Chest</th>
                <th className="text-right py-2 font-semibold">Shirt L</th>
                <th className="text-right py-2 font-semibold">Pant L</th>
                <th className="text-right py-2 font-semibold">Weight</th>
                <th className="text-left py-2 font-semibold">Status</th>
                <th className="text-left py-2 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2.5 font-medium text-gray-900">{r.child_name}</td>
                  <td className="py-2.5 text-gray-600">{r.class_name}</td>
                  <td className="py-2.5 text-gray-600">{r.parent_name}</td>
                  <td className="py-2.5 text-gray-600">{r.contact_number}</td>
                  <td className="py-2.5 text-right text-gray-700">{cmToIn(r.height_cm)}</td>
                  <td className="py-2.5 text-right text-gray-700">{cmToIn(r.chest_cm)}</td>
                  <td className="py-2.5 text-right text-gray-700">{cmToIn(r.shirt_length_cm)}</td>
                  <td className="py-2.5 text-right text-gray-700">{cmToIn(r.pant_length_cm)}</td>
                  <td className="py-2.5 text-right text-gray-700">{r.weight_kg ? `${r.weight_kg} kg` : '—'}</td>
                  <td className="py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[r.status] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2.5 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
