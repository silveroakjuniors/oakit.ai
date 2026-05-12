-- Migration 090: Uniform sizing requests
-- Public form where parents submit child measurements for uniform size recommendation

CREATE TABLE IF NOT EXISTS uniform_sizing_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID REFERENCES schools(id) ON DELETE CASCADE,
  school_code       TEXT NOT NULL,

  -- Child details
  child_name        TEXT NOT NULL,
  class_name        TEXT NOT NULL,

  -- Parent contact
  parent_name       TEXT NOT NULL,
  contact_number    TEXT NOT NULL,

  -- Measurements (in cm / kg)
  height_cm         NUMERIC(5,1),
  weight_kg         NUMERIC(5,1),
  chest_cm          NUMERIC(5,1),
  shirt_length_cm   NUMERIC(5,1),
  pant_length_cm    NUMERIC(5,1),

  -- Recommended sizes (Indian standard: 20 22 24 26 28 30 32)
  recommended_shirt_size  TEXT,
  recommended_pant_size   TEXT,

  -- Status
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'dispatched', 'delivered')),
  admin_notes       TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uniform_sizing_school ON uniform_sizing_requests(school_id);
CREATE INDEX IF NOT EXISTS idx_uniform_sizing_contact ON uniform_sizing_requests(contact_number);
CREATE INDEX IF NOT EXISTS idx_uniform_sizing_status ON uniform_sizing_requests(status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_uniform_sizing_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_uniform_sizing_updated_at ON uniform_sizing_requests;
CREATE TRIGGER trg_uniform_sizing_updated_at
  BEFORE UPDATE ON uniform_sizing_requests
  FOR EACH ROW EXECUTE FUNCTION update_uniform_sizing_updated_at();
