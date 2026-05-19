-- Migration 092: Add school_code to schools + platform billing tables
-- school_code = the short code parents/teachers use to log in (e.g. "sojs")
-- Backfill from subdomain for existing schools

-- Add school_type to schools table
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS school_type TEXT NOT NULL DEFAULT 'preschool'
  CHECK (school_type IN ('preschool','primary','elementary','middle','high','k12','college','university','coaching','other'));
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS school_code TEXT;

-- Backfill from subdomain
UPDATE schools SET school_code = subdomain WHERE school_code IS NULL;

-- Make unique and not null after backfill
ALTER TABLE schools
  ALTER COLUMN school_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_school_code ON schools(school_code);

-- 1. Add school_code to schools
-- Tracks per-student charges, setup fees, GST settings
CREATE TABLE IF NOT EXISTS platform_billing_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE UNIQUE,

  -- Per-student monthly charge (in paise, 100 paise = ₹1)
  per_student_paise     INT NOT NULL DEFAULT 0,

  -- One-time setup fee (in paise)
  setup_fee_paise       INT NOT NULL DEFAULT 0,

  -- AI credits included in plan (in paise)
  ai_credits_included_paise BIGINT NOT NULL DEFAULT 200000, -- ₹2,000 default

  -- GST settings
  gst_enabled           BOOLEAN NOT NULL DEFAULT false,
  gst_percentage        NUMERIC(5,2) NOT NULL DEFAULT 18.00,
  school_gstin          TEXT,           -- school's GST number (if applicable)
  platform_gstin        TEXT,           -- platform's GST number

  -- Billing cycle
  billing_cycle         TEXT NOT NULL DEFAULT 'monthly'
                        CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual')),

  -- Notes
  notes                 TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Platform invoices
CREATE TABLE IF NOT EXISTS platform_invoices (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  invoice_number        TEXT NOT NULL UNIQUE,

  -- Period
  period_from           DATE NOT NULL,
  period_to             DATE NOT NULL,

  -- Line items (stored as JSONB array)
  -- Each: { description, quantity, unit_price_paise, amount_paise }
  line_items            JSONB NOT NULL DEFAULT '[]',

  -- Totals (in paise)
  subtotal_paise        BIGINT NOT NULL DEFAULT 0,
  gst_paise             BIGINT NOT NULL DEFAULT 0,
  total_paise           BIGINT NOT NULL DEFAULT 0,

  -- GST details (snapshot at invoice time)
  gst_enabled           BOOLEAN NOT NULL DEFAULT false,
  gst_percentage        NUMERIC(5,2) NOT NULL DEFAULT 0,
  school_gstin          TEXT,
  platform_gstin        TEXT,

  -- Status
  status                TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),

  -- Student count at time of invoice
  student_count         INT NOT NULL DEFAULT 0,

  notes                 TEXT,
  paid_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_invoices_school ON platform_invoices(school_id);
CREATE INDEX IF NOT EXISTS idx_platform_invoices_status ON platform_invoices(status);
CREATE INDEX IF NOT EXISTS idx_platform_invoices_period ON platform_invoices(period_from, period_to);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_platform_billing_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_platform_billing_config_updated_at ON platform_billing_config;
CREATE TRIGGER trg_platform_billing_config_updated_at
  BEFORE UPDATE ON platform_billing_config
  FOR EACH ROW EXECUTE FUNCTION update_platform_billing_updated_at();

DROP TRIGGER IF EXISTS trg_platform_invoices_updated_at ON platform_invoices;
CREATE TRIGGER trg_platform_invoices_updated_at
  BEFORE UPDATE ON platform_invoices
  FOR EACH ROW EXECUTE FUNCTION update_platform_billing_updated_at();
