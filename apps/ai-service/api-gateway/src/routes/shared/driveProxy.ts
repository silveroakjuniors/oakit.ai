/**
 * GET /api/v1/drive-proxy?id=FILE_ID&school=SCHOOL_ID&sig=HMAC
 * Proxies Google Drive file bytes through the API — no CORS/auth issues in browser.
 * Uses HMAC signature so no JWT needed (safe for <img src> and <video src> tags).
 */
import { Router, Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { pool } from '../../lib/db';
import { JWT as GoogleJWT } from 'google-auth-library';

const router = Router();

const PROXY_SECRET = process.env.JWT_SECRET || 'change_me';

// Generate a signed URL for a Drive file
export function signDriveUrl(fileId: string, schoolId: string): string {
  const sig = crypto
    .createHmac('sha256', PROXY_SECRET)
    .update(`${fileId}:${schoolId}`)
    .digest('hex')
    .slice(0, 16); // short enough for URLs
  return `/api/v1/drive-proxy?id=${fileId}&school=${schoolId}&sig=${sig}`;
}

function verifySig(fileId: string, schoolId: string, sig: string): boolean {
  const expected = crypto
    .createHmac('sha256', PROXY_SECRET)
    .update(`${fileId}:${schoolId}`)
    .digest('hex')
    .slice(0, 16);
  return sig === expected;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const fileId = req.query.id as string;
    const schoolId = req.query.school as string;
    const sig = req.query.sig as string;

    // Also accept old JWT-based approach for backwards compat
    const authHeader = req.headers.authorization;
    const queryToken = req.query.token as string | undefined;
    let resolvedSchoolId = schoolId;

    if (sig && schoolId) {
      // New: HMAC signed — no JWT needed
      if (!verifySig(fileId, schoolId, sig)) {
        return res.status(403).send('Invalid signature');
      }
    } else if (authHeader || queryToken) {
      // Old: JWT-based — extract school_id
      try {
        const { verifyToken } = await import('../../lib/jwt');
        const rawToken = authHeader?.replace('Bearer ', '').trim() || queryToken;
        const decoded = verifyToken(rawToken!);
        resolvedSchoolId = decoded.school_id || schoolId;
      } catch {
        return res.status(401).send('Invalid token');
      }
    } else {
      return res.status(400).send('Missing auth');
    }

    if (!fileId || !/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) {
      return res.status(400).send('Invalid file ID');
    }
    if (!resolvedSchoolId) return res.status(400).send('Missing school');

    // Get school Drive credentials
    const cfg = await pool.query(
      `SELECT google_drive_auth FROM school_settings WHERE school_id = $1`,
      [resolvedSchoolId]
    );
    const authConfig: any = cfg.rows[0]?.google_drive_auth;
    if (!authConfig) return res.status(400).send('Drive not configured');

    const parsed = typeof authConfig === 'string' ? JSON.parse(authConfig) : authConfig;
    let accessToken: string | null = null;

    if (parsed.type === 'oauth' && parsed.refresh_token) {
      const tokenRes = await axios.post(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({
          client_id: parsed.client_id,
          client_secret: parsed.client_secret,
          refresh_token: parsed.refresh_token,
          grant_type: 'refresh_token',
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      accessToken = tokenRes.data.access_token;
    } else if (parsed.type === 'service_account' && parsed.private_key) {
      const jwtClient = new GoogleJWT({
        key: parsed.private_key,
        email: parsed.client_email,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });
      const { access_token } = await jwtClient.authorize();
      accessToken = access_token;
    }

    if (!accessToken) return res.status(401).send('Could not get Drive token');

    const driveRes = await axios.get(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: 'stream',
        timeout: 30000,
      }
    );

    const contentType = String(driveRes.headers['content-type'] || 'application/octet-stream');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');

    driveRes.data.pipe(res);
  } catch (err: any) {
    const status = err.response?.status || 500;
    if (!res.headersSent) res.status(status).send('Failed to fetch from Drive');
  }
});

export default router;
