'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/auth';
import { apiGet } from '@/lib/api';
import Badge from '@/components/ui/Badge';

interface School {
  id: string;
  name: string;
  subdomain: string;
  status: 'active' | 'inactive';
  plan_type: string;
  created_at: string;
}

export default function SchoolListPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    setLoading(true);
    apiGet<School[]>(`/api/v1/super-admin/schools?${params}`, token)
      .then(setSchools)
      .finally(() => setLoading(false));
  }, [status, search]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Schools</h1>
      </div>

      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Plan</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((school) => (
                <tr key={school.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/super-admin/schools/${school.id}`} className="text-primary font-medium hover:underline">
                      {school.name}
                    </Link>
                    <p className="text-xs text-gray-400">{school.subdomain}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={school.status} variant={school.status === 'active' ? 'success' : 'danger'} />
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-700">{school.plan_type}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(school.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {schools.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No schools found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
