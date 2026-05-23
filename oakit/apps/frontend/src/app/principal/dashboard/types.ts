// ── Principal Dashboard — shared types ────────────────────────────────────────

export interface SectionSummary {
  section_id: string;
  section_label: string;
  class_name: string;
  class_teacher_name: string | null;
  total_students: number;
  present_today: number;
  absent_today: number;
  attendance_submitted: boolean;
  plan_completed: boolean;
  homework_sent: boolean;
  coverage_pct: number | null;
  coverage_total: number;
  coverage_covered: number;
}

export interface TeacherStreak {
  teacher_id: string;
  teacher_name: string;
  current_streak: number;
  best_streak: number;
}

export interface EngagementTeacher {
  id: string;
  name: string;
  role_name: string;
  current_streak: number;
  best_streak: number;
  last_completed_date: string | null;
  completions_30d: number;
  completion_rate_30d: number;
  days_since_last: number;
  amber_warning: boolean;
}

export interface BirthdayKid {
  id: string;
  name: string;
  class_name: string;
  section_label: string;
  days_until: number;
}

export interface PrincipalContext {
  principal_name: string;
  greeting: string;
  thought_for_day: string;
  today: string;
  sections: SectionSummary[];
  teacher_streaks: TeacherStreak[];
  summary: {
    total_students: number;
    total_present: number;
    total_absent: number;
    attendance_submitted: number;
    plans_completed: number;
    homework_sent: number;
    total_sections: number;
  };
}

export interface PendingApprovals {
  concessions: number;
  overrides: number;
  cancellations: number;
}

export interface Message {
  role: 'user' | 'assistant';
  text: string;
}
