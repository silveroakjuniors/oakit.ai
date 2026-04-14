/**
 * Student Module - Centralized Type Definitions
 * All types are strongly typed with no 'any' usage
 */

// ─── Auth & Profile ─────────────────────────────────────────────────────
export interface StudentProfile {
  name: string;
  section_label: string;
  class_name: string;
}

// ─── Topics & Curriculum ────────────────────────────────────────────────
export interface TopicCard {
  chunk_id: string;
  topic_name: string;
  subject: string;
  notes: string | null;
  covered_date: string;
}

export interface FeedDay {
  date: string;
  topics: TopicCard[];
  homework: { formatted_text: string; raw_text: string } | null;
}

// ─── Homework ───────────────────────────────────────────────────────────
export type HomeworkStatus = 'completed' | 'partial' | 'not_submitted';

export interface HomeworkRecord {
  homework_date: string;
  homework_text: string | null;
  status: HomeworkStatus;
  teacher_note: string | null;
}

export interface HomeworkStatusConfig {
  label: string;
  color: string;
  icon: string;
}

// ─── Chat / Ask Oakie ───────────────────────────────────────────────────
export type ChatMessageRole = 'user' | 'ai';

export interface ChatMessage {
  role: ChatMessageRole;
  text: string;
  ts: number;
}

export interface ChatResponse {
  response: string;
}

// ─── Quiz ───────────────────────────────────────────────────────────────
export type QuizQuestionType = 'fill_blank' | 'descriptive' | '1_mark' | '2_mark';
export type QuizStep = 'idle' | 'subject' | 'daterange' | 'topics' | 'qtypes' | 'taking' | 'results';
export type QuizTestStatus = 'pending' | 'active' | 'completed';

export interface QuizTopic {
  chunk_id: string;
  topic_name: string;
  subject: string;
  covered_date: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  q_type: QuizQuestionType;
  marks: number;
}

export interface QuizResult {
  question_id: string;
  question: string;
  q_type: QuizQuestionType;
  marks: number;
  is_correct: boolean;
  marks_awarded: number;
  ai_feedback: string;
  student_answer: string;
  correct_answer: string;
}

export interface QuizGenerateRequest {
  chunk_ids: string[];
  q_types: QuizQuestionType[];
}

export interface QuizGenerateResponse {
  quiz_id: string;
  questions: QuizQuestion[];
}

export interface QuizSubmitRequest {
  answers: Array<{
    question_id: string;
    answer: string;
  }>;
}

export interface QuizSubmitResponse {
  results: QuizResult[];
}

export interface AssignedTest {
  quiz_id: string;
  subject: string;
  time_limit_minutes: number;
  due_date: string;
  status: QuizTestStatus;
  created_at: string;
}

export interface QuizSummary {
  quiz_id: string;
  subject: string;
  total_marks: number;
  scored_marks: number;
  created_at: string;
  q_count: number;
}

// ─── Progress ───────────────────────────────────────────────────────────
export interface SubjectBreakdown {
  subject: string;
  avg_pct: number;
  quiz_count: number;
}

export interface WeakArea {
  subject: string;
  chapter: string;
  avg_pct: number;
}

export interface ProgressStats {
  total_quizzes: number;
  average_score_pct: number;
  subject_breakdown: SubjectBreakdown[];
  weak_areas: WeakArea[];
  recent_quizzes: QuizSummary[];
}

// ─── State & UI ─────────────────────────────────────────────────────────

export type Tab = 'today' | 'homework' | 'ask' | 'quiz' | 'progress';

export interface TabConfig {
  id: Tab;
  Icon: React.ElementType;
  label: string;
}

export interface QuestionTypeConfig {
  id: QuizQuestionType;
  label: string;
}

export interface QuizState {
  step: QuizStep;
  subject: string;
  from: string;
  to: string;
  topics: QuizTopic[];
  selectedTopics: string[];
  selectedQTypes: QuizQuestionType[];
  questions: QuizQuestion[];
  answers: Record<string, string>;
  results: QuizResult[];
  quizId: string;
  error: string;
  activeTestId: string | null;
  testTimer: number;
}

// ─── API Request/Response ───────────────────────────────────────────────

export interface ApiErrorResponse {
  message: string;
}
