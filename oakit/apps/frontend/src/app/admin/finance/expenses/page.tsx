'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost, API_BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Card, Button } from '@/components/ui';

interface Expense {
  id: string;
  date: string;
  amount: number;
  category: string;
  notes?: string;
  attachment_url?: string;
  created_by_name?: string;
  deleted_at?: string;
}

const CATEGORIES = [
  'salaries', 'utilities', 'maintenance', 'supplies', 'transport',
  'marketing', 'rent', 'food', 'events', 'other',
];

export default function ExpensesPage() {
  const token = getToken() || '';

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('other');
  const [notes, setNotes] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  // Edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    loadExpenses();
  }, [fromDate, toDate, categoryFilter]);

  async function loadExpenses() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      if (categoryFilter) params.set('category', categoryFilter);
      const data = await apiGet<Expense[]>(`/api/v1/financial/expenses?${params.toString()}`, token);
      setExpenses(Array.isArray(data) ? data : []);
    } catch { setExpenses([]); }
    finally { setLoading(false); }
  }

  async function handleCreate() {
    setCreateError('');
    setCreateSuccess('');
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setCreateError('Enter a valid amount.'); return; }
    if (attachment) {
      const ext = attachment.name.split('.').pop()?.toLowerCase();
      if (!['jpg', 'jpeg', 'png', 'pdf'].includes(ext || '')) {
        setCreateError('Attachment must be JPEG, PNG, or PDF.');
        return;
      }
    }
    setCreateLoading(true);
    try {
      const formData = new FormData();
      formData.append('date', date);
      formData.append('amount', amt.toString());
      formData.append('category', category);
      if (notes) formData.append('notes', notes);
      if (attachment) formData.append('attachment', attachment);

      const res = await fetch(`${API_BASE}/api/v1/financial/expenses`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create expense');

      setCreateSuccess('✓ Expense recorded.');
      setAmount('');
      setNotes('');
      setAttachment(null);
      setShowCreate(false);
      await loadExpenses();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create expense.');
    } finally {
      setCreateLoading(false);
    }
  }

  function startEdit(expense: Expense) {
    setEditId(expense.id);
    setEditAmount(expense.amount.toString());
    setEditCategory(expense.category);
    setEditNotes(expense.notes || '');
  }

  async function handleEdit() {
    if (!editId) return;
    setEditLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/financial/expenses/${editId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(editAmount),
          category: editCategory,
          notes: editNotes,
        }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setEditId(null);
      await loadExpenses();
    } catch { /* ignore */ }
    finally { setEditLoading(false); }
  }

  async function handleDelete(id: string) {
    setDeleteId(id);
    setDeleteLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/financial/expenses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete');
      setDeleteId(null);
      await loadExpenses();
    } catch { /* ignore */ }
    finally { setDeleteLoading(false); }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-primary">Expenses</h1>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : '+ Add Expense'}
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">New Expense</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₹)</label>
              <input type="number" min="1" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
              <select className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Attachment (JPEG/PNG/PDF)</label>
              <input type="file" accept=".jpg,.jpeg,.png,.pdf"
                className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                onChange={e => setAttachment(e.target.files?.[0] || null)} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Description…" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>
          {createError && <p className="text-xs text-red-500 mt-3">{createError}</p>}
          {createSuccess && <p className="text-xs text-green-600 mt-3">{createSuccess}</p>}
          <div className="mt-4">
            <Button onClick={handleCreate} disabled={createLoading}>
              {createLoading ? 'Saving…' : 'Save Expense'}
            </Button>
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex flex-wrap gap-4 items-end">
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
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
            <select className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
              value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="">All categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <Button size="sm" variant="ghost" onClick={() => { setFromDate(''); setToDate(''); setCategoryFilter(''); }}>
            Clear
          </Button>
        </div>
      </Card>

      {/* Expenses list */}
      <Card>
        {loading ? (
          <p className="text-sm text-gray-400 py-6 text-center">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Date</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Amount</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Category</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Notes</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">Attachment</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(exp => (
                  <tr key={exp.id} className="border-b border-gray-50 hover:bg-gray-50">
                    {editId === exp.id ? (
                      <>
                        <td className="py-2 px-3 text-gray-600 text-xs">
                          {new Date(exp.date).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-2 px-3">
                          <input type="number" className="w-24 px-2 py-1 rounded border border-gray-200 text-sm text-right"
                            value={editAmount} onChange={e => setEditAmount(e.target.value)} />
                        </td>
                        <td className="py-2 px-3">
                          <select className="px-2 py-1 rounded border border-gray-200 text-sm"
                            value={editCategory} onChange={e => setEditCategory(e.target.value)}>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td className="py-2 px-3">
                          <input type="text" className="w-full px-2 py-1 rounded border border-gray-200 text-sm"
                            value={editNotes} onChange={e => setEditNotes(e.target.value)} />
                        </td>
                        <td className="py-2 px-3 text-center">—</td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex gap-1 justify-center">
                            <button onClick={handleEdit} disabled={editLoading}
                              className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200">
                              {editLoading ? '…' : 'Save'}
                            </button>
                            <button onClick={() => setEditId(null)}
                              className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200">
                              Cancel
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 px-3 text-gray-600 text-xs">
                          {new Date(exp.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-gray-800">
                          ₹{exp.amount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 px-3">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {exp.category}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-600 text-xs max-w-xs truncate">{exp.notes || '—'}</td>
                        <td className="py-2 px-3 text-center">
                          {exp.attachment_url ? (
                            <a href={exp.attachment_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-600 underline">View</a>
                          ) : '—'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => startEdit(exp)}
                              className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200">
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Delete this expense? This action cannot be undone.')) handleDelete(exp.id);
                              }}
                              disabled={deleteLoading && deleteId === exp.id}
                              className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
                            >
                              {deleteLoading && deleteId === exp.id ? '…' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400 text-sm">No expenses found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
