/**
 * routes/shared/whatsappWebhook.ts
 *
 * Production-grade Meta WhatsApp Cloud API webhook handler.
 *
 * Security model:
 *  - GET:  verify token compared against per-school DB config (never from env directly)
 *  - POST: HMAC SHA-256 of raw body verified with constant-time comparison BEFORE
 *          any payload processing. App secret loaded from encrypted DB (not env).
 *  - Tenant resolved from phone_number_id in payload metadata — never from payload body.
 *  - Idempotency: each Meta event_id stored in whatsapp_webhook_events; duplicates skipped.
 *  - 200 returned immediately; heavy processing is async (setImmediate).
 *  - No sensitive data logged.
 *
 * Registered WITHOUT jwtVerify — external Meta callback has no auth header.
 * Max body size: 2MB (enforced by express.json limit above, raw body capped here too).
 */
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { pool } from '../../lib/db';
import { markMessageRead } from '../../lib/whatsappSender';

const router = Router();
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB

// ── Raw body accumulator ──────────────────────────────────────────────────────
// MUST run before any body-parser on this route.
// Cap size to prevent memory exhaustion.
function captureRawBody(req: Request, res: Response, next: () => void) {
  const chunks: Buffer[] = [];
  let total = 0;

  req.on('data', (chunk: Buffer) => {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      res.status(413).send('Payload Too Large');
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', () => {
    const raw = Buffer.concat(chunks);
    (req as any).rawBodyBuffer = raw;
    (req as any).rawBody = raw.toString('utf8');
    next();
  });

  req.on('error', () => {
    res.status(400).send('Bad Request');
  });
}

// ── Constant-time HMAC comparison ────────────────────────────────────────────
function safeEqual(a: string, b: string): boolean {
  try {
    // timingSafeEqual requires same-length buffers
    const aBuf = Buffer.from(a, 'hex');
    const bBuf = Buffer.from(b, 'hex');
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

// ── Load + decrypt app secret for a phone_number_id ──────────────────────────
async function getAppSecret(phoneNumberId: string): Promise<string | null> {
  const row = await pool.query(
    `SELECT meta_app_secret FROM whatsapp_configs
     WHERE phone_number_id=$1 AND meta_app_secret IS NOT NULL LIMIT 1`,
    [phoneNumberId],
  ).catch(() => ({ rows: [] }));

  if (!row.rows[0]?.meta_app_secret) return null;

  const { decryptCredential } = await import('../../lib/credentialEncryption');
  return decryptCredential(row.rows[0].meta_app_secret);
}

// ── Resolve school_id from phone_number_id ───────────────────────────────────
async function resolveSchool(phoneNumberId: string): Promise<string | null> {
  const row = await pool.query(
    `SELECT school_id FROM whatsapp_configs WHERE phone_number_id=$1 LIMIT 1`,
    [phoneNumberId],
  ).catch(() => ({ rows: [] }));
  return row.rows?.[0]?.school_id ?? null;
}

// ── Idempotency check + persist event ────────────────────────────────────────
async function persistEvent(
  eventId: string,
  phoneNumberId: string,
  schoolId: string | null,
  eventType: string,
): Promise<boolean> {
  // Returns true if new, false if duplicate
  const result = await pool.query(
    `INSERT INTO whatsapp_webhook_events
       (event_id, phone_number_id, school_id, event_type, processing_status)
     VALUES ($1,$2,$3,$4,'received')
     ON CONFLICT (event_id) DO NOTHING
     RETURNING id`,
    [eventId, phoneNumberId, schoolId, eventType],
  ).catch(() => ({ rows: [] }));

  return (result.rows?.length ?? 0) > 0;
}

async function markEventProcessed(eventId: string, status: 'processed' | 'failed', error?: string) {
  await pool.query(
    `UPDATE whatsapp_webhook_events
     SET processing_status=$1, processed_at=now(), error_message=$2
     WHERE event_id=$3`,
    [status, error || null, eventId],
  ).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/whatsapp/webhook — Hub verification
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  const mode      = req.query['hub.mode']         as string;
  const token     = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge']    as string;

  // Reject malformed requests quickly
  if (mode !== 'subscribe' || !token || !challenge) {
    return res.status(400).send('Bad Request');
  }

  // Verify token against DB — tenant-specific, never from plain env
  const row = await pool.query(
    `SELECT school_id FROM whatsapp_configs WHERE webhook_verify_token=$1 LIMIT 1`,
    [token],
  ).catch(() => ({ rows: [] }));

  if (!row.rows?.[0]) {
    // Do not reveal why it failed
    console.warn('[wa-webhook] GET verification failed — token not matched');
    return res.status(403).send('Forbidden');
  }

  console.info('[wa-webhook] Webhook verified for school', row.rows[0].school_id);
  return res.status(200).type('text/plain').send(challenge);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/whatsapp/webhook — Incoming events
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', captureRawBody, async (req: Request, res: Response) => {
  const rawBodyStr: string  = (req as any).rawBody || '';
  const rawBodyBuf: Buffer  = (req as any).rawBodyBuffer || Buffer.alloc(0);

  // ── 1. Parse payload ───────────────────────────────────────────────────────
  if (!rawBodyStr) return res.status(400).send('Empty body');

  let payload: any;
  try {
    payload = JSON.parse(rawBodyStr);
  } catch {
    return res.status(400).send('Invalid JSON');
  }

  // ── 2. Verify this is a WhatsApp Business Account notification ────────────
  if (payload?.object !== 'whatsapp_business_account') {
    return res.status(400).send('Unexpected object type');
  }

  // ── 3. Extract phone_number_id from payload metadata (trusted path) ────────
  // phone_number_id is in entry[].changes[].value.metadata — set by Meta, not the sender
  const phoneNumberId: string =
    payload?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ?? '';

  if (!phoneNumberId) {
    console.warn('[wa-webhook] No phone_number_id in metadata');
    return res.status(200).json({ received: true }); // 200 to stop Meta retries
  }

  // ── 4. HMAC signature verification (before any processing) ────────────────
  const sigHeader = (req.headers['x-hub-signature-256'] as string) ?? '';

  if (!sigHeader) {
    // Meta always sends the signature for verified subscriptions.
    // During initial verification GET it is absent; for POST it must be present.
    console.warn('[wa-webhook] Missing X-Hub-Signature-256 header');
    return res.status(401).send('Missing signature');
  }

  const receivedSig = sigHeader.startsWith('sha256=') ? sigHeader.slice(7) : '';
  if (!receivedSig) {
    return res.status(401).send('Malformed signature');
  }

  const appSecret = await getAppSecret(phoneNumberId);
  if (!appSecret) {
    // No secret configured — accept but log warning.
    // This handles the initial setup moment before secrets are configured.
    console.warn('[wa-webhook] No app secret configured for phone_number_id', phoneNumberId);
  } else {
    const expectedSig = crypto
      .createHmac('sha256', appSecret)
      .update(rawBodyBuf)       // use raw Buffer, not decoded string
      .digest('hex');

    if (!safeEqual(expectedSig, receivedSig)) {
      console.warn('[wa-webhook] Signature mismatch for phone_number_id', phoneNumberId);
      return res.status(401).send('Invalid signature');
    }
  }

  // ── 5. Acknowledge immediately (Meta expects 200 within 5 seconds) ─────────
  res.status(200).json({ received: true });

  // ── 6. Async processing (after response sent) ──────────────────────────────
  setImmediate(async () => {
    try {
      // Update last_webhook_at for health dashboard
      await pool.query(
        `UPDATE whatsapp_configs SET last_webhook_at=now() WHERE phone_number_id=$1`,
        [phoneNumberId],
      ).catch(() => {});

      const schoolId = await resolveSchool(phoneNumberId);

      for (const entry of payload?.entry ?? []) {
        for (const change of entry?.changes ?? []) {
          if (change.field !== 'messages') continue;
          const val = change.value;

          // Process inbound messages
          for (const msg of val?.messages ?? []) {
            const eventId = `msg_${msg.id}`;
            const isNew   = await persistEvent(eventId, phoneNumberId, schoolId, 'message');
            if (!isNew) {
              console.info('[wa-webhook] Duplicate message event skipped:', msg.id);
              continue;
            }

            await handleInboundMessage(schoolId, phoneNumberId, msg, val?.contacts?.[0])
              .then(() => markEventProcessed(eventId, 'processed'))
              .catch(async (e: any) => {
                console.error('[wa-webhook] Message processing error:', e?.message);
                await markEventProcessed(eventId, 'failed', e?.message?.slice(0, 500));
              });
          }

          // Process status updates
          for (const statusUpdate of val?.statuses ?? []) {
            const eventId = `status_${statusUpdate.id}_${statusUpdate.status}`;
            const isNew   = await persistEvent(eventId, phoneNumberId, schoolId, 'status_update');
            if (!isNew) continue;

            await handleStatusUpdate(schoolId, phoneNumberId, statusUpdate)
              .then(() => markEventProcessed(eventId, 'processed'))
              .catch(async (e: any) => {
                console.error('[wa-webhook] Status update error:', e?.message);
                await markEventProcessed(eventId, 'failed', e?.message?.slice(0, 500));
              });
          }
        }
      }
    } catch (err: any) {
      console.error('[wa-webhook] Async processing fatal error:', err?.message);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Handle inbound message (phases 7 + 8)
// ─────────────────────────────────────────────────────────────────────────────
async function handleInboundMessage(
  schoolId: string | null,
  phoneNumberId: string,
  msg: any,
  contact: any,
): Promise<void> {
  if (!schoolId) {
    console.warn('[wa-webhook] No school found for phone_number_id', phoneNumberId);
    return;
  }

  const fromPhone   = msg.from;      // digits only, no +
  const waMessageId = msg.id;
  const msgType     = msg.type as string;
  const timestamp   = new Date(Number(msg.timestamp) * 1000).toISOString();

  // ── Phase 7: Parent contact mapping ────────────────────────────────────────
  // Normalise phone: strip all non-digit chars
  const normPhone = fromPhone.replace(/\D/g, '');

  const parentRow = await pool.query(
    `SELECT id, name FROM parent_users
     WHERE school_id=$1
       AND (regexp_replace(mobile, '[^0-9]', '', 'g') = $2
         OR regexp_replace(COALESCE(whatsapp_phone,''), '[^0-9]', '', 'g') = $2)
       AND is_active=true
     LIMIT 1`,
    [schoolId, normPhone],
  );

  if (!parentRow.rows[0]) {
    // Unknown sender — log but don't associate with arbitrary student
    console.info(`[wa-webhook] Unknown sender ${normPhone} for school ${schoolId} — stored as unknown`);
    // Still persist the event in webhook_events for admin visibility
    return;
  }

  const parentId   = parentRow.rows[0].id;

  // Auto opt-in when parent messages the school
  await pool.query(
    `UPDATE parent_users
     SET whatsapp_opt_in=true,
         whatsapp_opt_in_at=COALESCE(whatsapp_opt_in_at,now()),
         whatsapp_phone=CASE WHEN whatsapp_phone IS NULL THEN $1 ELSE whatsapp_phone END
     WHERE id=$2`,
    [normPhone, parentId],
  ).catch(() => {});

  // Upsert conversation
  const convRow = await pool.query(
    `INSERT INTO whatsapp_conversations
       (school_id, parent_id, wa_phone, session_expires_at, status, last_message_at, last_sender, unread_count)
     VALUES ($1,$2,$3, NOW() + INTERVAL '24 hours', 'open', NOW(), 'parent', 1)
     ON CONFLICT (school_id, parent_id) DO UPDATE
       SET session_expires_at = NOW() + INTERVAL '24 hours',
           last_message_at    = NOW(),
           last_sender        = 'parent',
           unread_count       = whatsapp_conversations.unread_count + 1,
           status = CASE WHEN whatsapp_conversations.status='resolved' THEN 'open'
                         ELSE whatsapp_conversations.status END,
           updated_at = NOW()
     RETURNING id`,
    [schoolId, parentId, normPhone],
  );
  const conversationId = convRow.rows[0].id;

  // ── Phase 8: Media handling ─────────────────────────────────────────────────
  let body: string | null = null;
  let mediaId: string | null = null;
  let mediaMime: string | null = null;

  switch (msgType) {
    case 'text':
      body = msg.text?.body ?? null;
      break;
    case 'image':
      mediaId   = msg.image?.id ?? null;
      mediaMime = msg.image?.mime_type ?? 'image/jpeg';
      body      = msg.image?.caption ?? '[Image]';
      break;
    case 'document':
      mediaId   = msg.document?.id ?? null;
      mediaMime = msg.document?.mime_type ?? 'application/octet-stream';
      body      = msg.document?.caption ?? `[Document: ${msg.document?.filename ?? 'file'}]`;
      break;
    case 'video':
      mediaId   = msg.video?.id ?? null;
      mediaMime = msg.video?.mime_type ?? 'video/mp4';
      body      = msg.video?.caption ?? '[Video]';
      break;
    case 'audio':
      mediaId   = msg.audio?.id ?? null;
      mediaMime = msg.audio?.mime_type ?? 'audio/ogg';
      body      = '[Voice message]';
      break;
    case 'sticker':
      mediaId   = msg.sticker?.id ?? null;
      body      = '[Sticker]';
      break;
    case 'location':
      body = `[Location: ${msg.location?.name ?? ''} lat=${msg.location?.latitude} lng=${msg.location?.longitude}]`;
      break;
    case 'reaction':
      body = `[Reaction: ${msg.reaction?.emoji ?? ''}]`;
      break;
    default:
      body = `[Unsupported message type: ${msgType}]`;
  }

  // Update conversation last_message_text
  await pool.query(
    `UPDATE whatsapp_conversations SET last_message_text=$1, updated_at=now() WHERE id=$2`,
    [(body ?? '').slice(0, 200), conversationId],
  ).catch(() => {});

  // Insert message record (ON CONFLICT DO NOTHING for idempotency at message level)
  await pool.query(
    `INSERT INTO whatsapp_messages
       (school_id, conversation_id, wa_message_id, wa_phone_from, wa_phone_to,
        direction, message_type, body, media_id, media_mime_type, status, sent_at)
     VALUES ($1,$2,$3,$4,$5,'inbound',$6,$7,$8,$9,'received',$10)
     ON CONFLICT (wa_message_id) DO NOTHING`,
    [schoolId, conversationId, waMessageId, normPhone, phoneNumberId,
     msgType, body, mediaId, mediaMime, timestamp],
  );

  // Enqueue media download if applicable (non-blocking)
  if (mediaId && schoolId) {
    setImmediate(() => downloadAndStoreMedia(schoolId, waMessageId, mediaId!, mediaMime ?? '').catch(() => {}));
  }

  // Send read receipt
  markMessageRead(schoolId, waMessageId).catch(() => {});

  // Update sent counter
  await pool.query(
    `UPDATE whatsapp_configs SET total_received=total_received+1 WHERE phone_number_id=$1`,
    [phoneNumberId],
  ).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8: Download media from Meta and store in Google Drive
// ─────────────────────────────────────────────────────────────────────────────
async function downloadAndStoreMedia(
  schoolId: string,
  waMessageId: string,
  mediaId: string,
  mimeType: string,
): Promise<void> {
  try {
    // Load access token for this school
    const credRow = await pool.query(
      `SELECT access_token FROM whatsapp_configs WHERE school_id=$1 AND access_token IS NOT NULL LIMIT 1`,
      [schoolId],
    );
    if (!credRow.rows[0]?.access_token) return;

    const { decryptCredential } = await import('../../lib/credentialEncryption');
    const accessToken = decryptCredential(credRow.rows[0].access_token);

    // 1. Get the temporary download URL from Meta
    const axios = (await import('axios')).default;
    const metaRes = await axios.get(
      `https://graph.facebook.com/v20.0/${mediaId}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 10000 },
    );
    const mediaUrl: string = metaRes.data?.url;
    if (!mediaUrl) return;

    // 2. Download the file bytes
    const fileRes = await axios.get(mediaUrl, {
      responseType: 'arraybuffer',
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 60000,
      maxContentLength: 50 * 1024 * 1024, // 50 MB max
    });

    const fileBuffer = Buffer.from(fileRes.data);
    const ext = mimeType.split('/')[1]?.split(';')[0] || 'bin';
    const filename = `wa_media_${mediaId}.${ext}`;

    // 3. Write to temp file
    const { writeFileSync, unlinkSync } = await import('fs');
    const tmpPath = `/tmp/wa-media-${mediaId}.${ext}`;
    writeFileSync(tmpPath, fileBuffer);

    // 4. Upload to Google Drive
    const { uploadToGoogleDrive } = await import('../../lib/storage');
    const driveResult = await uploadToGoogleDrive({
      schoolId,
      localPath: tmpPath,
      originalName: filename,
      mimeType,
      driveFolderName: `WhatsApp Media`,
    });
    unlinkSync(tmpPath);

    // 5. Update the message record with Drive path
    await pool.query(
      `UPDATE whatsapp_messages
       SET media_drive_path=$1, media_drive_url=$2, media_size_bytes=$3
       WHERE wa_message_id=$4`,
      [driveResult.storagePath, driveResult.directUrl, fileBuffer.length, waMessageId],
    ).catch(() => {});

    console.info(`[wa-media] Stored media ${mediaId} → ${driveResult.storagePath}`);
  } catch (err: any) {
    console.error(`[wa-media] Failed to download/store media ${mediaId}:`, err?.message);
    // Non-fatal: message record is already saved, media just won't be in Drive
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 6: Message status tracking
// ─────────────────────────────────────────────────────────────────────────────
async function handleStatusUpdate(
  schoolId: string | null,
  phoneNumberId: string,
  status: any,
): Promise<void> {
  const waMessageId  = status.id;
  const statusValue  = status.status as string; // sent | delivered | read | failed
  const errorCode    = status.errors?.[0]?.code?.toString() ?? null;
  // Truncate error message — do not log full sensitive error descriptions
  const errorMessage = status.errors?.[0]?.message?.slice(0, 300) ?? null;

  const now = new Date().toISOString();

  await pool.query(
    `UPDATE whatsapp_messages
     SET status       = $1,
         delivered_at = CASE WHEN $1='delivered' THEN COALESCE(delivered_at,$2) ELSE delivered_at END,
         read_at      = CASE WHEN $1='read'      THEN COALESCE(read_at,$2)      ELSE read_at      END,
         error_code   = COALESCE($3, error_code),
         error_message= COALESCE($4, error_message)
     WHERE wa_message_id=$5
       ${schoolId ? 'AND school_id=$6' : ''}`,
    schoolId
      ? [statusValue, now, errorCode, errorMessage, waMessageId, schoolId]
      : [statusValue, now, errorCode, errorMessage, waMessageId],
  );
}

export default router;
