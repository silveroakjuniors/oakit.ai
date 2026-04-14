CREATE TABLE schools (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    subdomain   TEXT NOT NULL UNIQUE,
    contact     JSONB,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    permissions JSONB NOT NULL DEFAULT '[]',
    UNIQUE(school_id, name)
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    role_id         UUID NOT NULL REFERENCES roles(id),
    name            TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    setup_token     TEXT,
    setup_expires   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON users(school_id);
CREATE INDEX ON users(email);
