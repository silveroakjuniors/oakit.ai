'use client';
import { useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { apiPost } from '@/lib/api';
import type { BirthdayKid } from './types';

interface Props {
  birthdays: BirthdayKid[];
  token: string;
}

export default function BirthdayPanel({ birthdays, token }: Props) {
  const [birthdayMsg, setBirthdayMsg] = useState('');
  const [formattedMsg, setFormattedMsg] = useState('');
  const [formatting, setFormatting] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState('');

  const todayBirthdays = birthdays.filter(b => b.days_until === 0);
  const upcomingBirthdays = birthdays.filter(b => b.days_until > 0);

  if (birthdays.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-pink-50 flex items-center gap-2">
        <span className="text-lg">🎂</span>
        <div>
          <p className="text-sm font-bold text-neutral-800">
            {todayBirthdays.length > 0 ? `Birthdays Today (${todayBirthdays.length})` : 'Upcoming Birthdays'}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">
            {todayBirthdays.length > 0 ? 'Send wishes to students & parents' : `${upcomingBirthdays.length} in next 7 days`}
          </p>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {birthdays.map(kid => (
          <div
            key={kid.id}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl ${
              kid.days_until === 0 ? 'bg-pink-50 border border-pink-100' : 'bg-neutral-50'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {kid.name?.[0] ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-neutral-800 truncate">{kid.name}</p>
              <p className="text-[10px] text-neutral-400">{kid.class_name} · {kid.section_label}</p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
              kid.days_until === 0 ? 'bg-pink-500 text-white' : 'bg-amber-100 text-amber-700'
            }`}>
              {kid.days_until === 0 ? '🎉 Today' : `in ${kid.days_until}d`}
            </span>
          </div>
        ))}

        {/* Send wishes */}
        {todayBirthdays.length > 0 && (
          <div className="pt-2 border-t border-pink-100">
            {!formattedMsg ? (
              <div className="flex gap-2">
                <input
                  value={birthdayMsg}
                  onChange={e => setBirthdayMsg(e.target.value)}
                  placeholder="Write a wish — Oakie will format it ✨"
                  className="flex-1 px-3 py-2 border border-pink-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-pink-300/40"
                />
                <button
                  onClick={async () => {
                    if (!birthdayMsg.trim()) return;
                    setFormatting(true);
                    try {
                      const names = todayBirthdays.map(k => k.name).join(', ');
                      const res = await apiPost<{ response: string }>('/api/v1/ai/query', {
                        text: `Write a warm birthday message for ${names} from the school principal. Under 50 words, joyful, school-appropriate. Birthday message only.`,
                      }, token);
                      setFormattedMsg(res.response.split('\n\n')[0].trim() || birthdayMsg);
                    } catch { setFormattedMsg(birthdayMsg); }
                    finally { setFormatting(false); }
                  }}
                  disabled={formatting || !birthdayMsg.trim()}
                  className="px-3 py-2 bg-pink-500 text-white rounded-xl text-xs font-bold hover:bg-pink-600 disabled:opacity-50 shrink-0"
                >
                  {formatting
                    ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                    : <Sparkles size={12} />
                  }
                </button>
              </div>
            ) : (
              <div className="bg-white border border-pink-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-pink-700 mb-1.5">Review before sending</p>
                <p className="text-sm text-neutral-800 leading-relaxed">{formattedMsg}</p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={async () => {
                      setSending(true);
                      try {
                        await apiPost('/api/v1/principal/birthdays/send', {
                          student_ids: todayBirthdays.map(b => b.id),
                          message: formattedMsg,
                        }, token);
                        setSent(`✓ Sent to ${todayBirthdays.length} student${todayBirthdays.length > 1 ? 's' : ''} and parents!`);
                        setFormattedMsg('');
                        setBirthdayMsg('');
                      } catch { setSent('Failed — try again'); }
                      finally { setSending(false); }
                    }}
                    disabled={sending}
                    className="flex-1 py-2 bg-pink-500 text-white rounded-xl text-xs font-bold hover:bg-pink-600 disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {sending
                      ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><Send size={12} />Send</>
                    }
                  </button>
                  <button
                    onClick={() => setFormattedMsg('')}
                    className="px-3 py-2 border border-neutral-200 rounded-xl text-xs text-neutral-600"
                  >
                    Edit
                  </button>
                </div>
              </div>
            )}
            {sent && <p className="text-xs text-emerald-600 font-medium mt-2">{sent}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
