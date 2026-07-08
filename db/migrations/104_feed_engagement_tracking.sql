-- Migration 104: Track feed post engagement (shares, downloads)

CREATE TABLE IF NOT EXISTS feed_engagements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  user_type   TEXT NOT NULL CHECK (user_type IN ('staff', 'parent')),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  action      TEXT NOT NULL CHECK (action IN ('instagram_share', 'facebook_share', 'download')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feed_engagements_post ON feed_engagements(post_id, action);
CREATE INDEX IF NOT EXISTS idx_feed_engagements_user ON feed_engagements(user_id, post_id);
