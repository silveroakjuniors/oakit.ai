'use client';

import { useState, useEffect } from 'react';
import { apiGet, API_BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Card, Button } from '@/components/ui';

type ReportType =
  | 'revenue'
  | 'expenses'
  | 'profit-loss'
  | 'daily-collection'
  | 'monthly-collection'
  | 'annual-collection'
  | 'student-pending'
  | 'class-collection'
  | 'activity-revenue'
  | 'daycare-usage'
  | 'reconciliation-summary';

interface ReportOption {
  id: ReportType;
  label: string;
  principalOnly?: boolean;
}

const REPORT_OPTIONS: ReportOption[] = [
  { id: 'revenue',                label: 'Revenue' },
  { id: 'expenses',               label: 'Expenses' },
  { id: 'profit-loss',            label: 'Profit & Loss',          principalOnly: true },
  { id: 'daily-collection',       label: 'Daily Collection' },
  { id: 'monthly-collection',     label: 'Monthly Collection' },
  { id: 'annual-collection',      label: 'Annual Collection' },
  { id: 'student-pending',        label: 'Student Pending' },
  { id: 'class-collection',       label: 'Class Collection' },
  { id: 'activity-revenue',       label: 'Activity Revenue' },
  { id: 'daycare-usage',          label: 'Daycare Usage' },
  { id: 'reconciliation-summary', label: 'Reconciliation Summary' },
];

function getUserRole(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role || '';
  } catch { return ''; }
}

export default function ReportsPage() {
  const token = getToken() || '';
  const userRole = getUserRole(token);
  const isPrincipal = userRole === 'principal' || userRole === 'super_admin';

  const [reportType, setReportType] = useState<ReportType>('revenue');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reportData, setReportData] = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const visibleReports = REPORT_OPTIONS.filter(r => !r.principalOnly || isPrincipal);

  async function fetchReport() {
    setError('');
    setReportData(null);
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      const data = await apiGet<Record<string, unknown>[] | Record<string, unknown>>(
        `/api/v1/financial/reports/${reportType}?${params.toString()}`,
        token
      );
      // Normalise to array
      if (Array.isArray(data)) {
        setReportData(data);
      } else if (data && typeof data === 'object') {
        // daily-collection returns { date, payments: [...], total }
        const obj = data as Record<string, unknown>;
        if (Array.isArray(obj.payments)) {
          setReportData(obj.payments as Record<string, unknown>[]);
        } else {
          // Wrap single summary object in array for table rendering
          setReportData([obj]);
        }
      } else {
        setReportData([]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch report.');
    } finally {
      setLoading(false);
    }
  }

  function downloadPdf() {
    const params = new URLSearchParams();
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    window.open(`${API_BASE}/api/v1/financial/reports/${reportType}/pdf?${params.toString()}&token=${token}`, '_blank');
  }

  // Derive table columns from first row
  const columns = reportData && reportData.length > 0 ? Object.keys(reportData[0]) : [];

  function formatCell(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number') return value.toLocaleString('en-IN');
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'string') {
      // Try to format as date
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        try { return new Date(value).toLocaleDateString('en-IN'); } catch { /* ignore */ }
      }
      return value;
    }
    return JSON.stringify(value);
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-primary">Financial Reports</h1>
      </div>

      {/* Controls */}
      <Card className="mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Report Type</label>
            <select
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={reportType}
              onChange={e => setReportType(e.target.value as ReportType)}
            >
              {visibleReports.map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
            <input type="date" className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
              value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
            <input type="date" className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
              value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <Button onClick={fetchReport} disabled={loading}>
            {loading ? 'Fetching…' : 'Fetch Report'}
          </Button>
          {reportData && (
            <Button variant="ghost" size="sm" onClick={downloadPdf}>
              📄 Download PDF
            </Button>
          )}
        </div>
      </Card>

      {/* Results */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 mb-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {reportData && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">
              {REPORT_OPTIONS.find(r => r.id === reportType)?.label} Report
            </h2>
            <span className="text-xs text-gray-500">{reportData.length} row{reportData.length !== 1 ? 's' : ''}</span>
          </div>
          {reportData.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No data for the selected period</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {columns.map(col => (
                      <th key={col} className="text-left py-2 px-3 text-xs font-medium text-gray-500 capitalize">
                        {col.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((row, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      {columns.map(col => (
                        <td key={col} className="py-2 px-3 text-gray-700">
                          {formatCell(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
