'use client';

import { useState, useEffect } from 'react';
import { Card, Button } from '@/components/ui';
import { apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';

interface Enquiry {
  id: string;
  student_name: string;
  parent_name: string;
  contact_number: string;
  class_of_interest: string;
  child_age?: string;
  enquiry_date?: string;
  status: 'open' | 'converted' | 'closed';
  notes?: string;
  created_at: string;
}

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'converted' | 'closed'>('all');
  const token = getToken();

  useEffect(() => {
    loadEnquiries();
  }, [filter]);

  async function loadEnquiries() {
    if (!token) return;
    setLoading(true);
    try {
      const url = filter === 'all' 
        ? '/api/v1/admin/enquiries'
        : `/api/v1/admin/enquiries?status=${filter}`;
      const data = await apiGet<Enquiry[]>(url, token);
      setEnquiries(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load enquiries:', err);
      setEnquiries([]);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: 'open' | 'converted' | 'closed') {
    if (!token) return;
    try {
      await apiPost(`/api/v1/admin/enquiries/${id}`, { status }, token);
      await loadEnquiries();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    }
  }

  const statusColors = {
    open: 'bg-blue-50 text-blue-700 border-blue-200',
    converted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    closed: 'bg-gray-50 text-gray-500 border-gray-200',
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Enquiries</h1>
          <p className="text-sm text-gray-500 mt-1">Manage admissions enquiries from parents</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 border-b border-gray-100 pb-2">
        {(['all', 'open', 'converted', 'closed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filter === f
                ? 'bg-primary-50 text-primary-700 border border-primary-200'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="p-8 text-center text-gray-400">Loading...</Card>
      ) : enquiries.length === 0 ? (
        <Card className="p-8 text-center text-gray-400">
          No enquiries found
        </Card>
      ) : (
        <div className="space-y-3">
          {enquiries.map(enq => (
            <Card key={enq.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-base font-semibold text-gray-900">{enq.student_name}</h3>
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${statusColors[enq.status]}`}>
                      {enq.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
                    <p><span className="font-medium">Parent:</span> {enq.parent_name}</p>
                    <p><span className="font-medium">Contact:</span> {enq.contact_number}</p>
                    {enq.class_of_interest && <p><span className="font-medium">Class:</span> {enq.class_of_interest}</p>}
                    {enq.child_age && <p><span className="font-medium">Age:</span> {enq.child_age}</p>}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Submitted {new Date(enq.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 shrink-0">
                  {enq.status === 'open' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => updateStatus(enq.id, 'converted')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        ✓ Convert
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => updateStatus(enq.id, 'closed')}
                      >
                        Close
                      </Button>
                    </>
                  )}
                  {enq.status === 'closed' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => updateStatus(enq.id, 'open')}
                    >
                      Reopen
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
