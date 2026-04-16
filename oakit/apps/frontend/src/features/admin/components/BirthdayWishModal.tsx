'use client';

import { useState } from 'react';
import { X, Sparkles, Send, CheckCircle, Loader2 } from 'lucide-react';
import { generateBirthdayWish, sendBirthdayWish, BirthdayRow } from '@/features/admin/api/dashboard';
import { getToken } from '@/lib/auth';

interface Props {
  birthdays: BirthdayRow[];   // only today's (days_until === 0)
  onClose: () => void;
}

export default function BirthdayWishModal({ birthdays, onClose }: Props) {
  const token = getToken() || '';
  const [message, setMessage] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentTo, setSentTo] = useState<string[]>([]);

  const todayKids = birthdays.filter(b => b.days_until === 0);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const students = todayKids.map(b => ({
        name: b.name,
        age: b.turning_age || b.current_age,
        class_name: b.class_name,
        section_label: b.section_label,
      }));
      const res = await generateBirthdayWish(students, token);
      setMessage(res.message);
    } catch {
      setMessage(`🎂 Wishing a very Happy Birthday to ${todayKids.map(b => b.name).join(', ')}! May this special day be filled with joy and wonderful memories. The entire school family celebrates with you today. Keep shining bright! 🌟`);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await sendBirthdayWish(todayKids.map(b => b.student_id), message, token);
      setSentTo(res.sent_to);
      setSent(true);
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #fdf2f8, #fce7f3)' }}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎂</span>
              <p className="text-base font-bold text-pink-900">Birthday Wishes</p>
            </div>
            <p className="text-xs text-pink-600 mt-0.5">
              {todayKids.length} student{todayKids.length !== 1 ? 's' : ''} celebrating today
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-pink-100 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-pink-400" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Birthday kids list */}
          <div className="flex flex-wrap gap-2">
            {todayKids.map(b => (
              <div key={b.student_id} className="flex items-center gap-2 bg-pink-50 border border-pink-200 rounded-2xl px-3 py-2">
                <span className="text-lg">🎉</span>
                <div>
                  <p className="text-xs font-bold text-pink-900">{b.name}</p>
                  <p className="text-[10px] text-pink-500">
                    {b.class_name} {b.section_label}
                    {b.turning_age ? ` · Turning ${b.turning_age}` : b.current_age ? ` · Age ${b.current_age}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Sent success state */}
          {sent ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-emerald-800">Wishes sent!</p>
              <p className="text-xs text-emerald-600 mt-1">
                Sent to parents of: {sentTo.join(', ')}
              </p>
              <button onClick={onClose} className="mt-3 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors">
                Done
              </button>
            </div>
          ) : (
            <>
              {/* AI generate button */}
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-pink-300 bg-pink-50 hover:bg-pink-100 transition-colors text-sm font-semibold text-pink-700 disabled:opacity-60"
              >
                {generating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Generating with Oakie AI…</>
                ) : (
                  <><Sparkles className="w-4 h-4" />Generate AI Birthday Message</>
                )}
              </button>

              {/* Message editor */}
              <div>
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1.5 block">
                  Message to Parents
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={5}
                  placeholder="Click 'Generate' above or type your own message…"
                  className="w-full px-4 py-3 border border-neutral-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 resize-none bg-neutral-50"
                />
                <p className="text-[10px] text-neutral-400 mt-1">
                  This will be sent as an announcement to the parents of all birthday students.
                </p>
              </div>

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={!message.trim() || sending}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-pink-600 text-white text-sm font-bold rounded-2xl hover:bg-pink-700 transition-colors disabled:opacity-50"
              >
                {sending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Sending…</>
                ) : (
                  <><Send className="w-4 h-4" />Send Birthday Wishes</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
