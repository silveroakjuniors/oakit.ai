-- Migration 050: Full Franchise Model
-- Implements all requirements from .kiro/specs/franchise-model/requirements.md

-- ── Req 1: franchise_memberships (explicit join table, unique constraint) ─────
-- Note: schools.franchise_id already added in 049. This adds the formal memberships
-- table as required by the spec (Req 1.2) with joined_at tracking.
CREATE TABLE IF NOT EXISTS franchise_memberships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id UUID NOT NULL REFERENCES franchises(id) ON DELETE CASCADE,
  school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(school_id)  -- a school can only belong to one franchise
);

CREATE INDEX IF NOT EXISTS idx_franchise_memberships_franchise ON franchise_memberships(franchise_id);
CREATE INDEX IF NOT EXISTS idx_franchise_memberships_school   ON franchise_memberships(school_id);

-- Backfill from schools.franchise_id (migration 049 used direct FK)
INSERT INTO franchise_memberships (franchise_id, school_id)
  SELECT franchise_id, id FROM schools WHERE franchise_id IS NOT NULL
  ON CONFLICT (school_id) DO NOTHING;

-- ── Req 1: Add created_by_franchise_admin flag to schools (Req 4.5) ───────────
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS created_by_franchise_admin BOOLEAN NOT NULL DEFAULT false;

-- ── Req 3: Franchise-level curriculum (franchise_id on documents + chunks) ────
ALTER TABLE curriculum_documents
  ADD COLUMN IF NOT EXISTS franchise_id UUID REFERENCES franchises(id) ON DELETE CASCADE;

ALTER TABLE curriculum_documents
  ALTER COLUMN school_id DROP NOT NULL;  -- franchise docs have no school_id

ALTER TABLE curriculum_chunks
  ADD COLUMN IF NOT EXISTS franchise_id UUID REFERENCES franchises(id) ON DELETE CASCADE;

ALTER TABLE curriculum_chunks
  ALTER COLUMN school_id DROP NOT NULL;  -- franchise chunks have no school_id

CREATE INDEX IF NOT EXISTS idx_curriculum_docs_franchise   ON curriculum_documents(franchise_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_chunks_franchise ON curriculum_chunks(franchise_id);

-- ── Req 11: Franchise classes (class templates owned by franchise) ────────────
CREATE TABLE IF NOT EXISTS franchise_classes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id UUID NOT NULL REFERENCES franchises(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,              -- e.g. "UKG", "LKG", "Grade 1"
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(franchise_id, name)
);

CREATE INDEX IF NOT EXISTS idx_franchise_classes_franchise ON franchise_classes(franchise_id);

-- Link curriculum_documents to franchise_class
ALTER TABLE curriculum_documents
  ADD COLUMN IF NOT EXISTS franchise_class_id UUID REFERENCES franchise_classes(id) ON DELETE SET NULL;

-- ── Req 9: Consent agreements ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS franchise_consent_agreements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id     UUID NOT NULL REFERENCES franchises(id) ON DELETE CASCADE,
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  agreed_by_user_id UUID REFERENCES users(id),
  agreed_at        TIMESTAMPTZ,
  consent_scope    JSONB NOT NULL DEFAULT '[]',  -- array of permitted data categories
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'active', 'revoked')),
  document_url     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(franchise_id, school_id)
);

CREATE INDEX IF NOT EXISTS idx_consent_franchise ON franchise_consent_agreements(franchise_id);
CREATE INDEX IF NOT EXISTS idx_consent_school    ON franchise_consent_agreements(school_id);

-- ── Req 1: Add contact_email, contact_phone, address to franchises ────────────
-- (spec requires explicit columns, not just JSONB contact)
ALTER TABLE franchises
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS address       TEXT,
  ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'inactive'));

-- ── Req 8: franchise_name on schools list (denormalised for query perf) ────────
-- Not needed — we JOIN franchises table. No schema change required.

-- ── Indexes for PII guard audit log ──────────────────────────────────────────
-- audit_logs already exists (migration 037). No schema change needed.
-- PII guard will INSERT rows with action = 'franchise_pii_blocked'.
