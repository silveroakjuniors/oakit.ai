-- Migration 011: Parent users, daily completion, missed topic tasks

CREATE TABLE IF NOT EXISTS parent_users (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id            UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  mobile               TEXT NOT NULL,
  name                 TEXT,
  password_hash        TEXT,
  force_password_reset BOOLEAN NOT NULL DEFAULT true,
  security_question_id UUID REFERENCES security_questions(id),
  security_answer_hash TEXT,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE (school_id, mobile)
);

CREATE TABLE IF NOT EXISTS parent_student_links (
  parent_id  UUID NOT NULL REFERENCES parent_users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  PRIMARY KEY (parent_id, student_id)
);

CREATE TABLE IF NOT EXISTS daily_completions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  section_id       UUID NOT NULL REFERENCES sections(id),
  teacher_id       UUID NOT NULL REFERENCES users(id),
  completion_date  DATE NOT NULL,
  covered_chunk_ids UUID[] NOT NULL DEFAULT '{}',
  submitted_at     TIMESTAMPTZ DEFAULT now(),
  edited_at        TIMESTAMPTZ,
  UNIQUE (section_id, completion_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_completions_section_date
  ON daily_completions(section_id, completion_date);

CREATE TABLE IF NOT EXISTS missed_topic_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id    UUID NOT NULL REFERENCES parent_users(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES students(id),
  chunk_id     UUID NOT NULL REFERENCES curriculum_chunks(id),
  absence_date DATE NOT NULL,
  is_done      BOOLEAN NOT NULL DEFAULT false,
  done_at      TIMESTAMPTZ,
  UNIQUE (parent_id, student_id, chunk_id, absence_date)
);

CREATE INDEX IF NOT EXISTS idx_missed_tasks_parent ON missed_topic_tasks(parent_id, is_done);
