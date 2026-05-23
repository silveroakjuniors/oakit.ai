-- Migration 071: HR Offer Letter Management
-- New tables: offer_letter_templates, employment_records, hr_settings
-- Schema additions to staff_offer_letters

-- ─── offer_letter_templates ───────────────────────────────────────────────────

CREATE TABLE offer_letter_templates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  created_by  UUID        REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_olt_school ON offer_letter_templates(school_id);

-- ─── employment_records ───────────────────────────────────────────────────────

CREATE TABLE employment_records (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type      TEXT        NOT NULL CHECK (event_type IN (
                                'offer_sent', 'offer_signed', 'resignation', 'termination'
                              )),
  event_date      DATE        NOT NULL DEFAULT CURRENT_DATE,
  offer_letter_id UUID        REFERENCES staff_offer_letters(id),
  -- Resignation fields
  last_working_day      DATE,
  notice_period_days    INT,
  default_notice_period INT,
  resignation_reason    TEXT,
  resignation_status    TEXT CHECK (resignation_status IN ('pending', 'acknowledged')),
  -- Termination fields
  termination_reason    TEXT,
  terminated_by         UUID REFERENCES users(id),
  -- Generic
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_er_school ON employment_records(school_id);
CREATE INDEX idx_er_user   ON employment_records(user_id);
CREATE INDEX idx_er_type   ON employment_records(event_type);

-- ─── hr_settings ──────────────────────────────────────────────────────────────

CREATE TABLE hr_settings (
  school_id             UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  default_notice_period INT  NOT NULL DEFAULT 30,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── staff_offer_letters additions ───────────────────────────────────────────

ALTER TABLE staff_offer_letters
  ADD COLUMN IF NOT EXISTS template_id      UUID REFERENCES offer_letter_templates(id),
  ADD COLUMN IF NOT EXISTS signature_type   TEXT CHECK (signature_type IN ('typed', 'drawn')),
  ADD COLUMN IF NOT EXISTS signature_value  TEXT,
  ADD COLUMN IF NOT EXISTS signed_pdf_url   TEXT,
  ADD COLUMN IF NOT EXISTS preview_pdf_url  TEXT;

-- ─── Seed hr_settings for all existing schools ───────────────────────────────

INSERT INTO hr_settings (school_id)
SELECT id FROM schools
ON CONFLICT DO NOTHING;
