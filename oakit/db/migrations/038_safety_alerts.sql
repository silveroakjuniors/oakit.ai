-- Migration 038: Safety alerts for inappropriate AI queries

CREATE TABLE IF NOT EXISTS safety_alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    actor_id        UUID NOT NULL,
    actor_name      TEXT NOT NULL,
    actor_role      TEXT NOT NULL,
    query_text      TEXT NOT NULL,
    audit_log_id    UUID REFERENCES audit_logs(id) ON DELETE SET NULL,
    dismissed_by    UUID,                    -- admin/principal who dismissed
    dismissed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON safety_alerts(school_id, dismissed_at) WHERE dismissed_at IS NULL;
CREATE INDEX ON safety_alerts(school_id, created_at DESC);
