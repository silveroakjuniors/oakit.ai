'use client';
import { Bell } from 'lucide-react';
import type { Notification, Announcement } from '../types';

export function NotificationsTab({ notifications, announcements, onRead }: {
  notifications: Notification[]; announcements: Announcement[]; onRead: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      {announcements.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-neutral-800 mb-3">📢 Announcements</h2>
          <div className="space-y-3">
            {announcements.map(a => (
              <div key={a.id} className="bg-white rounded-2xl p-4 border-l-4 border-primary-400 shadow-sm">
                <p className="font-bold text-neutral-800 text-sm">{a.title}</p>
                <p className="text-sm text-neutral-600 mt-1">{a.body}</p>
                <p className="text-xs text-neutral-400 mt-2">By {a.author_name} · {a.created_at.split('T')[0]}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <h2 className="text-lg font-bold text-neutral-800 mb-3">🔔 Updates</h2>
        {notifications.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-neutral-100 shadow-sm">
            <Bell size={40} className="text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500 font-medium">You&apos;re all caught up!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map(n => (
              <div key={n.id} className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-neutral-800 text-sm">{n.section_name}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">{n.completion_date.split('T')[0]} · {n.chunks_covered} topics covered</p>
                  </div>
                  <button onClick={() => onRead(n.id)}
                    className="text-xs text-emerald-600 font-bold px-3 py-1.5 rounded-xl hover:bg-emerald-50 transition-colors min-h-[32px]">
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
