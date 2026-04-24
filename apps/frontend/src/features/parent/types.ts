// ─── Shared types for the Parent Portal ──────────────────────────────────────

export interface TranslationSettings {
  enabled: boolean;
  targetLanguage: string;
  autoTranslate: boolean;
  supportedLanguages: string[];
}

export interface Child {
  id: string; name: string; class_name: string; section_label: string;
  section_id: string; class_id: string; photo_url?: string;
  father_name?: string; mother_name?: string;
}

export interface NoteItem {
  id: string; note_text: string | null; file_name: string | null;
  file_size: number | null; expires_at: string; created_at: string;
}

export interface ChildFeed {
  student_id: string; name: string; class_name: string; section_label: string;
  feed_date: string;
  attendance: { status: string; is_late: boolean; arrived_at: string | null } | null;
  completion: { covered_chunk_ids: string[]; submitted_at: string; teacher_name: string } | null;
  topics: string[]; plan_status: string | null; special_label: string | null;
  homework: { formatted_text: string; raw_text: string } | null;
  notes: NoteItem[];
}

export interface AttendanceData {
  records: { attend_date: string; status: string; is_late: boolean }[];
  attendance_pct: number; punctuality_pct: number;
  stats: { total: number; present: number; absent: number; late: number; on_time: number };
}

export interface ProgressData {
  student_id: string; coverage_pct: number; has_curriculum: boolean;
  total_chunks?: number; covered?: number;
}

export interface Notification {
  id: string; section_name: string; completion_date: string; chunks_covered: number; created_at: string;
}

export interface Announcement {
  id: string; title: string; body: string; created_at: string; author_name: string;
}

export interface ParentMessage {
  teacher_id: string; student_id: string; teacher_name: string; student_name: string;
  last_message: string; last_sent_at: string; last_sender: string; unread_count: number;
}

export interface HomeworkRecord {
  homework_date: string; status: string; teacher_note: string | null; homework_text: string | null;
}

export interface ChatMsg { role: 'user' | 'ai'; text: string; ts: number; }

export interface ChildCache {
  feed: ChildFeed | null; attendance: AttendanceData | null; progress: ProgressData | null;
}

export interface EmergencyContact {
  id: string; name: string; relation: string; phone: string;
  priority: 1 | 2 | 3; available: boolean;
}

export interface NotificationPreference {
  type: 'homework' | 'attendance' | 'progress' | 'messages' | 'announcements';
  enabled: boolean; channels: ('push' | 'sms' | 'email')[];
  quietHours: { start: string; end: string } | null;
  frequency: 'immediate' | 'daily' | 'weekly';
}

export interface CalendarEvent {
  id: string; title: string; description: string; start: string; end: string;
  type: 'homework' | 'exam' | 'holiday' | 'event' | 'meeting'; childId: string;
}

export interface Goal {
  id: string; title: string; description: string; target: string; current: string;
  deadline: string; status: 'not_started' | 'in_progress' | 'completed' | 'overdue';
  category: 'academic' | 'behavioral' | 'attendance';
}

export interface ParentInsights {
  attendanceTrend: 'improving' | 'declining' | 'stable';
  participationScore: number; strengths: string[]; areasForImprovement: string[];
  teacherFeedback: string[];
  predictions: { nextWeekAttendance: number; endOfMonthProgress: number; areasNeedingAttention: string[]; };
  goals?: { academic: Goal[]; behavioral: Goal[]; attendance: Goal[]; };
}

export interface ChildComparison {
  childId: string; name: string; attendance: number; progress: number;
  participation: number; rank: number; trend: 'up' | 'down' | 'stable';
}

export type Tab = 'home' | 'attendance' | 'progress' | 'chat' | 'messages' | 'notifications' | 'insights' | 'settings' | 'fees' | 'reports';
