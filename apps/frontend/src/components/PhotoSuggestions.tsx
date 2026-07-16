'use client';

import { useState, useEffect } from 'react';
import { Camera, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { apiGet } from '@/lib/api';

interface PhotoSuggestion {
  emoji: string;
  title: string;
  description: string;
  subject: string;
}

interface Props {
  token: string;
  sectionId?: string;
  planDate?: string;
}

export default function PhotoSuggestions({ token, sectionId, planDate }: Props) {
  const [suggestions, setSuggestions] = useState<PhotoSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, sectionId, planDate]);

  async function loadSuggestions() {
    setLoading(true);
    setError('');
    try {
      const url = `/api/v1/teacher/plan/photo-suggestions${sectionId ? `?section_id=${sectionId}` : ''}`;
      const data = await apiGet<{ suggestions: PhotoSuggestion[] }>(url, token);
      setSuggestions(data.suggestions || []);
    } catch {
      setError('Could not load photo suggestions.');
    } finally {
      setLoading(false);
    }
  }

  if (!loading && suggestions.length === 0 && !error) return null;

  return (
    <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 overflow-hidden">
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(e => !e)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setExpanded(v => !v); }}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-emerald-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Camera size={16} className="text-emerald-600 flex-shrink-0" />
          <span className="text-sm font-semibold text-emerald-800">
            Photo Suggestions for Today&apos;s Feed
          </span>
          <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full font-medium">
            {suggestions.length} ideas
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); loadSuggestions(); }}
            className="p-1 rounded-lg hover:bg-emerald-100 transition-colors"
            title="Refresh suggestions"
          >
            <RefreshCw size={13} className={`text-emerald-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {expanded ? (
            <ChevronUp size={15} className="text-emerald-500" />
          ) : (
            <ChevronDown size={15} className="text-emerald-500" />
          )}
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4">
          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 bg-emerald-100/60 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <p className="text-xs text-red-500 py-2">{error}</p>
          ) : (
            <>
              <p className="text-xs text-emerald-700 mb-3 leading-relaxed">
                Based on today&apos;s lessons, here are 5 photo ideas to capture and share with parents on the class feed:
              </p>
              <div className="flex flex-col gap-2">
                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 bg-white rounded-xl px-3 py-2.5 border border-emerald-100 shadow-sm"
                  >
                    {/* Number + emoji */}
                    <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-emerald-400 w-4">{i + 1}.</span>
                      <span className="text-base leading-none">{s.emoji}</span>
                    </div>
                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 leading-tight">{s.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{s.description}</p>
                    </div>
                    {/* Subject badge */}
                    <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5">
                      {s.subject}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-emerald-600 mt-3 text-center">
                Tap <strong>+ Post</strong> in the Class Feed to share your photos with parents 📲
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
