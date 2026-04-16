'use client';
import { Calendar, TrendingUp, BookOpen, Sparkles, MessageSquare, CheckCircle2 } from 'lucide-react';
import ChildAvatar from './ChildAvatar';
import { useTranslation } from '../context';
import type { ChildFeed, ProgressData, Child, Announcement, NoteItem, Tab } from '../types';

export default function HomeTab({ feed, progress, activeChild, announcements, onNoteClick, onTabChange, token, onChildUpdate }: {
  feed: ChildFeed | null; progress: ProgressData | null; activeChild: Child | null;
  announcements: Announcement[]; onNoteClick: (n: NoteItem) => void; onTabChange: (t: Tab) => void;
  token: string; onChildUpdate: (url: string) => void;
}) {
  const { t } = useTranslation();
  if (!activeChild) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-neutral-500 font-medium">No child selected</p>
    </div>
  );

  const att = feed?.attendance;
  const attColor = !att ? 'text-neutral-500' : att.status === 'present' && !att.is_late ? 'text-emerald-700' : att.status === 'present' ? 'text-amber-700' : 'text-red-600';
  const attBg = !att ? 'bg-neutral-50' : att.status === 'present' && !att.is_late ? 'bg-emerald-50' : att.status === 'present' ? 'bg-amber-50' : 'bg-red-50';
  const attLabel = !att ? 'Not marked' : att.status === 'present' && att.is_late ? '⏰ Late' : att.status === 'present' ? '✓ Present' : '✗ Absent';
  const pct = progress?.coverage_pct ?? 0;

  return (
    <div className="space-y-4">
      {/* Child profile card */}
      <div className="bg-gradient-to-r from-[#0f2417] to-[#1e5c3a] rounded-2xl p-5 flex items-center gap-4">
        <div className="shrink-0">
          <ChildAvatar child={activeChild} size="lg" token={token} onUploaded={onChildUpdate} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-lg leading-tight truncate">{activeChild.name}</p>
          <p className="text-white/60 text-sm mt-0.5">{activeChild.class_name} · Section {activeChild.section_label}</p>
          <p className="text-white/40 text-xs mt-2">{t('Tap photo to preview or change')}</p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-2">
          <div className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
            !att ? 'bg-white/10 text-white/60' :
            att.status === 'present' && !att.is_late ? 'bg-emerald-500/20 text-emerald-300' :
            att.status === 'present' ? 'bg-amber-500/20 text-amber-300' :
            'bg-red-500/20 text-red-300'
          }`}>
            {t(attLabel)}
          </div>
          <button onClick={() => onTabChange('settings')}
            className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-[10px] font-medium transition-colors">
            {t('🌐 Translate')}
          </button>
        </div>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-2 lg:grid-cols-12 gap-3">
        <div className={`${attBg} rounded-2xl p-4 border border-neutral-100 col-span-1 lg:col-span-3`}>
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={16} className="text-neutral-400" />
            <p className="text-xs font-medium text-neutral-500">{t('Attendance')}</p>
          </div>
          <p className={`text-xl font-bold ${attColor}`}>{t(attLabel)}</p>
          {att?.arrived_at && <p className="text-xs text-neutral-400 mt-1">{t('Arrived')} {att.arrived_at.slice(0, 5)}</p>}
          {!att && <p className="text-xs text-neutral-400 mt-1">{t('Not yet marked')}</p>}
        </div>

        <div className="bg-[#0f2417] rounded-2xl p-4 col-span-1 lg:col-span-3 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-10">
            <TrendingUp size={80} className="text-white" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} className="text-emerald-400" />
              <p className="text-xs font-medium text-white/60">Progress</p>
            </div>
            <p className="text-3xl font-black text-white">{pct}%</p>
            <p className="text-xs text-white/50 mt-0.5">syllabus covered</p>
            <div className="w-full bg-white/10 h-1.5 rounded-full mt-2">
              <div className="bg-emerald-400 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm col-span-2 lg:col-span-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-amber-500" />
              <p className="text-sm font-semibold text-neutral-800">{t('Homework')}</p>
            </div>
            <button onClick={() => onTabChange('progress')} className="text-xs text-primary-600 font-medium hover:underline">{t('History →')}</button>
          </div>
          {feed?.homework ? (
            <p className="text-sm text-neutral-700 leading-relaxed line-clamp-3 italic border-l-4 border-amber-200 pl-3">
              &ldquo;{feed.homework.formatted_text || feed.homework.raw_text}&rdquo;
            </p>
          ) : (
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 size={16} />
              <p className="text-sm font-medium">{t('No pending homework — great job!')}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm col-span-2 lg:col-span-8">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-primary-600" />
            <p className="text-sm font-semibold text-neutral-800">{t('Today\'s Learning')}</p>
          </div>
          {feed?.special_label ? (
            <div className="bg-blue-50 rounded-xl px-3 py-2.5"><p className="text-sm text-blue-700 font-medium">{feed.special_label}</p></div>
          ) : feed?.topics && feed.topics.length > 0 ? (
            <div className="space-y-2">
              {feed.topics.map((topic, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">{i + 1}</span>
                  <p className="text-sm text-neutral-700">{topic}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-400">No topics recorded yet for today</p>
          )}
        </div>

        <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 col-span-2 lg:col-span-4 flex flex-col justify-between">
          <div>
            <p className="font-bold text-emerald-900 text-sm mb-1">{t('Need Help?')}</p>
            <p className="text-xs text-emerald-700/80 leading-snug">Ask Oakie AI or message {activeChild.name.split(' ')[0]}&apos;s teacher directly.</p>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => onTabChange('chat')} className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-700 transition-colors">
              <Sparkles size={14} /> Oakie
            </button>
            <button onClick={() => onTabChange('messages')} className="flex-1 bg-white text-emerald-800 py-2.5 rounded-xl text-xs font-bold border border-emerald-200 flex items-center justify-center gap-1.5 hover:bg-emerald-50 transition-colors">
              <MessageSquare size={14} /> Teacher
            </button>
          </div>
        </div>
      </div>

      {/* Child Journey */}
      <div className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen size={16} className="text-primary-500" />
          <p className="text-sm font-semibold text-neutral-800">{activeChild.name.split(' ')[0]}&apos;s Journey</p>
        </div>
        <p className="text-xs text-neutral-500 mb-3 leading-relaxed">
          Daily highlights and special moments recorded by {activeChild.name.split(' ')[0]}&apos;s teacher.
        </p>
        <a href={`/parent/journey?student_id=${activeChild.id}`}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-colors">
          <BookOpen size={14} /> View {activeChild.name.split(' ')[0]}&apos;s Journey
        </a>
      </div>

      {/* Teacher notes */}
      {feed?.notes && feed.notes.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm">
          <p className="text-sm font-semibold text-neutral-800 mb-3">📋 {t('Teacher Notes')}</p>
          <div className="space-y-2">
            {feed.notes.map(note => {
              const dl = Math.ceil((new Date(note.expires_at).getTime() - Date.now()) / 86400000);
              return (
                <button key={note.id} onClick={() => onNoteClick(note)}
                  className="w-full text-left bg-neutral-50 hover:bg-neutral-100 rounded-xl px-3 py-3 transition-colors border border-neutral-100">
                  {note.note_text && <p className="text-sm text-neutral-700 line-clamp-2 mb-1">{note.note_text}</p>}
                  {note.file_name && <div className="flex items-center gap-2"><span>📎</span><p className="text-xs font-medium text-neutral-700 truncate flex-1">{note.file_name}</p><span className="text-xs text-primary-600 font-medium">Download ↓</span></div>}
                  <p className={`text-xs mt-1 ${dl <= 3 ? 'text-red-500 font-medium' : 'text-neutral-400'}`}>{dl <= 0 ? 'Expires today' : `Expires in ${dl} day${dl === 1 ? '' : 's'}`}</p>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-amber-600 mt-3">⚠ Notes auto-delete after expiry. Download attachments you need to keep.</p>
        </div>
      )}

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm">
          <p className="text-sm font-semibold text-neutral-800 mb-3">📢 {t('School Announcements')}</p>
          <div className="space-y-3">
            {announcements.slice(0, 3).map(a => (
              <div key={a.id} className="border-l-4 border-primary-400 pl-3">
                <p className="text-sm font-medium text-neutral-800">{a.title}</p>
                <p className="text-xs text-neutral-600 mt-0.5 line-clamp-2">{a.body}</p>
                <p className="text-xs text-neutral-400 mt-1">By {a.author_name} · {a.created_at.split('T')[0]}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
