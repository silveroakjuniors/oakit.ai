'use client';

import { useState, useEffect } from 'react';
import { Modal, Button, Input, Alert, Badge } from '@/UIComponents';
import { apiPost, apiPatch } from '@/lib/api';
import { getToken } from '@/lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExistingConcession {
  id: string;
  fee_head_id: string;
  fee_head_name: string;
  type: 'fixed' | 'percentage';
  value: number;
  reason: string;
  status: 'pending_approval' | 'approved' | 'rejected';
  assigned_amount: number;
}

interface FeeHeadOption {
  id: string;
  name: string;
  assigned_amount: number;
}

interface ConcessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** When provided, editing/approving an existing pending concession (principal) */
  concession?: ExistingConcession;
  /** When creating new (admin) */
  studentId?: string;
  feeHeads?: FeeHeadOption[];
  mode: 'create' | 'edit' | 'approve';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeEffectiveAmount(
  type: 'fixed' | 'percentage',
  value: number,
  assignedAmount: number
): number {
  if (type === 'fixed') return value;
  return (value / 100) * assignedAmount;
}

function Select({
  label,
  value,
  onChange,
  options,
  error,
  disabled,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div className="w-full">
      {label && <label className="block text-xs font-medium text-neutral-600 mb-1.5">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full px-3 py-2.5 text-sm bg-white border rounded-xl text-neutral-800 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 disabled:bg-neutral-50 disabled:text-neutral-400 disabled:cursor-not-allowed ${
          error ? 'border-red-300' : 'border-neutral-200 hover:border-neutral-300'
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ConcessionModal({
  isOpen,
  onClose,
  onSuccess,
  concession,
  studentId,
  feeHeads = [],
  mode,
}: ConcessionModalProps) {
  const token = getToken() || '';

  // Form state
  const [feeHeadId, setFeeHeadId] = useState('');
  const [type, setType] = useState<'fixed' | 'percentage'>('fixed');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');

  // Pre-fill when editing or approving
  useEffect(() => {
    if (!isOpen) return;
    if (concession && (mode === 'edit' || mode === 'approve')) {
      setFeeHeadId(concession.fee_head_id);
      setType(concession.type);
      setValue(String(concession.value));
      setReason(concession.reason);
    } else {
      // Reset for create mode
      setFeeHeadId(feeHeads.length > 0 ? feeHeads[0].id : '');
      setType('fixed');
      setValue('');
      setReason('');
    }
    setError('');
    setValidationError('');
    setRejectionReason('');
  }, [isOpen, concession, mode, feeHeads]);

  // ── Derived values ───────────────────────────────────────────────────────────

  const selectedFeeHead =
    mode === 'create'
      ? feeHeads.find((h) => h.id === feeHeadId)
      : concession
      ? { id: concession.fee_head_id, name: concession.fee_head_name, assigned_amount: concession.assigned_amount }
      : undefined;

  const assignedAmount = selectedFeeHead?.assigned_amount ?? 0;
  const numericValue = parseFloat(value) || 0;

  function getClientValidationError(): string {
    if (!value || numericValue <= 0) return 'Value must be greater than 0';
    if (type === 'percentage') {
      if (numericValue < 0 || numericValue > 100) return 'Percentage must be between 0 and 100';
    }
    if (type === 'fixed') {
      if (numericValue > assignedAmount) {
        return `Value (₹${numericValue}) exceeds the assigned amount (₹${assignedAmount})`;
      }
    }
    if (type === 'percentage') {
      const effective = computeEffectiveAmount('percentage', numericValue, assignedAmount);
      if (effective > assignedAmount) {
        return `Effective amount (₹${effective.toFixed(2)}) exceeds the assigned amount (₹${assignedAmount})`;
      }
    }
    return '';
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setError('');
    const clientErr = getClientValidationError();
    if (clientErr) {
      setValidationError(clientErr);
      return;
    }
    setValidationError('');
    setLoading(true);

    try {
      if (mode === 'create') {
        await apiPost(
          '/api/v1/financial/concessions',
          {
            student_id: studentId,
            fee_head_id: feeHeadId,
            type,
            value: numericValue,
            reason,
          },
          token
        );
      } else if (mode === 'edit' && concession) {
        await apiPatch(
          `/api/v1/financial/concessions/${concession.id}`,
          { value: numericValue, reason },
          token
        );
      }
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    if (!concession) return;
    setError('');
    setLoading(true);
    try {
      await apiPost(`/api/v1/financial/concessions/${concession.id}/approve`, {}, token);
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to approve concession');
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!concession) return;
    if (!rejectionReason.trim()) {
      setValidationError('Rejection reason is required');
      return;
    }
    setError('');
    setValidationError('');
    setLoading(true);
    try {
      await apiPost(
        `/api/v1/financial/concessions/${concession.id}/reject`,
        { rejection_reason: rejectionReason },
        token
      );
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reject concession');
    } finally {
      setLoading(false);
    }
  }

  // ── Title ────────────────────────────────────────────────────────────────────

  const title =
    mode === 'create'
      ? 'New Concession'
      : mode === 'edit'
      ? 'Edit Concession'
      : 'Review Concession';

  const subtitle =
    mode === 'create'
      ? 'Apply a fee concession for this student'
      : mode === 'edit'
      ? 'Update the pending concession details'
      : 'Approve or reject this concession request';

  // ── Approve mode body ────────────────────────────────────────────────────────

  function renderApproveBody() {
    if (!concession) return null;
    const effective = computeEffectiveAmount(concession.type, concession.value, concession.assigned_amount);
    return (
      <div className="space-y-4">
        <div className="bg-neutral-50 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500">Fee Head</span>
            <span className="text-sm font-medium text-neutral-800">{concession.fee_head_name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500">Type</span>
            <Badge label={concession.type} variant={concession.type === 'fixed' ? 'info' : 'amber'} size="sm" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500">Value</span>
            <span className="text-sm font-semibold text-neutral-800">
              {concession.type === 'fixed' ? `₹${concession.value}` : `${concession.value}%`}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500">Effective Amount</span>
            <span className="text-sm font-semibold text-[#1B4332]">₹{effective.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500">Assigned Amount</span>
            <span className="text-sm text-neutral-600">₹{concession.assigned_amount}</span>
          </div>
          <div className="pt-2 border-t border-neutral-200">
            <span className="text-xs text-neutral-500">Reason</span>
            <p className="text-sm text-neutral-700 mt-1">{concession.reason}</p>
          </div>
        </div>

        <div className="w-full">
          <label className="block text-xs font-medium text-neutral-600 mb-1.5">
            Rejection Reason <span className="text-neutral-400">(required to reject)</span>
          </label>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Explain why this concession is being rejected…"
            rows={3}
            className="w-full px-3 py-2.5 text-sm bg-white border border-neutral-200 rounded-xl text-neutral-800 placeholder:text-neutral-400 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 resize-none"
          />
        </div>

        {validationError && <Alert variant="danger" message={validationError} />}
        {error && <Alert variant="danger" message={error} />}
      </div>
    );
  }

  // ── Create / Edit body ───────────────────────────────────────────────────────

  function renderFormBody() {
    const isEdit = mode === 'edit';
    return (
      <div className="space-y-4">
        {mode === 'create' && (
          <Select
            label="Fee Head"
            value={feeHeadId}
            onChange={setFeeHeadId}
            options={feeHeads.map((h) => ({ value: h.id, label: `${h.name} (₹${h.assigned_amount})` }))}
          />
        )}

        {isEdit && concession && (
          <div className="bg-neutral-50 rounded-xl px-3 py-2.5">
            <p className="text-xs text-neutral-500">Fee Head</p>
            <p className="text-sm font-medium text-neutral-800 mt-0.5">{concession.fee_head_name}</p>
          </div>
        )}

        <Select
          label="Concession Type"
          value={type}
          onChange={(v) => {
            setType(v as 'fixed' | 'percentage');
            setValidationError('');
          }}
          options={[
            { value: 'fixed', label: 'Fixed Amount (₹)' },
            { value: 'percentage', label: 'Percentage (%)' },
          ]}
        />

        <Input
          label={type === 'fixed' ? 'Amount (₹)' : 'Percentage (%)'}
          type="number"
          min="0"
          max={type === 'percentage' ? '100' : undefined}
          step="0.01"
          placeholder={type === 'fixed' ? '0.00' : '0–100'}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setValidationError('');
          }}
          hint={
            selectedFeeHead && numericValue > 0
              ? `Effective: ₹${computeEffectiveAmount(type, numericValue, assignedAmount).toFixed(2)} of ₹${assignedAmount} assigned`
              : undefined
          }
        />

        <div className="w-full">
          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for this concession…"
            rows={3}
            className="w-full px-3 py-2.5 text-sm bg-white border border-neutral-200 rounded-xl text-neutral-800 placeholder:text-neutral-400 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 resize-none"
          />
        </div>

        {validationError && <Alert variant="danger" message={validationError} />}
        {error && <Alert variant="danger" message={error} />}
      </div>
    );
  }

  // ── Footer ───────────────────────────────────────────────────────────────────

  function renderFooter() {
    if (mode === 'approve') {
      return (
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading} type="button">
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={loading}
            onClick={handleReject}
            type="button"
          >
            Reject
          </Button>
          <Button
            variant="success"
            size="sm"
            loading={loading}
            onClick={handleApprove}
            type="button"
          >
            Approve
          </Button>
        </>
      );
    }

    return (
      <>
        <Button variant="secondary" size="sm" onClick={onClose} disabled={loading} type="button">
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          loading={loading}
          onClick={handleSubmit}
          type="button"
        >
          {mode === 'create' ? 'Submit Concession' : 'Save Changes'}
        </Button>
      </>
    );
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size="md"
      footer={renderFooter()}
    >
      {mode === 'approve' ? renderApproveBody() : renderFormBody()}
    </Modal>
  );
}

export default ConcessionModal;
