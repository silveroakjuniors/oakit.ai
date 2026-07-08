-- Migration 102: Curriculum Resources Lookup Table
-- Maps resource IDs (KL Lesson, KL Activity, Interactive Worksheet numbers) to topics and book pages.
-- Used to enrich plan display with topic names and page references.

CREATE TABLE IF NOT EXISTS curriculum_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,           -- e.g., 'Maths', 'English', 'GK'
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  resource_id TEXT NOT NULL,       -- e.g., '1563', 'w9301', '337'
  resource_type TEXT NOT NULL,     -- 'kl_lesson', 'kl_activity', 'interactive_worksheet'
  topic TEXT NOT NULL,             -- e.g., 'Same and different, grouping'
  book_page TEXT,                  -- e.g., '3-5', '6, 7'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_curriculum_resources_lookup 
  ON curriculum_resources(school_id, resource_id);

CREATE INDEX IF NOT EXISTS idx_curriculum_resources_class 
  ON curriculum_resources(school_id, class_id, subject);

COMMENT ON TABLE curriculum_resources IS 'Lookup table mapping KL Lesson/Activity/Worksheet IDs to topic names and book pages. Used to enrich daily plan display.';
