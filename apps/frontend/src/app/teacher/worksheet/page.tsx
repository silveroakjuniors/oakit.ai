'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost } from '@/lib/api';
import { getToken, clearToken } from '@/lib/auth';
import OakitLogo from '@/components/OakitLogo';

const CLASS_LEVELS = ['Play Group', 'Nursery', 'LKG', 'UKG'];
const SUBJECTS = ['English', 'Maths', 'Science', 'EVS', 'Art', 'Music', 'Physical Education', 'General Knowledge'];

interface WorksheetSection {
  type: 'fill_in_blank' | 'matching' | 'drawing';
  title: string;
  items?: { question?: string; answer?: string; left?: string; right?: string }[];
  prompt?: string;
}
interface Worksheet {
  title: string; topic: string; class_level: string;
  no_curriculum_content?: boolean; sections: WorksheetSection[];
}

export default function WorksheetPage() {
  const router = useRouter();
  const token = getToken() || '';
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [classLevel, setClassLevel] = useState('');
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (!token) router.push('/login'); }, []);

  async function generate() {
    if (!subject || !classLevel) { setError('Please select subject and class level'); return; }
    setGenerating(true); setError(''); setWorksheet(null);
    try {
      const data = await apiPost<Worksheet>('/api/v1/teacher/suggestions/worksheet', { subject, topic, class_level: classLevel }, token);
      setWorksheet(data);
    } catch (e: any) { setError(e.message || 'Failed to generate worksheet'); }
    finally { setGenerating(false); }
  }

  function printWorksheet() {
    window.print();
  }

  const today = new Date().toISOString().split('T')[0];
  const filename = `${classLevel.replace(' ', '-')}-${subject}-${today}.pdf`;

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="text-white px-4 py-3 flex items-center justify-between shrink-0 print:hidden"
        style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 100%)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-white/60 hover:text-white text-lg">←</button>
          <OakitLogo size="xs" variant="light" />
          <span className="text-sm text-white/80 font-medium">Worksheet Generator</span>
        </div>
        <button onClick={() => { clearToken(); router.push('/login'); }} className="text-white/50 text-xs">Sign out</button>
      </header>

      <div className="p-4 max-w-2xl mx-auto w-full">
        {/* Generator form */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-100 mb-4 print:hidden">
          <p className="text-sm font-semibold text-neutral-700 mb-3">Generate a Worksheet</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-medium text-neutral-600 mb-1 block">Subject *</label>
              <select value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:border-primary-400">
                <option value="">Select subject</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-600 mb-1 block">Class Level *</label>
              <select value={classLevel} onChange={e => setClassLevel(e.target.value)}
                className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:border-primary-400">
                <option value="">Select level</option>
                {CLASS_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs font-medium text-neutral-600 mb-1 block">Topic (optional)</label>
            <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Animals, Colours, Numbers 1-10"
              className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-primary-400" />
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl mb-3">{error}</p>}
          <div className="flex gap-2">
            <button onClick={generate} disabled={generating || !subject || !classLevel}
              className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors">
              {generating ? '⏳ Generating...' : '✨ Generate Worksheet'}
            </button>
            {worksheet && (
              <button onClick={generate} disabled={generating}
                className="px-4 py-2.5 border border-neutral-200 text-neutral-600 text-sm rounded-xl hover:bg-neutral-50 disabled:opacity-50">
                🔄 Regenerate
              </button>
            )}
          </div>
        </div>

        {/* Worksheet preview */}
        {worksheet && (
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
            {/* Print header */}
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between print:hidden">
              <p className="text-sm font-semibold text-neutral-700">Preview</p>
              <button onClick={printWorksheet}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-colors">
                🖨️ Print / Save PDF
              </button>
            </div>

            {/* Worksheet content */}
            <div className="px-6 py-6 print:px-8 print:py-8" id="worksheet-content">
              {/* Header */}
              <div className="text-center mb-6 border-b-2 border-neutral-800 pb-4">
                <h1 className="text-xl font-bold text-neutral-900">{worksheet.title}</h1>
                <p className="text-sm text-neutral-600 mt-1">{worksheet.class_level} · {worksheet.topic}</p>
                <div className="flex justify-between mt-3 text-xs text-neutral-500">
                  <span>Name: ___________________________</span>
                  <span>Date: _______________</span>
                </div>
              </div>

              {worksheet.no_curriculum_content && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mb-4 text-xs text-amber-700 print:hidden">
                  ⚠ No curriculum content found for this topic. Using general age-appropriate content.
                </div>
              )}

              {/* Sections */}
              {worksheet.sections.map((section, si) => (
                <div key={si} className="mb-6">
                  <h2 className="text-base font-bold text-neutral-800 mb-3 border-b border-neutral-200 pb-1">
                    {si + 1}. {section.title}
                  </h2>

                  {section.type === 'fill_in_blank' && section.items && (
                    <div className="flex flex-col gap-3">
                      {section.items.map((item, ii) => (
                        <p key={ii} className="text-sm text-neutral-700">
                          {ii + 1}. {item.question}
                        </p>
                      ))}
                    </div>
                  )}

                  {section.type === 'matching' && section.items && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-semibold text-neutral-500 mb-1">Column A</p>
                        {section.items.map((item, ii) => (
                          <div key={ii} className="flex items-center gap-2">
                            <span className="text-sm font-medium text-neutral-700 w-4">{ii + 1}.</span>
                            <span className="text-sm text-neutral-700 border border-neutral-300 rounded px-2 py-1 flex-1">{item.left}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-semibold text-neutral-500 mb-1">Column B</p>
                        {[...(section.items || [])].sort(() => Math.random() - 0.5).map((item, ii) => (
                          <div key={ii} className="flex items-center gap-2">
                            <span className="text-sm font-medium text-neutral-500 w-4">{String.fromCharCode(65 + ii)}.</span>
                            <span className="text-sm text-neutral-700 border border-neutral-300 rounded px-2 py-1 flex-1">{item.right}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {section.type === 'drawing' && (
                    <div>
                      <p className="text-sm text-neutral-700 mb-3">{section.prompt}</p>
                      <div className="border-2 border-dashed border-neutral-300 rounded-xl h-40 flex items-center justify-center">
                        <p className="text-xs text-neutral-400">Draw here</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Footer */}
              <div className="mt-6 pt-4 border-t border-neutral-200 text-center">
                <p className="text-xs text-neutral-400">Generated by Oakit.ai · {today}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}
