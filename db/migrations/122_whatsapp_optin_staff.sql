-- Migration 122: WhatsApp opt-in for staff/teachers
-- Adds the same opt-in tracking to the users table (teachers, principal, admin, staff)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_phone      TEXT;  -- may differ from login mobile

CREATE INDEX IF NOT EXISTS idx_users_wa_optin
  ON users(school_id, whatsapp_opt_in)
  WHERE whatsapp_opt_in = true;
