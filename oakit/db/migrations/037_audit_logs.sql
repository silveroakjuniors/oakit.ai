-- Migration 037: Audit logs for uploads and communications

-- Audit log: tracks all significant actions per school
CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    actor_id        UUID,                    -- user_id or parent_user_id who performed the action
    actor_name      TEXT,                    -- denormalised for display
    actor_role      TEXT,                    -- 'teacher', 'parent', 'admin', etc.
    action          TEXT NOT NULL,           -- 'upload_note', 'upload_photo', 'upload_logo', 'upload_resource', 'message_sent', 'file_deleted'
    entity_type     TEXT,                    -- 'note', 'student_photo', 'school_logo', 'resource', 'message'
    entity_id       TEXT,                    -- id of the related record
    metadata        JSONB DEFAULT '{}',      -- extra info: file_name, file_size, student_name, parent_name, etc.
    storage_path    TEXT,                    -- Supabase storage path if applicable
    expires_at      TIMESTAMPTZ,             -- when the file should be cleaned up (null = permanent)
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON audit_logs(school_id, created_at DESC);
CREATE INDEX ON audit_logs(school_id, action);
CREATE INDEX ON audit_logs(expires_at) WHERE expires_at IS NOT NULL;
