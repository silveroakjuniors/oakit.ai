CREATE TABLE school_calendar (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year   TEXT NOT NULL,
    working_days    INT[] NOT NULL,
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    holidays        DATE[] NOT NULL DEFAULT '{}',
    UNIQUE(school_id, academic_year)
);

CREATE INDEX ON school_calendar(school_id);
