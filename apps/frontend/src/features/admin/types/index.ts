export interface AdminClass {
  id: string;
  name: string;
  sections: { id: string; label: string }[];
}

export interface AdminStudent {
  id: string;
  name: string;
  class_name: string;
  section_label: string;
}

export interface AdminStudentReport {
  school_name: string;
  student_name: string;
  class_name: string;
  section_label: string;
  father_name: string;
  mother_name: string;
  attendance: { present: number; absent: number; total: number; pct: number };
  curriculum: { covered: number; total: number; pct: number };
  milestones: { achieved: number; total: number; pct: number };
  observations: { obs_text: string; categories: string[]; obs_date: string }[];
}

export interface AdminProgressReport {
  school_name: string;
  student_name: string;
  age: string;
  class_name: string;
  section_label: string;
  teacher_name: string | null;
  father_name: string;
  mother_name: string;
  from_date: string;
  to_date: string;
  attendance: { present: number; absent: number; total: number; pct: number; absent_dates: string[] };
  curriculum: { covered: number; topics?: string[]; subjects?: string[]; learning_summary?: string };
  missed_topics: string[];
  homework: { completed: number; partial: number; not_submitted: number; total: number };
  milestones: { achieved: number; total: number };
  journey_highlights: string[];
  ai_report: string;
  report_id?: string;
  report_type?: string;
  periods_combined?: number;
}

export interface AdminSchoolReport {
  school_name: string;
  total_students: number;
  overall_attendance_pct: number;
  overall_coverage_pct: number;
  sections: { class_name: string; section_label: string; coverage_pct: number; total_chunks: number; covered_chunks: number }[];
}

export interface AdminQuizRow {
  id: string;
  subject: string;
  is_assigned: boolean;
  status: string;
  created_at: string;
  time_limit_mins: number | null;
  due_date: string | null;
  section_label: string;
  class_name: string;
  teacher_name: string | null;
  created_by_role: string;
  question_count: number;
  attempts_count: number;
  avg_pct: number | null;
}

export interface AdminQuizResult {
  attempt_id: string;
  student_name: string;
  total_marks: number;
  scored_marks: number;
  pct: number;
  status: string;
}

export interface AdminSavedReport {
  id: string;
  student_id: string;
  report_type: string;
  from_date: string;
  to_date: string;
  title: string;
  shared_with_parent: boolean;
  created_at: string;
  student_name: string;
  class_name: string;
}

export interface DashStats {
  staff: number;
  students: number;
  classes: number;
  sections: number;
  curriculum_docs: number;
  curriculum_chunks: number;
  activity_pools: number;
  holidays: number;
  special_days: number;
  sections_with_plans: number;
  today_attendance_sections: number;
  today_completions: number;
}

export interface CoverageRow {
  section_id: string;
  section_label: string;
  class_name: string;
  total_chunks: number;
  covered_chunks: number;
  coverage_pct: number;
  band: 'green' | 'amber' | 'red';
  alert: boolean;
}

export interface DrillDoc {
  title: string;
  total: number;
  covered: number;
  topics: { id: string; label: string; covered: boolean; completion_date: string | null }[];
}

export interface DrillDown {
  section_label: string;
  class_name: string;
  teacher_name: string | null;
  total_chunks: number;
  covered_chunks: number;
  coverage_pct: number;
  documents: DrillDoc[];
}

export interface TrendRow {
  date: string;
  present: number;
  absent: number;
  late: number;
}

export interface TodaySnap {
  students_present: number;
  sections_attendance_submitted: number;
  sections_plans_completed: number;
  total_sections: number;
  date: string;
}

export interface SetupStatus {
  complete: boolean;
  completed_steps: string[];
  pending_steps: string[];
  all_steps: string[];
}

export interface TimeMachine {
  active: boolean;
  mock_date: string | null;
  expires_at: string | null;
  ttl_seconds: number;
}

export interface SafetyAlert {
  id: string;
  actor_name: string;
  actor_role: string;
  query_text: string;
  dismissed_at: string | null;
  created_at: string;
}

export interface SmartAlert {
  type: string;
  severity: 'high' | 'medium';
  title: string;
  detail: string;
  teacher_id?: string;
  section_id?: string;
  section_label?: string;
  class_name?: string;
  unlogged_days?: number;
  attendance_pct?: number;
  coverage_pct?: number;
  avg_pct?: number;
  performance_score?: number;
  subject?: string;
}

export interface TeacherScore {
  id: string;
  teacher_id: string;
  teacher_name: string;
  section_label: string;
  class_name: string;
  compliance_pct: number;
  current_streak: number;
  best_streak: number;
  ai_queries_7d: number;
  performance_score: number;
  band: 'green' | 'amber' | 'red';
  att_days_marked: number;
  homework_days_sent: number;
  notes_sent: number;
  journey_entries: number;
  working_days: number;
  factors?: Record<string, { score: number; weight: number; label: string; detail: string }>;
}

export interface SmartAlertsData {
  alerts: SmartAlert[];
  teacher_scores: TeacherScore[];
  summary: { total_alerts: number; high: number; medium: number };
}

export interface TeacherEngagement {
  id: string;
  name: string;
  mobile: string;
  section_label: string;
  class_name: string;
  days_completed_30d: number;
  last_completion: string | null;
  days_attendance_30d: number;
  homework_sent_30d: number;
  notes_sent_30d: number;
  messages_sent_30d: number;
  streak: number;
  activity_status: 'active' | 'low' | 'inactive';
}

export interface ParentEngagement {
  id: string;
  name: string;
  mobile: string;
  children_count: number;
  children_names: string;
  messages_sent_30d: number;
  notifications_read_30d: number;
  unread_notifications: number;
  last_message_at: string | null;
  activity_status: 'active' | 'inactive' | 'never_logged_in';
}

export interface HwHistory {
  date: string;
  section_label: string;
  class_name: string;
  teacher_name: string;
  completed: number;
  partial: number;
  not_submitted: number;
  total_students: number;
}

export interface EngagementData {
  teachers: { total: number; active: number; low: number; inactive: number; list: TeacherEngagement[] };
  parents: { total: number; active: number; inactive: number; never_logged_in: number; list: ParentEngagement[] };
  homework: { days_sent: number; completed: number; partial: number; not_submitted: number; total: number; history: HwHistory[] };
  messages: { total: number; teacher_sent: number; parent_sent: number; active_threads: number };
}
