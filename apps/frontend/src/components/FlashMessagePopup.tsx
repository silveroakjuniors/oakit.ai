'use client';
import { useState, useEffect } from 'react';
import { X, Megaphone, CalendarDays, PartyPopper } from 'lucide-react';
import { apiGet } from '@/lib/api';

interface FlashMessage {
  id: string;
  title: string;
  body: string;
  is_tomorrow_event?: boolean;
  day_type?: string;
}

interface FlashMessagePopupProps {
  token: string;
}

export default function FlashMessagePopup({ token }: FlashMessagePopupProps) {
  const [messages, setMessages] = useState<FlashMessage[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!token) return;

    // Fetch both admin flash messages and tomorrow's event preview in parallel
    Promise.allSettled([
      apiGet<FlashMessage[]>('/api/v1/flash-messages', token),
      apiGet<FlashMessage | null>('/api/v1/flash-messages/tomorrow-preview', token),
    ]).then(([flashResult, tomorrowResult]) => {
      const all: FlashMessage[] = [];

      if (flashResult.status === 'fulfilled' && Array.isArray(flashResult.value)) {
        // Filter out messages already seen this session
        const unseen = flashResult.value.filter(m => !sessionStorage.getItem(`flash_seen_${m.id}`));
        all.push(...unseen);
      }

      if (tomorrowResult.status === 'fulfilled' && tomorrowResult.value) {
        const tm = tomorrowResult.value;
        if (tm && tm.id && !sessionStorage.getItem(`flash_seen_${tm.id}`)) {
          all.push(tm);
        }
      }

      if (all.length > 0) {
        setMessages(all);
        setCurrentIdx(0);
        setTimeout(() => setVisible(true), 700);
      }
    });
  }, [token]);

  function dismiss() {
    if (messages[currentIdx]) {
      sessionStorage.setItem(`flash_seen_${messages[currentIdx].id}`, '1');
    }
    if (currentIdx < messages.length - 1) {
      setCurrentIdx(i => i + 1);
    } else {
      setVisible(false);
    }
  }

  if (!visible || messages.length === 0) return null;

  const msg = messages[currentIdx];
  const isTomorrow = msg.is_tomorrow_event;
  const isHoliday  = msg.day_type === 'holiday';

  // Pick accent colour and icon based on message type
  const accent = isTomorrow
    ? (isHoliday ? { bg: '#7c3aed', light: '#f5f3ff' } : { bg: '#d97706', light: '#fffbeb' })
    : { bg: '#1B4332', light: '#f0fdf4' };

  const Icon = isTomorrow ? (isHoliday ? CalendarDays : PartyPopper) : Megaphone;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={dismiss}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{
          animation: 'flashPopIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Top accent bar */}
        <div className="h-1.5 w-full" style={{ background: accent.bg }} />

        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: accent.bg }}>
            <Icon size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
              style={{ color: accent.bg }}>
              {isTomorrow ? 'Tomorrow at Silver Oak Juniors' : 'From Silver Oak Juniors'}
            </p>
            <p className="text-[15px] font-bold text-neutral-900 leading-snug">{msg.title}</p>
          </div>
          <button
            onClick={dismiss}
            className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0 hover:bg-neutral-200 transition-colors mt-0.5"
          >
            <X size={13} className="text-neutral-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-5 flex flex-col gap-3 overflow-y-auto">
          <p className="text-[13px] text-neutral-700 leading-relaxed whitespace-pre-line">{msg.body}</p>

          {/* Dots for multiple messages */}
          {messages.length > 1 && (
            <div className="flex justify-center gap-1.5">
              {messages.map((_, i) => (
                <div key={i}
                  className="rounded-full transition-all"
                  style={{
                    width:  i === currentIdx ? 16 : 6,
                    height: 6,
                    background: i === currentIdx ? accent.bg : '#e5e7eb',
                  }} />
              ))}
            </div>
          )}

          <button
            onClick={dismiss}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
            style={{ background: accent.bg }}
          >
            {currentIdx < messages.length - 1 ? 'Next' : 'Got it'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes flashPopIn {
          from { opacity: 0; transform: scale(0.88) translateY(12px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>
    </div>
  );
}
