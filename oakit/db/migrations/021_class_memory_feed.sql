-- Class Memory Feed: Instagram-like photo sharing for sections and school-wide

CREATE TABLE IF NOT EXISTS feed_posts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  section_id   UUID REFERENCES sections(id) ON DELETE CASCADE,
  class_id     UUID REFERENCES classes(id) ON DELETE SET NULL,
  posted_by    UUID NOT NULL,
  poster_name  TEXT NOT NULL DEFAULT '',
  poster_role  TEXT NOT NULL CHECK (poster_role IN ('teacher', 'admin', 'principal')),
  post_scope   TEXT NOT NULL CHECK (post_scope IN ('section', 'school')),
  caption      TEXT CHECK (char_length(caption) <= 500),
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feed_posts_school_scope ON feed_posts (school_id, post_scope, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_posts_section ON feed_posts (section_id, created_at DESC) WHERE section_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feed_posts_expires ON feed_posts (expires_at);

CREATE TABLE IF NOT EXISTS feed_post_images (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,
  cdn_url       TEXT NOT NULL,
  display_order SMALLINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_feed_post_images_post ON feed_post_images (post_id, display_order);

CREATE TABLE IF NOT EXISTS feed_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL,
  user_type  TEXT NOT NULL CHECK (user_type IN ('staff', 'parent')),
  school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, user_type)
);

CREATE INDEX IF NOT EXISTS idx_feed_likes_post ON feed_likes (post_id);

CREATE TABLE IF NOT EXISTS feed_settings (
  school_id           UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  section_daily_limit INT NOT NULL DEFAULT 5  CHECK (section_daily_limit BETWEEN 1 AND 20),
  school_daily_limit  INT NOT NULL DEFAULT 10 CHECK (school_daily_limit BETWEEN 1 AND 100),
  retention_days      INT NOT NULL DEFAULT 20 CHECK (retention_days BETWEEN 1 AND 90)
);
