-- Migration 040: Student Portal

-- Per-class toggle for student portal access
CREATE TABLE IF NOT EXISTS student_portal_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  enabled     BOOLEAN NOT NULL DEFAULT false,
  enabled_at  TIMESTAMPTZ,
  updated_by  UUID REFERENCES users(id),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (school_id, class_id)
);

-- Student login credentials (separate from staff users table)
CREATE TABLE IF NOT EXISTS student_accounts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id            UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id           UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  username             TEXT NOT NULL,
  password_hash        TEXT NOT NULL,
  force_password_reset BOOLEAN NOT NULL DEFAULT true,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_by           UUID REFERENCES users(id),
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id),
  UNIQUE (school_id, username)
);

CREATE INDEX IF NOT EXISTS idx_student_accounts_lookup ON student_accounts(school_id, username);

-- Quizzes (self-initiated or teacher-assigned)
CREATE TABLE IF NOT EXISTS quizzes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  section_id      UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  created_by_role TEXT NOT NULL CHECK (created_by_role IN ('student', 'teacher')),
  created_by_id   UUID NOT NULL,
  subject         TEXT NOT NULL,
  date_from       DATE NOT NULL,
  date_to         DATE NOT NULL,
  topic_ids       UUID[] NOT NULL DEFAULT '{}',
  question_types  TEXT[] NOT NULL DEFAULT '{}',
  time_limit_mins INT,
  is_assigned     BOOLEAN NOT NULL DEFAULT false,
  due_date        DATE,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','closed')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quizzes_section ON quizzes(section_id, status);

-- Questions generated for a quiz
CREATE TABLE IF NOT EXISTS quiz_questions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id      UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  chunk_id     UUID REFERENCES curriculum_chunks(id),
  subject      TEXT,
  question     TEXT NOT NULL,
  q_type       TEXT NOT NULL CHECK (q_type IN ('fill_blank','descriptive','1_mark','2_mark')),
  marks        INT NOT NULL DEFAULT 1,
  answer_key   TEXT NOT NULL,
  explanation  TEXT,
  position     INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions(quiz_id);

-- One attempt per student per quiz
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id         UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  started_at      TIMESTAMPTZ DEFAULT now(),
  submitted_at    TIMESTAMPTZ,
  total_marks     INT NOT NULL DEFAULT 0,
  scored_marks    INT NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted','timed_out')),
  UNIQUE (quiz_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student ON quiz_attempts(student_id, school_id);

-- Per-question answers for an attempt
CREATE TABLE IF NOT EXISTS quiz_answers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id      UUID NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id     UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  student_answer  TEXT,
  is_correct      BOOLEAN,
  marks_awarded   INT NOT NULL DEFAULT 0,
  ai_feedback     TEXT
);

CREATE INDEX IF NOT EXISTS idx_quiz_answers_attempt ON quiz_answers(attempt_id);
