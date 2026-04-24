'use client';
import { Bell, Megaphone, CheckCircle2 } from 'lucide-react';
import type { Notification, Announcement } from '../types';

const P = {
  brand: '#1F7A5A', brandDark: '#166A4D', brandSoft: '#E8F3EF', brandBorder: '#A7D4C0',
  bg: '#F8FAFC', card: '#F8FAFC', border: '#E4E4E7',
  text: '#18181B', textSub: '#3F3F46', textMuted: '#71717A',
};

const cardStyle: React.CSSProperties = {
  background: P.card, border: `1px solid ${P.border}`,
  borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  transition: 'box-shadow 0.18s ease, transform 0.18s ease',
};

const cardHoverClass = 'hover:shadow-md hover:-translate-y-0.5';

function SectionLabel({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={14} strokeWidth={1.75} style={{ color: P.textMuted }} />
      <p className="text-sm font-semibold" style={{ color: P.textSub }}>{text}</p>
    </div>
  );
}

export default function NotificationsTab({ notifications, announcements, onRead }: {
  notifications: Notification[]; announcements: Announcement[]; onRead: (id: string) => void;
}) {
  return (
    <div className="space-y-4 pb-6">

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className={cardHoverClass} style={cardStyle}>
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${P.border}` }}>
            <SectionLabel icon={Megaphone} text="Announcements" />
          </div>
          <div className="px-5 py-4 space-y-3">
            {announcements.map((a) => (
              <div key={a.id} className="rounded-lg p-4 transition-all hover:shadow-sm hover:-translate-y-0.5 cursor-default"
                style={{ background: P.bg, border: `1px solid ${P.border}` }}>
                <p className="text-sm font-semibold mb-1" style={{ color: P.text }}>{a.title}</p>
                <p className="text-sm leading-relaxed" style={{ color: P.textSub }}>{a.body}</p>
                <p className="text-xs mt-2" style={{ color: P.textMuted }}>
                  By {a.author_name} · {a.created_at.split('T')[0]}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notifications */}
      <div className={cardHoverClass} style={cardStyle}>
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${P.border}` }}>
          <SectionLabel icon={Bell} text="Updates" />
        </div>
        <div className="px-5 py-4">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
                style={{ background: P.brandSoft }}>
                <CheckCircle2 size={24} strokeWidth={1.5} style={{ color: P.brand }} />
              </div>
              <p className="text-sm font-semibold mb-1" style={{ color: P.text }}>You're all caught up!</p>
              <p className="text-sm" style={{ color: P.textMuted }}>No new updates right now</p>
            </div>
          ) : (
            <div className="space-y-1">
              {notifications.map(n => (
                <div key={n.id} className="flex items-center gap-3 py-3 rounded-lg px-2 transition-all hover:bg-neutral-100 hover:shadow-sm cursor-default"
                  style={{ borderBottom: `1px solid ${P.border}` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: P.brandSoft }}>
                    <Bell size={14} strokeWidth={1.75} style={{ color: P.brand }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: P.text }}>{n.section_name}</p>
                    <p className="text-xs" style={{ color: P.textMuted }}>
                      {(n.completion_date || '').split('T')[0]} · {n.chunks_covered} topics covered
                    </p>
                  </div>
                  <button onClick={() => onRead(n.id)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg flex-shrink-0 transition-colors hover:bg-neutral-100"
                    style={{ background: P.bg, color: P.textSub, border: `1px solid ${P.border}` }}>
                    Dismiss
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
