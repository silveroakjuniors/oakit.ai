-- Migration 060: Enquiries
-- Tracks prospective student enquiries from initial contact through
-- conversion to admission or closure.

-- ── Enquiries ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enquiries (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             UUID          NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_name          TEXT          NOT NULL,
  parent_name           TEXT          NOT NULL,
  contact_number        TEXT          NOT NULL,
  class_of_interest     TEXT          NOT NULL,
  enquiry_date          DATE          NOT NULL DEFAULT CURRENT_DATE,
  status                TEXT          NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'converted', 'closed')),
  converted_student_id  UUID          REFERENCES students(id) ON DELETE SET NULL, -- populated when enquiry is converted to admission
  notes                 TEXT,
  created_by            UUID          REFERENCES users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);
