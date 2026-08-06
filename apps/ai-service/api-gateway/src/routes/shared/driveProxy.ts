/**
 * GET /api/v1/drive-proxy?id=FILE_ID&school=SCHOOL_ID&sig=HMAC[&download=1]
 *
 * Streams a Google Drive file through the API to the browser.
 * - HMAC signature auth — no JWT required, safe in <img> and <video> src.
 * - Supports Range requests for video seeking (206 Partial Content).
 * - Token cached per school for 55 minutes.
 */
import { Router, Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { pool } from '../../lib/db';
import { JWT as GoogleJWT } from 'google-auth-library';

const router = Router();

const PROXY_SECRET = process.env.JWT_SECRET || 'change_me';

// ── Token cache: avoid refreshing on every request ─────────────────────────
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getAccessToken(schoolId: string): Promise<string> {
  const cached = tokenCache.get(schoolId);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const cfg = await pool.query(
    `SELECT google_drive_auth FROM school_settings WHERE school_id = $1`,
    [schoolId]
  );
  const raw: any = cfg.rows[0]?.google_drive_auth;
  if (!raw) throw new Error('Drive not configured for school');

  const auth = typeof raw === 'string' ? JSON.parse(raw) : raw;
  let token: string | null = null;

  if (auth.type === 'oauth' && auth.refresh_token) {
    const r = await axios.post<{ access_token: string }>(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        client_id:     auth.client_id,
        client_secret: auth.client_secret,
        refresh_token: auth.refresh_token,
        grant_type:    'refresh_token',
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    token = r.data.access_token;
  } else if (auth.type === 'service_account' && auth.private_key) {
    const jwt = new GoogleJWT({
      key:    auth.private_key,
      email:  auth.client_email,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const { access_token } = await jwt.authorize();
    token = access_token;
  } else if (auth.access_token) {
    token = auth.access_token;
  }

  if (!token) throw new Error('Could not obtain Drive access token');
  tokenCache.set(schoolId, { token, expiresAt: Date.now() + 55 * 60 * 1000 });
  return token;
}

// ── HMAC helpers ────────────────────────────────────────────────────────────
export function signDriveUrl(fileId: string, schoolId: string): string {
  const sig = crypto.createHmac('sha256', PROXY_SECRET)
    .update(`${fileId}:${schoolId}`).digest('hex').slice(0, 16);
  return `/api/v1/drive-proxy?id=${fileId}&school=${schoolId}&sig=${sig}`;
}

function verifySig(fileId: string, schoolId: string, sig: string): boolean {
  const expected = crypto.createHmac('sha256', PROXY_SECRET)
    .update(`${fileId}:${schoolId}`).digest('hex').slice(0, 16);
  return sig === expected;
}

// ── Route handler ────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  const fileId   = (req.query.id     as string || '').trim();
  const schoolId = (req.query.school as string || '').trim();
  const sig      = (req.query.sig    as string || '').trim();
  const download = req.query.download === '1';

  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    let resolvedSchoolId = schoolId;

    if (sig && schoolId) {
      if (!verifySig(fileId, schoolId, sig)) {
        console.warn('[drive-proxy] invalid sig for file=%s school=%s', fileId, schoolId);
        return res.status(403).send('Invalid signature');
      }
    } else {
      // Fallback: JWT token
      const authHeader = req.headers.authorization;
      const queryToken = req.query.token as string | undefined;
      if (!authHeader && !queryToken) return res.status(400).send('Missing auth');
      try {
        const { verifyToken } = await import('../../lib/jwt');
        const raw     = authHeader?.replace('Bearer ', '').trim() || queryToken!;
        const decoded = verifyToken(raw);
        resolvedSchoolId = (decoded as any).school_id || schoolId;
      } catch {
        return res.status(401).send('Invalid token');
      }
    }

    if (!fileId || !/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) {
      return res.status(400).send('Invalid file ID');
    }
    if (!resolvedSchoolId) return res.status(400).send('Missing school');

    // ── 2. Get Drive token ───────────────────────────────────────────────────
    let accessToken: string;
    try {
      accessToken = await getAccessToken(resolvedSchoolId);
    } catch (tokenErr: any) {
      console.error('[drive-proxy] token error school=%s:', resolvedSchoolId, tokenErr.message);
      return res.status(503).send('Drive credentials not configured');
    }

    // ── 3. Stream file from Drive ────────────────────────────────────────────
    const rangeHeader = req.headers['range'];
    const driveHeaders: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };
    if (rangeHeader) driveHeaders['Range'] = rangeHeader;

    let driveRes: any;
    try {
      driveRes = await axios.get(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers:      driveHeaders,
          responseType: 'stream',
          timeout:      60000,
          // Don't throw on 206 — axios treats non-2xx as errors by default
          validateStatus: (s) => s < 400,
        }
      );
    } catch (driveErr: any) {
      const status = driveErr.response?.status;
      console.error('[drive-proxy] Drive API error file=%s status=%s:', fileId, status, driveErr.message);
      if (status === 404) return res.status(404).send('File not found in Drive');
      if (status === 403) return res.status(403).send('Drive access denied');
      return res.status(502).send('Failed to fetch from Drive');
    }

    // ── 4. Forward headers ───────────────────────────────────────────────────
    const contentType = String(driveRes.headers['content-type'] || 'application/octet-stream');
    const statusCode  = driveRes.status; // 200 or 206

    const outHeaders: Record<string, string | number> = {
      'Content-Type':  contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': contentType.startsWith('video/') ? 'public, max-age=3600' : 'public, max-age=86400',
    };

    // Forward range-response headers
    if (driveRes.headers['content-range'])  outHeaders['Content-Range']  = driveRes.headers['content-range'];
    if (driveRes.headers['content-length']) outHeaders['Content-Length'] = driveRes.headers['content-length'];

    if (download) outHeaders['Content-Disposition'] = 'attachment';

    console.log('[drive-proxy] streaming file=%s school=%s status=%s type=%s',
      fileId, resolvedSchoolId, statusCode, contentType);

    res.writeHead(statusCode, outHeaders);
    driveRes.data.pipe(res);

    driveRes.data.on('error', (e: Error) => {
      console.error('[drive-proxy] stream error file=%s:', fileId, e.message);
      if (!res.writableEnded) res.end();
    });

  } catch (err: any) {
    console.error('[drive-proxy] unexpected error file=%s:', fileId, err.message);
    if (!res.headersSent) res.status(500).send('Media unavailable');
  }
});

export default router;
