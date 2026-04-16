-- Migration 030: parent_emergency_contacts
CREATE TABLE IF NOT EXISTS parent_emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES parent_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT,
  phone VARCHAR(32) NOT NULL,
  phone_type TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_emergency_contacts_primary
  ON parent_emergency_contacts(parent_id) WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_parent_emergency_contacts_parent
  ON parent_emergency_contacts(parent_id);

-- Optionally: update `updated_at` on row modification (if desired, DB trigger can be added later).
