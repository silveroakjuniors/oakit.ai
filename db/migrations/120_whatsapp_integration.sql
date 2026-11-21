-- Migration 120: WhatsApp Business Integration
-- Follows the same pattern as social_media (migration 114/116).
-- All tables are school-scoped (multi-tenant).

-- ── 1. Enable WhatsApp per school (super admin controls) ──────────────────────
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN NOT NULL DEFAULT false;

-- ── 2. Per-school WhatsApp Business credentials ───────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_configs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  -- Meta credentials (all sensitive values AES-256 encrypted)
  access_token          TEXT,          -- permanent / long-lived token (encrypted)
  phone_number_id       TEXT NOT NULL DEFAULT '', -- Meta phone number ID
  waba_id               TEXT NOT NULL DEFAULT '', -- WhatsApp Business Account ID
  business_phone        TEXT,          -- E.164 format e.g. +919876543210
  display_name          TEXT,          -- Business display name in WhatsApp

  -- Meta App credentials (for webhook verification + token refresh)
  meta_app_id           TEXT,
  meta_app_secret       TEXT,          -- encrypted
  webhook_verify_token  TEXT,          -- random string set by admin (not secret, just for verification)

  -- Status
  verified              BOOLEAN NOT NULL DEFAULT false,
  connected_at          TIMESTAMPTZ,
  token_expires_at      TIMESTAMPTZ,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (school_id)
);

-- ── 3. WhatsApp conversation threads (one per parent + school) ────────────────
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  parent_id         UUID NOT NULL REFERENCES parent_users(id) ON DELETE CASCADE,
  wa_phone          TEXT NOT NULL,     -- parent's WhatsApp phone number (E.164)

  -- Last message summary (denormalised for inbox listing)
  last_message_text TEXT,
  last_message_at   TIMESTAMPTZ,
  last_sender       TEXT CHECK (last_sender IN ('school', 'parent')),

  -- Conversation state
  status            TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'resolved', 'waiting')),
  assigned_to       UUID REFERENCES users(id),  -- teacher or admin assigned
  unread_count      INT NOT NULL DEFAULT 0,

  -- Meta 24-hour session window
  session_expires_at TIMESTAMPTZ,     -- 24h after last INBOUND message

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (school_id, parent_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_conv_school_status ON whatsapp_conversations(school_id, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_conv_parent        ON whatsapp_conversations(parent_id);

-- ── 4. Individual WhatsApp messages ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  conversation_id   UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,

  -- Meta IDs
  wa_message_id     TEXT UNIQUE,       -- returned by Meta after send, or from webhook
  wa_phone_from     TEXT NOT NULL,
  wa_phone_to       TEXT NOT NULL,

  direction         TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  message_type      TEXT NOT NULL CHECK (message_type IN ('text', 'template', 'image', 'document', 'video', 'audio', 'sticker', 'reaction', 'unsupported')),

  -- Content
  body              TEXT,              -- text content
  media_url         TEXT,              -- for media messages
  media_mime_type   TEXT,
  media_filename    TEXT,
  template_name     TEXT,              -- for template messages
  template_vars     JSONB,             -- dynamic variables used

  -- Status tracking
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'received')),
  error_code        TEXT,
  error_message     TEXT,

  -- Attribution
  sent_by_user_id   UUID REFERENCES users(id),  -- NULL for automated/campaign
  campaign_id       UUID,               -- filled in if part of a campaign

  -- Internal use only (not sent to parent)
  is_internal_note  BOOLEAN NOT NULL DEFAULT false,

  sent_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at      TIMESTAMPTZ,
  read_at           TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_msg_conversation ON whatsapp_messages(conversation_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_msg_wa_id        ON whatsapp_messages(wa_message_id) WHERE wa_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wa_msg_school_time  ON whatsapp_messages(school_id, sent_at DESC);

-- ── 5. Approved WhatsApp message templates ───────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  name             TEXT NOT NULL,       -- Meta template name (lowercase_underscore)
  display_name     TEXT NOT NULL,       -- human-readable name in Oakit UI
  category         TEXT NOT NULL CHECK (category IN ('UTILITY', 'MARKETING', 'AUTHENTICATION')),
  language         TEXT NOT NULL DEFAULT 'en',
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected')),

  -- Template body with variable placeholders {{1}}, {{2}}, etc.
  body_text        TEXT NOT NULL,
  header_text      TEXT,
  footer_text      TEXT,
  button_config    JSONB,               -- CTA buttons

  -- Variable labels for UI (array of label strings matching {{1}}, {{2}})
  variable_labels  TEXT[] NOT NULL DEFAULT '{}',

  meta_template_id TEXT,               -- returned by Meta after submission
  submitted_at     TIMESTAMPTZ,
  approved_at      TIMESTAMPTZ,

  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (school_id, name)
);

CREATE INDEX IF NOT EXISTS idx_wa_templates_school ON whatsapp_templates(school_id, status);

-- ── 6. Bulk communication campaigns ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  name             TEXT NOT NULL,
  description      TEXT,
  template_id      UUID REFERENCES whatsapp_templates(id),

  -- Targeting
  target_type      TEXT NOT NULL CHECK (target_type IN ('all', 'class', 'section', 'custom')),
  target_class_ids UUID[],
  target_section_ids UUID[],
  target_parent_ids  UUID[],           -- for custom targeting

  -- Content
  message_body     TEXT,               -- for free-form messages (within session)
  template_vars    JSONB,              -- default variables for the template
  media_url        TEXT,
  media_type       TEXT,

  -- Scheduling
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'scheduled', 'running', 'completed', 'cancelled', 'failed')),
  scheduled_at     TIMESTAMPTZ,
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,

  -- Stats (denormalised)
  total_recipients INT NOT NULL DEFAULT 0,
  sent_count       INT NOT NULL DEFAULT 0,
  delivered_count  INT NOT NULL DEFAULT 0,
  read_count       INT NOT NULL DEFAULT 0,
  failed_count     INT NOT NULL DEFAULT 0,

  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_campaigns_school ON whatsapp_campaigns(school_id, status, created_at DESC);

-- Per-recipient campaign message tracking
CREATE TABLE IF NOT EXISTS whatsapp_campaign_recipients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES whatsapp_campaigns(id) ON DELETE CASCADE,
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  parent_id     UUID NOT NULL REFERENCES parent_users(id),
  wa_phone      TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'skipped')),
  message_id    UUID REFERENCES whatsapp_messages(id),
  error_message TEXT,
  sent_at       TIMESTAMPTZ,

  UNIQUE (campaign_id, parent_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_campaign_recv ON whatsapp_campaign_recipients(campaign_id, status);

-- ── 7. Automation triggers ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_automations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  name             TEXT NOT NULL,
  trigger_type     TEXT NOT NULL CHECK (trigger_type IN (
    'student_admitted', 'fee_paid', 'fee_overdue', 'student_birthday',
    'attendance_absent', 'attendance_late', 'holiday_announced',
    'event_reminder', 'ptm_reminder', 'school_closure', 'custom'
  )),
  template_id      UUID REFERENCES whatsapp_templates(id),

  -- Configuration
  is_active        BOOLEAN NOT NULL DEFAULT true,
  delay_minutes    INT NOT NULL DEFAULT 0,   -- delay after trigger
  variables_map    JSONB,                     -- maps trigger data fields → template vars

  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (school_id, trigger_type)
);

-- ── 8. WhatsApp opt-in tracking on parent_users ──────────────────────────────
ALTER TABLE parent_users
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_phone             TEXT;    -- may differ from login mobile

CREATE INDEX IF NOT EXISTS idx_parent_wa_optin ON parent_users(school_id, whatsapp_opt_in) WHERE whatsapp_opt_in = true;
