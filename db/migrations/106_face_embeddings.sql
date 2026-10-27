-- Migration 106: Face embeddings for attendance recognition
-- Stores 512-dim face vectors per student (insightface ArcFace model)

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS face_embeddings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  embedding    vector(512) NOT NULL,
  photo_url    TEXT,
  enrolled_by  UUID REFERENCES users(id),
  enrolled_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active    BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (student_id, school_id)
);

CREATE INDEX IF NOT EXISTS idx_face_embeddings_school ON face_embeddings(school_id);
CREATE INDEX IF NOT EXISTS idx_face_embeddings_student ON face_embeddings(student_id);

-- Track face attendance sessions
CREATE TABLE IF NOT EXISTS face_attendance_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  section_id   UUID NOT NULL REFERENCES sections(id),
  teacher_id   UUID NOT NULL REFERENCES users(id),
  attend_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  photo_url    TEXT,
  matched      JSONB NOT NULL DEFAULT '[]', -- [{student_id, name, confidence}]
  unmatched    INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_face_att_logs_section ON face_attendance_logs(section_id, attend_date);
