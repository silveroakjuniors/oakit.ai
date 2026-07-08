-- Push notification subscriptions for Web Push API
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id         UUID,          -- staff user (teacher, principal, admin)
    parent_id       UUID,          -- parent user
    user_role       TEXT NOT NULL,  -- 'teacher', 'principal', 'admin', 'parent'
    endpoint        TEXT NOT NULL,
    p256dh          TEXT NOT NULL,  -- public key
    auth            TEXT NOT NULL,  -- auth secret
    device_info     TEXT,           -- browser/device identifier
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at    TIMESTAMPTZ,
    UNIQUE(endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_sub_user ON push_subscriptions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_push_sub_parent ON push_subscriptions(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_push_sub_school ON push_subscriptions(school_id);
