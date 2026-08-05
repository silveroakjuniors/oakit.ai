/**
 * GET /api/v1/drive-proxy?id=FILE_ID&school=SCHOOL_ID&sig=HMAC
 * Proxies Google Drive file bytes through the API.
 * Uses HMAC signature — no JWT required (safe for <img> and <video> tags).
 * Supports Range requests so videos can seek correctly (206 Partial Content).
 */
import { Router, Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { pool } from '../../lib/db';
import { JWT as GoogleJWT } from 'google-auth-library';

const router = Router();

const PROXY_SECRET = process.env.JWT_SECRET || 'change_me';

// Cache access tokens per school (expire 55 min, Drive tokens last 60 min)
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getAccessToken(schoolId: string): Promise<string | null> {
  const cached = tokenCache.get(schoolId);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const cfg = await pool.query(
    `SELECT google_drive_auth FROM school_settings WHERE school_id = $1`,
    [schoolId]
  );
  const authConfig: any = cfg.rows[0]?.google_drive_auth;
  if (!authConfig) return null;

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
      scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'],
    });
    const { access_token } = await jwtClient.authorize();
    accessToken = access_token;
  } else if (parsed.access_token) {
    accessToken = parsed.access_token;
  }

  if (accessToken) {
    tokenCache.set(schoolId, { token: accessToken, expiresAt: Date.now() + 55 * 60 * 1000 });
  }
  return accessToken;
}

/** Generate a signed proxy URL for a Drive file (no JWT needed in browser). */
export function signDriveUrl(fileId: string, schoolId: string): string {
  const sig = crypto
    .createHmac('sha256', PROXY_SECRET)
    .update(`${fileId}:${schoolId}`)
    .digest('hex')
    .slice(0, 16);
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
    const fileId   = req.query.id      as string;
    const schoolId = req.query.school  as string;
    const sig      = req.query.sig     as string;
    const download = req.query.download === '1';

    // Auth: HMAC signature (preferred — works in <img>/<video> without headers)
    let resolvedSchoolId = schoolId;
    if (sig && schoolId) {
      if (!verifySig(fileId, schoolId, sig)) {
        return res.status(403).send('Invalid signature');
      }
    } else {
      // Fallback: JWT via Authorization header or ?token= param
      const authHeader  = req.headers.authorization;
      const queryToken  = req.query.token as string | undefined;
      if (!authHeader && !queryToken) {
        return res.status(400).send('Missing auth');
      }
      try {
        const { verifyToken } = await import('../../lib/jwt');
        const rawToken = authHeader?.replace('Bearer ', '').trim() || queryToken;
        const decoded  = verifyToken(rawToken!);
        resolvedSchoolId = decoded.school_id || schoolId;
      } catch {
        return res.status(401).send('Invalid token');
      }
    }

    if (!fileId || !/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) {
      return res.status(400).send('Invalid file ID');
    }
    if (!resolvedSchoolId) return res.status(400).send('Missing school');

    const accessToken = await getAccessToken(resolvedSchoolId);
    if (!accessToken) return res.status(503).send('Drive credentials not configured');

    // First fetch file metadata to get content-type and size
    let contentType  = 'application/octet-stream';
    let contentLength: number | undefined;
    try {
      const meta = await axios.get(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType,size,name`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      contentType   = meta.data.mimeType   || contentType;
      contentLength = meta.data.size       ? parseInt(meta.data.size) : undefined;
    } catch {
      // Non-fatal — proceed without metadata
    }

    const isVideo = contentType.startsWith('video/');

    // Support Range requests for video seeking (RFC 7233)
    const rangeHeader = req.headers['range'];

    if (isVideo && rangeHeader && contentLength) {
      // Parse "bytes=START-END"
      const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      if (match) {
        const start  = match[1] ? parseInt(match[1]) : 0;
        const end    = match[2] ? parseInt(match[2]) : contentLength - 1;
        const chunkSize = end - start + 1;

        const driveRes = await axios.get(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Range: `bytes=${start}-${end}`,
            },
            responseType: 'stream',
            timeout: 60000,
          }
        );

        res.writeHead(206, {
          'Content-Range':  `bytes ${start}-${end}/${contentLength}`,
          'Accept-Ranges':  'bytes',
          'Content-Length': chunkSize,
          'Content-Type':   contentType,
          'Cache-Control':  'public, max-age=3600',
        });
        driveRes.data.pipe(res);
        return;
      }
    }

    // Regular (non-range) request
    const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };

    const driveRes = await axios.get(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers,
        responseType: 'stream',
        timeout: 60000,
      }
    );

    const responseHeaders: Record<string, string | number> = {
      'Content-Type':  contentType,
      'Cache-Control': isVideo ? 'public, max-age=3600' : 'public, max-age=86400',
      'Accept-Ranges': 'bytes',
    };
    if (contentLength) responseHeaders['Content-Length'] = contentLength;
    if (download) {
      responseHeaders['Content-Disposition'] = 'attachment';
    }

    res.writeHead(200, responseHeaders);
    driveRes.data.pipe(res);

  } catch (err: any) {
    const status = err.response?.status;
    if (status === 404) return res.status(404).send('File not found');
    if (status === 403) return res.status(403).send('Access denied by Drive');
    if (!res.headersSent) res.status(500).send('Media unavailable');
  }
});

export default router;
