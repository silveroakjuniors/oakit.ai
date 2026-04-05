CREATE TABLE day_plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    section_id      UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    teacher_id      UUID NOT NULL REFERENCES users(id),
    plan_date       DATE NOT NULL,
    chunk_ids       UUID[] NOT NULL,
    status          TEXT NOT NULL DEFAULT 'scheduled',
    UNIQUE(section_id, plan_date)
);

CREATE TABLE coverage_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    section_id      UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    teacher_id      UUID NOT NULL REFERENCES users(id),
    log_date        DATE NOT NULL,
    log_text        TEXT NOT NULL,
    submitted_at    TIMESTAMPTZ DEFAULT now(),
    edited_at       TIMESTAMPTZ,
    flagged         BOOLEAN DEFAULT false,
    UNIQUE(section_id, log_date)
);

CREATE TABLE coverage_statuses (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coverage_log_id     UUID NOT NULL REFERENCES coverage_logs(id) ON DELETE CASCADE,
    chunk_id            UUID NOT NULL REFERENCES curriculum_chunks(id),
    status              TEXT NOT NULL,
    similarity_score    FLOAT,
    UNIQUE(coverage_log_id, chunk_id)
);

CREATE INDEX ON day_plans(teacher_id, plan_date);
CREATE INDEX ON day_plans(section_id);
CREATE INDEX ON coverage_logs(teacher_id, log_date);
CREATE INDEX ON coverage_logs(section_id);
CREATE INDEX ON coverage_statuses(coverage_log_id);
