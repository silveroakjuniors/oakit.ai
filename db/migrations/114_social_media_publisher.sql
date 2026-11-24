-- Migration 114: Social Media Publisher Module

-- Enable social media module per school (super admin controls)
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS social_media_enabled BOOLEAN NOT NULL DEFAULT false;

-- Per-school platform configuration + encrypted credentials
CREATE TABLE IF NOT EXISTS social_media_configs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  platform         TEXT NOT NULL CHECK (platform IN ('instagram','facebook','youtube','twitter','linkedin')),
  enabled          BOOLEAN NOT NULL DEFAULT false,
  access_token     TEXT,          -- AES-256 encrypted
  refresh_token    TEXT,          -- AES-256 encrypted (where applicable)
  token_expires_at TIMESTAMPTZ,
  page_id          TEXT,          -- FB page ID / YT channel ID / LI org ID
  account_id       TEXT,          -- IG business account ID
  handle           TEXT,          -- display handle e.g. @silveroakjuniors
  extra_config     JSONB,         -- platform-specific extras
  connected_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (school_id, platform)
);

-- Posts submitted by teachers
CREATE TABLE IF NOT EXISTS social_media_posts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id       UUID NOT NULL REFERENCES users(id),
  media_type       TEXT NOT NULL CHECK (media_type IN ('video','image_carousel')),
  media_paths      TEXT[] NOT NULL DEFAULT '{}',  -- Supabase storage paths
  raw_caption      TEXT NOT NULL,
  ai_caption       TEXT,
  final_caption    TEXT,          -- caption actually sent to platforms
  hashtags         TEXT[],
  status           TEXT NOT NULL DEFAULT 'pending_approval'
                   CHECK (status IN ('pending_approval','approved','rejected','published','partially_published','failed')),
  rejection_reason TEXT,
  approved_by      UUID REFERENCES users(id),
  approved_at      TIMESTAMPTZ,
  published_at     TIMESTAMPTZ,
  media_deleted    BOOLEAN NOT NULL DEFAULT false,
  submitted_at     TIMESTAMPTZ DEFAULT now(),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Per-platform publish outcome for each post
CREATE TABLE IF NOT EXISTS social_media_post_platforms (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id          UUID NOT NULL REFERENCES social_media_posts(id) ON DELETE CASCADE,
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  platform         TEXT NOT NULL CHECK (platform IN ('instagram','facebook','youtube','twitter','linkedin')),
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','posted','failed','skipped')),
  platform_post_id TEXT,          -- ID returned by platform after posting
  error_message    TEXT,
  attempted_at     TIMESTAMPTZ,
  posted_at        TIMESTAMPTZ,
  UNIQUE (post_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_sm_posts_school_status  ON social_media_posts(school_id, status);
CREATE INDEX IF NOT EXISTS idx_sm_posts_teacher        ON social_media_posts(teacher_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_sm_post_platforms_post  ON social_media_post_platforms(post_id);
CREATE INDEX IF NOT EXISTS idx_sm_configs_school       ON social_media_configs(school_id);
