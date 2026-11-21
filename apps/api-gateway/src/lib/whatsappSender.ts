/**
 * lib/whatsappSender.ts
 * Core WhatsApp Business Cloud API sender.
 * Uses Meta's official Cloud API v20.0.
 *
 * API reference: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Design mirrors socialMediaPublisher.ts:
 *  - Loads encrypted credentials via decryptCredential()
 *  - Returns structured results with error details
 *  - Updates whatsapp_messages status after each send
 */
import axios from 'axios';
import { pool } from './db';
import { decryptCredential } from './credentialEncryption';

const WA_API_VERSION = 'v20.0';
const WA_BASE = `https://graph.facebook.com/${WA_API_VERSION}`;

export interface WaSendResult {
  success: boolean;
  wa_message_id?: string;
  error?: string;
  error_code?: string;
}

// ── Load school's WhatsApp credentials ────────────────────────────────────────
async function loadCredentials(schoolId: string): Promise<{
  access_token: string;
  phone_number_id: string;
} | null> {
  const row = await pool.query(
    `SELECT access_token, phone_number_id FROM whatsapp_configs
     WHERE school_id=$1 AND verified=true AND phone_number_id <> ''`,
    [schoolId],
  );
  if (!row.rows[0]?.access_token) return null;
  return {
    access_token: decryptCredential(row.rows[0].access_token),
    phone_number_id: row.rows[0].phone_number_id,
  };
}

// ── Send a plain text message ─────────────────────────────────────────────────
export async function sendTextMessage(
  schoolId: string,
  toPhone: string,     // E.164 format without +, e.g. "919876543210"
  text: string,
): Promise<WaSendResult> {
  const creds = await loadCredentials(schoolId);
  if (!creds) return { success: false, error: 'WhatsApp credentials not configured or not verified.' };

  try {
    const res = await axios.post(
      `${WA_BASE}/${creds.phone_number_id}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toPhone,
        type: 'text',
        text: { preview_url: false, body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${creds.access_token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      },
    );
    const msgId = res.data?.messages?.[0]?.id;
    return { success: true, wa_message_id: msgId };
  } catch (err: any) {
    const data = err?.response?.data?.error;
    return {
      success: false,
      error: data?.message || err?.message || 'Unknown error',
      error_code: String(data?.code || ''),
    };
  }
}

// ── Send a template message ───────────────────────────────────────────────────
export async function sendTemplateMessage(
  schoolId: string,
  toPhone: string,
  templateName: string,
  languageCode: string,
  components: object[],   // Meta template components array
): Promise<WaSendResult> {
  const creds = await loadCredentials(schoolId);
  if (!creds) return { success: false, error: 'WhatsApp credentials not configured or not verified.' };

  try {
    const res = await axios.post(
      `${WA_BASE}/${creds.phone_number_id}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toPhone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${creds.access_token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      },
    );
    const msgId = res.data?.messages?.[0]?.id;
    return { success: true, wa_message_id: msgId };
  } catch (err: any) {
    const data = err?.response?.data?.error;
    return {
      success: false,
      error: data?.message || err?.message || 'Unknown error',
      error_code: String(data?.code || ''),
    };
  }
}

// ── Send a media message (image / document / video) ───────────────────────────
export async function sendMediaMessage(
  schoolId: string,
  toPhone: string,
  mediaType: 'image' | 'document' | 'video',
  mediaUrl: string,
  caption?: string,
  filename?: string,
): Promise<WaSendResult> {
  const creds = await loadCredentials(schoolId);
  if (!creds) return { success: false, error: 'WhatsApp credentials not configured or not verified.' };

  const mediaPayload: any = { link: mediaUrl };
  if (caption) mediaPayload.caption = caption;
  if (filename && mediaType === 'document') mediaPayload.filename = filename;

  try {
    const res = await axios.post(
      `${WA_BASE}/${creds.phone_number_id}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toPhone,
        type: mediaType,
        [mediaType]: mediaPayload,
      },
      {
        headers: {
          Authorization: `Bearer ${creds.access_token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      },
    );
    const msgId = res.data?.messages?.[0]?.id;
    return { success: true, wa_message_id: msgId };
  } catch (err: any) {
    const data = err?.response?.data?.error;
    return {
      success: false,
      error: data?.message || err?.message || 'Unknown error',
      error_code: String(data?.code || ''),
    };
  }
}

// ── Mark a message as read (sends read receipt) ───────────────────────────────
export async function markMessageRead(
  schoolId: string,
  waMessageId: string,
): Promise<void> {
  const creds = await loadCredentials(schoolId);
  if (!creds) return;
  try {
    await axios.post(
      `${WA_BASE}/${creds.phone_number_id}/messages`,
      {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: waMessageId,
      },
      {
        headers: {
          Authorization: `Bearer ${creds.access_token}`,
          'Content-Type': 'application/json',
        },
        timeout: 8000,
      },
    );
  } catch { /* non-critical */ }
}

// ── Build template components array from variables ────────────────────────────
export function buildTemplateComponents(variables: string[]): object[] {
  if (!variables.length) return [];
  return [{
    type: 'body',
    parameters: variables.map(v => ({ type: 'text', text: v })),
  }];
}

// ── Persist an outbound message record ───────────────────────────────────────
export async function persistOutboundMessage(opts: {
  schoolId: string;
  conversationId: string;
  toPhone: string;
  fromPhone: string;
  messageType: string;
  body?: string;
  templateName?: string;
  templateVars?: object;
  sentByUserId?: string;
  campaignId?: string;
  result: WaSendResult;
}): Promise<string> {
  const row = await pool.query(
    `INSERT INTO whatsapp_messages
       (school_id, conversation_id, wa_message_id, wa_phone_from, wa_phone_to,
        direction, message_type, body, template_name, template_vars,
        status, error_code, error_message, sent_by_user_id, campaign_id)
     VALUES ($1,$2,$3,$4,$5,'outbound',$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING id`,
    [
      opts.schoolId,
      opts.conversationId,
      opts.result.wa_message_id || null,
      opts.fromPhone,
      opts.toPhone,
      opts.messageType,
      opts.body || null,
      opts.templateName || null,
      opts.templateVars ? JSON.stringify(opts.templateVars) : null,
      opts.result.success ? 'sent' : 'failed',
      opts.result.error_code || null,
      opts.result.error || null,
      opts.sentByUserId || null,
      opts.campaignId || null,
    ],
  );
  return row.rows[0].id;
}

// ── Upsert conversation and return its ID ────────────────────────────────────
export async function upsertConversation(
  schoolId: string,
  parentId: string,
  waPhone: string,
): Promise<string> {
  const existing = await pool.query(
    `SELECT id FROM whatsapp_conversations WHERE school_id=$1 AND parent_id=$2`,
    [schoolId, parentId],
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const row = await pool.query(
    `INSERT INTO whatsapp_conversations (school_id, parent_id, wa_phone)
     VALUES ($1,$2,$3) RETURNING id`,
    [schoolId, parentId, waPhone],
  );
  return row.rows[0].id;
}

// ── Normalise phone to E.164 digits (strip +, spaces, dashes) ────────────────
export function normalisePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}
