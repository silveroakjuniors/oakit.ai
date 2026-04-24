'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { apiPost, apiPut, API_BASE } from '@/lib/api';

interface HomeworkRecord {
  id: string;
  chunk_id: string;
  topic_label: string;
  raw_text: string;
  formatted_text: string;
  teacher_comments?: string;
}

interface Props {
  chunkId: string;
  topicLabel: string;
  chunkContent?: string;
  sectionId?: string;
  token: string;
  existingRecord?: HomeworkRecord | null;
  onClose: () => void;
  onSaved: (record: HomeworkRecord) => void;
}

type Step = 'draft' | 'preview' | 'done';

export default function HomeworkModal({
  chunkId, topicLabel, chunkContent, sectionId, token,
  existingRecord, onClose, onSaved,
}: Props) {
  const isEdit = !!existingRecord;

  const [step, setStep] = useState<Step>('draft');
  const [draftText, setDraftText] = useState(existingRecord?.raw_text ?? '');
  const [teacherComments, setTeacherComments] = useState(existingRecord?.teacher_comments ?? '');
  const [formattedText, setFormattedText] = useState('');
  const [savedRecord, setSavedRecord] = useState<HomeworkRecord | null>(null);
  const [parentsNotified, setParentsNotified] = useState(0);
  const [failedParents, setFailedParents] = useState<string[]>([]);
  const [formattingSkipped, setFormattingSkipped] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [genError, setGenError] = useState('');
  const [submitError, setSubmitError] = useState('');

  // Auto-generate draft if new (not edit)
  useEffect(() => {
    if (!isEdit && !draftText) {
      generateDraft();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  async function generateDraft() {
    setGenerating(true); setGenError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/teacher/homework/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ chunk_id: chunkId, topic_label: topicLabel, content: chunkContent || '', section_id: sectionId }),
      });
      const data = await res.json();
      if (res.status === 504) { setGenError('AI timed out. You can write homework manually below.'); return; }
      if (data.draft_text) setDraftText(data.draft_text);
    } catch {
      setGenError('Could not generate draft. Write homework manually below.');
    } finally { setGenerating(false); }
  }

  async function handleSubmit() {
    if (!draftText.trim()) return;
    setSubmitting(true); setSubmitError('');
    try {
      const endpoint = isEdit
        ? `/api/v1/teacher/homework/${existingRecord!.id}`
        : '/api/v1/teacher/homework/submit';
      const method = isEdit ? 'PUT' : 'POST';
      const body = isEdit
        ? { raw_text: draftText.trim(), teacher_comments: teacherComments.trim() }
        : { chunk_id: chunkId, topic_label: topicLabel, raw_text: draftText.trim(), teacher_comments: teacherComments.trim(), section_id: sectionId };

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error || 'Failed to save'); return; }

      setFormattedText(data.homework_record.formatted_text);
      setSavedRecord(data.homework_record);
      setParentsNotified(data.parents_notified);
      setFailedParents(data.failed_parents || []);
      setFormattingSkipped(data.formatting_skipped || false);
      setStep('preview');
    } catch {
      setSubmitError('Something went wrong. Please try again.');
    } finally { setSubmitting(false); }
  }

  function handleConfirm() {
    if (savedRecord) { onSaved(savedRecord); }
    setStep('done');
  }

  const canSubmit = draftText.trim().length > 0;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="px-5 py-4 flex items-start justify-between flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#1A3C2E,#2E7D5E)', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
          <div>
            <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">
              {isEdit ? '✏️ Edit Homework' : '📝 Generate Homework'}
            </p>
            <p className="text-white font-bold text-base mt-0.5 leading-tight">{topicLabel}</p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:bg-white/20 text-lg font-bold flex-shrink-0 mt-0.5">
            ×
          </button>
        </div>

        {/* Step indicator */}
        {step !== 'done' && (
          <div className="flex px-5 py-2 gap-2 flex-shrink-0 border-b border-gray-100">
            {(['draft', 'preview'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                {i > 0 && <div className="w-6 h-px bg-gray-200" />}
                <div className="flex items-center gap-1">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step === s ? 'bg-emerald-600 text-white' : step === 'preview' && s === 'draft' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                    {step === 'preview' && s === 'draft' ? '✓' : i + 1}
                  </div>
                  <span className={`text-[11px] font-medium ${step === s ? 'text-emerald-700' : 'text-gray-400'}`}>
                    {s === 'draft' ? 'Write' : 'Preview'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* ── Step: Draft ── */}
          {step === 'draft' && (
            <>
              {generating && (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2.5">
                  <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin border-emerald-600" />
                  Generating homework with AI…
                </div>
              )}
              {genError && (
                <div className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                  <span>{genError}</span>
                  <button onClick={generateDraft} className="text-xs font-semibold text-amber-800 underline">Retry</button>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Homework Instructions <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={draftText}
                  onChange={e => setDraftText(e.target.value)}
                  placeholder="What should the child do at home?"
                  rows={5}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                />
                {!canSubmit && draftText !== '' && (
                  <p className="text-xs text-red-500 mt-1">Homework text cannot be empty or whitespace only.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Teacher's Comments <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={teacherComments}
                  onChange={e => setTeacherComments(e.target.value)}
                  placeholder="Any personal notes or extra instructions for parents…"
                  rows={2}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                />
              </div>

              {submitError && (
                <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{submitError}</p>
              )}
            </>
          )}

          {/* ── Step: Preview ── */}
          {step === 'preview' && (
            <>
              <div className="rounded-xl p-4 bg-emerald-50 border border-emerald-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-2">
                  {isEdit ? '📝 Updated Message to Parents' : '📤 Message to Parents'}
                </p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{formattedText}</p>
              </div>
              {formattingSkipped && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
                  ⚠️ AI formatting was unavailable — your original text will be sent as-is.
                </p>
              )}
            </>
          )}

          {/* ── Step: Done ── */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-6 text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-3xl">✅</div>
              <div>
                <p className="text-base font-bold text-gray-800">
                  {isEdit ? 'Homework updated!' : 'Homework sent!'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {parentsNotified} parent{parentsNotified !== 1 ? 's' : ''} notified
                </p>
              </div>
              {failedParents.length > 0 && (
                <div className="w-full text-left bg-red-50 rounded-xl px-3 py-2.5 border border-red-100">
                  <p className="text-xs font-semibold text-red-700 mb-1">⚠️ Failed to notify {failedParents.length} parent(s)</p>
                  <p className="text-xs text-red-600">Please try resending from the homework panel.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex gap-2 flex-shrink-0 border-t border-gray-100">
          {step === 'draft' && (
            <>
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
                style={{ background: canSubmit && !submitting ? '#1A3C2E' : '#9CA3AF' }}>
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin border-white" />
                    Saving…
                  </span>
                ) : 'Preview & Send'}
              </button>
            </>
          )}
          {step === 'preview' && (
            <>
              <button onClick={() => setStep('draft')}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
                ← Back
              </button>
              <button onClick={handleConfirm}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: '#1A3C2E' }}>
                Confirm & Send
              </button>
            </>
          )}
          {step === 'done' && (
            <button onClick={onClose}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: '#1A3C2E' }}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
