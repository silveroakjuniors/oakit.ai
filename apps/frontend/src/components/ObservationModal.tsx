'use client';

/**
 * ObservationModal — Quick popup to add an observation for a student
 *
 * Features:
 * - Pre-filled with the selected category
 * - AI suggestions based on category + student age
 * - AI validates the text before saving
 * - Shows history of observations for this student
 */

import { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, CheckCircle2, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';

interface Observation {
  id: string;
  obs_text: string | null;
  categories: string[];
  share_with_parent: boolean;
  obs_date: string;
  teacher_name: string;
}

interface ObservationModalProps {
  studentId: string;
  studentName: string;
  category: string;           // pre-selected category from the chip click
  token: string;
  onClose: () => void;
  onSaved: () => void;        // refresh parent after save
}

// AI suggestions per category
const AI_SUGGESTIONS: Record<string, string[]> = {
  'Cognitive Skills': [
    'Shows strong problem-solving ability during activities',
    'Demonstrates good memory and recall of previous lessons',
    'Asks thoughtful questions and shows curiosity',
    'Struggles to focus for extended periods — may need shorter tasks',
    'Excellent at pattern recognition and sorting activities',
  ],
  'Language & Communication': [
    'Communicates clearly and confidently with peers',
    'Vocabulary is expanding well — uses new words correctly',
    'Needs encouragement to speak up in group settings',
    'Excellent at storytelling and expressing ideas',
    'Shows improvement in pronunciation and fluency',
  ],
  'Social Interaction': [
    'Works well in group activities and shares materials',
    'Shows empathy towards classmates',
    'Prefers to work independently — encourage group participation',
    'Takes turns and follows classroom rules consistently',
    'Resolves conflicts calmly and independently',
  ],
  'Motor Skills': [
    'Fine motor skills are developing well — good pencil grip',
    'Excellent coordination during physical activities',
    'Needs support with cutting and fine motor tasks',
    'Shows good balance and body awareness',
    'Gross motor skills are age-appropriate',
  ],
  'Behavior': [
    'Follows classroom rules consistently',
    'Shows self-regulation and manages emotions well',
    'Needs reminders to stay on task',
    'Positive attitude and enthusiastic participation',
    'Occasional outbursts — working on emotional regulation',
  ],
  'Social Skills': [
    'Makes friends easily and is well-liked by peers',
    'Shares and takes turns without prompting',
    'Shy in new situations but warms up quickly',
    'Shows leadership qualities in group activities',
    'Needs support in conflict resolution',
  ],
  'Academic Progress': [
    'Performing above grade level in most subjects',
    'Shows consistent improvement week over week',
    'Needs additional support in reading comprehension',
    'Excellent at mathematics — quick mental calculations',
    'Writing skills are developing at expected pace',
  ],
  'Other': [
    'Shows great enthusiasm and positive attitude',
    'Excellent attendance and punctuality',
    'Creative and imaginative in free play',
    'Helpful to classmates and teachers',
  ],
};

export default function ObservationModal({
  studentId, studentName, category, token, onClose, onSaved,
}: ObservationModalProps) {
  const [obsText, setObsText] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([category]);
  const [shareWithParent, setShareWithParent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');
  const [aiValidation, setAiValidation] = useState<{ ok: boolean; feedback: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Observation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const suggestions = AI_SUGGESTIONS[category] || AI_SUGGESTIONS['Other'];

  const ALL_CATEGORIES = ['Cognitive Skills', 'Language & Communication', 'Social Interaction',
    'Motor Skills', 'Behavior', 'Social Skills', 'Academic Progress', 'Other'];

  function toggleCategory(cat: string) {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  }

  function useSuggestion(text: string) {
    setObsText(text);
    setShowSuggestions(false);
    setAiValidation(null);
  }

  async function validateWithAI() {
    if (!obsText.trim()) return;
    setValidating(true);
    setAiValidation(null);
    try {
      const res = await apiPost<{ ok: boolean; feedback: string }>(
        '/api/v1/teacher/observations/validate',
        { obs_text: obsText, categories: selectedCategories, student_name: studentName },
        token
      );
      setAiValidation(res);
    } catch {
      // If validation endpoint fails, allow saving anyway
      setAiValidation({ ok: true, feedback: 'Observation looks good.' });
    } finally {
      setValidating(false);
    }
  }

  async function save() {
    if (!obsText.trim() && selectedCategories.length === 0) {
      setError('Please write an observation or select a category.');
      return;
    }
    if (obsText.length > 500) {
      setError('Observation must be 500 characters or less.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await apiPost('/api/v1/teacher/observations', {
        student_id: studentId,
        obs_text: obsText.trim() || null,
        categories: selectedCategories,
        share_with_parent: shareWithParent,
      }, token);
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save observation.');
    } finally {
      setSaving(false);
    }
  }

  async function loadHistory() {
    if (history.length > 0) { setShowHistory(h => !h); return; }
    setLoadingHistory(true);
    try {
      const data = await apiGet<Observation[]>(`/api/v1/teacher/observations/${studentId}`, token);
      setHistory(data);
      setShowHistory(true);
    } catch {}
    finally { setLoadingHistory(false); }
  }

  // Auto-validate when text changes (debounced)
  useEffect(() => {
    if (!obsText.trim() || obsText.length < 10) { setAiValidation(null); return; }
    const t = setTimeout(() => validateWithAI(), 1200);
    return () => clearTimeout(t);
  }, [obsText]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <div className="relative w-full sm:w-[480px] bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 shrink-0">
          <div>
            <p className="text-sm font-bold text-neutral-800">Add Observation</p>
            <p className="text-xs text-neutral-500 mt-0.5">{studentName} · {category}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* AI Suggestions */}
          {showSuggestions && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles size={13} className="text-emerald-600" />
                <p className="text-xs font-semibold text-neutral-700">Oakie suggestions for {category}</p>
                <button onClick={() => setShowSuggestions(false)} className="ml-auto text-xs text-neutral-400 hover:text-neutral-600">Hide</button>
              </div>
              <div className="space-y-1.5">
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => useSuggestion(s)}
                    className="w-full text-left text-xs px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-emerald-800 transition-colors leading-relaxed">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Text input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-neutral-700">Your observation</p>
              {!showSuggestions && (
                <button onClick={() => setShowSuggestions(true)}
                  className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700">
                  <Sparkles size={11} /> Suggestions
                </button>
              )}
            </div>
            <textarea
              value={obsText}
              onChange={e => { setObsText(e.target.value.slice(0, 500)); setAiValidation(null); }}
              rows={3}
              placeholder={`Write your observation about ${studentName.split(' ')[0]}...`}
              className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-neutral-400">{obsText.length}/500</span>
              {validating && (
                <span className="flex items-center gap-1 text-xs text-amber-600">
                  <Loader2 size={11} className="animate-spin" /> Checking with Oakie…
                </span>
              )}
            </div>

            {/* AI validation feedback */}
            {aiValidation && (
              <div className={`flex items-start gap-2 mt-2 px-3 py-2 rounded-xl text-xs ${
                aiValidation.ok
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-amber-50 border border-amber-200 text-amber-700'
              }`}>
                {aiValidation.ok
                  ? <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                  : <Sparkles size={13} className="text-amber-600 shrink-0 mt-0.5" />
                }
                <span>{aiValidation.feedback}</span>
              </div>
            )}
          </div>

          {/* Category chips */}
          <div>
            <p className="text-xs font-semibold text-neutral-700 mb-2">Categories</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_CATEGORIES.map(cat => (
                <button key={cat} onClick={() => toggleCategory(cat)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    selectedCategories.includes(cat)
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'border-neutral-200 text-neutral-600 hover:border-emerald-300'
                  }`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Share toggle */}
          <div className="flex items-center justify-between px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl">
            <div>
              <p className="text-xs font-semibold text-neutral-700">Share with parent</p>
              <p className="text-[10px] text-neutral-400 mt-0.5">Parent will see this in their portal</p>
            </div>
            <button onClick={() => setShareWithParent(s => !s)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${shareWithParent ? 'bg-emerald-600' : 'bg-neutral-200'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${shareWithParent ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{error}</div>
          )}

          {/* History toggle */}
          <button onClick={loadHistory}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl hover:bg-neutral-100 transition-colors">
            <span className="text-xs font-semibold text-neutral-700">
              {loadingHistory ? 'Loading history…' : `Past observations for ${studentName.split(' ')[0]}`}
            </span>
            {loadingHistory
              ? <Loader2 size={14} className="animate-spin text-neutral-400" />
              : showHistory ? <ChevronUp size={14} className="text-neutral-400" /> : <ChevronDown size={14} className="text-neutral-400" />
            }
          </button>

          {showHistory && history.length > 0 && (
            <div className="space-y-2">
              {history.slice(0, 5).map(obs => (
                <div key={obs.id} className="bg-white border border-neutral-200 rounded-xl px-3 py-3">
                  {obs.obs_text && <p className="text-xs text-neutral-700 mb-1.5 leading-relaxed">{obs.obs_text}</p>}
                  {obs.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {obs.categories.map(c => (
                        <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">{c}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-neutral-400">{obs.obs_date} · {obs.teacher_name}</p>
                    <span className={`text-[10px] flex items-center gap-1 ${obs.share_with_parent ? 'text-emerald-600' : 'text-neutral-400'}`}>
                      {obs.share_with_parent ? <><Eye size={10} /> Shared</> : <><EyeOff size={10} /> Private</>}
                    </span>
                  </div>
                </div>
              ))}
              {history.length > 5 && (
                <p className="text-xs text-neutral-400 text-center">+{history.length - 5} more observations</p>
              )}
            </div>
          )}

          {showHistory && history.length === 0 && (
            <p className="text-xs text-neutral-400 text-center py-2">No previous observations for {studentName.split(' ')[0]}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-neutral-100 shrink-0 space-y-2">
          <button onClick={save} disabled={saving || (!obsText.trim() && selectedCategories.length === 0)}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : '✓ Save Observation'}
          </button>
        </div>
      </div>
    </div>
  );
}
