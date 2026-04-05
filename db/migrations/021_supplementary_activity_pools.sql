-- Migration 021: Supplementary Activity Pools
-- Supports rhymes, stories, public speaking, sports etc. scheduled alongside core curriculum

CREATE TABLE IF NOT EXISTS activity_pools (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  language    TEXT NOT NULL DEFAULT 'English',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

CREATE INDEX IF NOT EXISTS idx_activity_pools_school ON activity_pools(school_id);

CREATE TABLE IF NOT EXISTS activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_pool_id UUID NOT NULL REFERENCES activity_pools(id) ON DELETE CASCADE,
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  position        INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (activity_pool_id, title)
);

CREATE INDEX IF NOT EXISTS idx_activities_pool ON activities(activity_pool_id);

CREATE TABLE IF NOT EXISTS pool_assignments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  activity_pool_id UUID NOT NULL REFERENCES activity_pools(id) ON DELETE CASCADE,
  class_id         UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  frequency_mode   TEXT NOT NULL CHECK (frequency_mode IN ('weekly', 'interval')),
  interval_days    INT CHECK (interval_days >= 1 AND interval_days <= 30),
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  carry_forward_on_miss BOOLEAN NOT NULL DEFAULT false,
  is_deleted       BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (activity_pool_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_pool_assignments_school ON pool_assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_pool_assignments_class ON pool_assignments(class_id);

CREATE TABLE IF NOT EXISTS supplementary_plans (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id          UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  section_id         UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  pool_assignment_id UUID NOT NULL REFERENCES pool_assignments(id) ON DELETE CASCADE,
  activity_id        UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  plan_date          DATE NOT NULL,
  status             TEXT NOT NULL DEFAULT 'scheduled'
                       CHECK (status IN ('scheduled', 'completed', 'skipped', 'replaced')),
  override_note      TEXT,
  original_date      DATE,  -- set when carried forward
  completed_at       TIMESTAMPTZ,
  completed_by       UUID REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (section_id, pool_assignment_id, plan_date)
);

CREATE INDEX IF NOT EXISTS idx_supplementary_plans_section_date
  ON supplementary_plans(section_id, plan_date);

-- Rotation cursor: tracks next activity index per section per pool_assignment
CREATE TABLE IF NOT EXISTS supplementary_rotation_cursors (
  section_id         UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  pool_assignment_id UUID NOT NULL REFERENCES pool_assignments(id) ON DELETE CASCADE,
  next_position      INT NOT NULL DEFAULT 0,
  PRIMARY KEY (section_id, pool_assignment_id)
);
