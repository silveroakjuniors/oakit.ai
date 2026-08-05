/**
 * GET /api/v1/drive-proxy?id=FILE_ID&token=JWT
 * Proxies a Google Drive file through the API so browsers can display it
 * without CORS / referrer issues. Token can be in Authorization header
 * OR as a query param (needed for <img src> and <video src> tags).
 */
import { Router, Request, Response } from 'express';
import axios from 'axios';
import { pool } from '../../lib/db';
import { JWT as GoogleJWT } from 'google-auth-library';
import { verifyToken } from '../../lib/jwt';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    // Accept token from Authorization header OR query param (for <img> and <video> tags)
    const authHeader = req.headers.authorization;
    const queryToken = req.query.token as string | undefined;
    const rawToken = authHeader?.replace('Bearer ', '').trim() || queryToken?.trim();

    if (!rawToken) return res.status(401).send('Unauthorized');

    // Verify token using the same logic as the rest of the API
    let school_id: string | null;
    try {
      const decoded = verifyToken(rawToken);
      school_id = decoded.school_id;
    } catch {
      return res.status(401).send('Invalid or expired token');
    }

    if (!school_id) return res.status(401).send('No school context');

    const fileId = req.query.id as string;
    if (!fileId || !/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) {
      return res.status(400).send('Invalid file ID');
    }

    // Get the school's Google Drive credentials
    const cfg = await pool.query(
      `SELECT google_drive_auth FROM school_settings WHERE school_id = $1`,
      [school_id]
    );
    const authConfig: any = cfg.rows[0]?.google_drive_auth;
    if (!authConfig) return res.status(400).send('Google Drive not configured');

    // Generate access token
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
    } else if (parsed.access_token) {
      accessToken = parsed.access_token;
    }

    if (!accessToken) return res.status(401).send('Could not get Drive access token');

    // Fetch the file from Drive and stream it directly to the client
    const driveRes = await axios.get(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: 'stream',
        timeout: 30000,
      }
    );

    // Forward content type and cache headers
    const contentType = String(driveRes.headers['content-type'] || 'application/octet-stream');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // cache 1 day in browser
    res.setHeader('Access-Control-Allow-Origin', '*');

    driveRes.data.pipe(res);
  } catch (err: any) {
    const status = err.response?.status || 500;
    console.error('[drive-proxy]', err.response?.data || err.message);
    if (!res.headersSent) res.status(status).send('Failed to fetch from Drive');
  }
});

export default router;
