import { pool } from './db';

// Lazy-load web-push to avoid crash if module isn't installed yet
let webpush: any = null;
try {
  webpush = require('web-push');
} catch { /* web-push not installed — push notifications disabled */ }

// VAPID keys — generate once and store in env vars
// To generate: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:hello@oakit.ai';

if (webpush && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  data?: Record<string, any>;
}

/**
 * Send push notification to a specific user (staff)
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const subs = await pool.query(
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
    [userId]
  );
  return sendToSubscriptions(subs.rows, payload);
}

/**
 * Send push notification to a parent
 */
export async function sendPushToParent(parentId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const subs = await pool.query(
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE parent_id = $1`,
    [parentId]
  );
  return sendToSubscriptions(subs.rows, payload);
}

/**
 * Send push notification to all users with a specific role in a school
 */
export async function sendPushToRole(schoolId: string, role: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const subs = await pool.query(
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE school_id = $1 AND user_role = $2`,
    [schoolId, role]
  );
  return sendToSubscriptions(subs.rows, payload);
}

/**
 * Send push notification to all parents in a section
 */
export async function sendPushToSectionParents(sectionId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const subs = await pool.query(
    `SELECT DISTINCT ps.id, ps.endpoint, ps.p256dh, ps.auth
     FROM push_subscriptions ps
     JOIN parent_student_links psl ON psl.parent_id = ps.parent_id
     JOIN students s ON s.id = psl.student_id
     WHERE s.section_id = $1 AND ps.parent_id IS NOT NULL`,
    [sectionId]
  );
  return sendToSubscriptions(subs.rows, payload);
}

async function sendToSubscriptions(
  subscriptions: { id: string; endpoint: string; p256dh: string; auth: string }[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!webpush || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  const expiredIds: string[] = [];

  const payloadStr = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/oakie-icon.png',
    badge: payload.badge || '/oakie-icon.png',
    data: {
      url: payload.url || '/',
      ...payload.data,
    },
    tag: payload.tag,
  });

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payloadStr,
          { TTL: 86400 } // 24 hours
        );
        sent++;
        // Update last_used_at
        await pool.query(`UPDATE push_subscriptions SET last_used_at = now() WHERE id = $1`, [sub.id]);
      } catch (err: any) {
        failed++;
        // If subscription is expired/invalid (410 Gone or 404), remove it
        if (err.statusCode === 410 || err.statusCode === 404) {
          expiredIds.push(sub.id);
        }
      }
    })
  );

  // Clean up expired subscriptions
  if (expiredIds.length > 0) {
    await pool.query(`DELETE FROM push_subscriptions WHERE id = ANY($1::uuid[])`, [expiredIds]);
  }

  return { sent, failed };
}
