-- Migration 121: WhatsApp webhook event audit log + media column additions
-- Adds the idempotency/audit table required for safe webhook processing.

-- ── 1. Webhook events audit table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           TEXT NOT NULL,         -- Meta's unique event ID (for idempotency)
  phone_number_id    TEXT NOT NULL,          -- resolved from payload metadata
  school_id          UUID REFERENCES schools(id) ON DELETE SET NULL,
  event_type         TEXT NOT NULL,          -- 'message' | 'status_update' | 'other'
  processing_status  TEXT NOT NULL DEFAULT 'received'
                     CHECK (processing_status IN ('received','processing','processed','failed','skipped')),
  error_message      TEXT,
  received_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at       TIMESTAMPTZ,

  UNIQUE (event_id)  -- prevents duplicate processing of the same Meta event
);

CREATE INDEX IF NOT EXISTS idx_wa_webhook_events_school   ON whatsapp_webhook_events(school_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_webhook_events_status   ON whatsapp_webhook_events(processing_status) WHERE processing_status != 'processed';
CREATE INDEX IF NOT EXISTS idx_wa_webhook_events_phone_id ON whatsapp_webhook_events(phone_number_id, received_at DESC);

-- ── 2. Add media columns to whatsapp_messages ────────────────────────────────
ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS media_id          TEXT,     -- Meta media object ID
  ADD COLUMN IF NOT EXISTS media_drive_path  TEXT,     -- google_drive:FILE_ID after download
  ADD COLUMN IF NOT EXISTS media_drive_url   TEXT,     -- proxy URL for display
  ADD COLUMN IF NOT EXISTS media_size_bytes  BIGINT;

-- ── 3. Add last_webhook_at to whatsapp_configs for dashboard ─────────────────
ALTER TABLE whatsapp_configs
  ADD COLUMN IF NOT EXISTS last_webhook_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_received    BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_sent        BIGINT NOT NULL DEFAULT 0;
