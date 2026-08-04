/**
 * GET /api/v1/drive-proxy?id=FILE_ID
 * Proxies a Google Drive file through the API so browsers can display it
 * without CORS / referrer issues. Requires a valid JWT token.
 */
import { Router, Request, Response } from 'express';
import axios from 'axios';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope } from '../../middleware/auth';
import { JWT as GoogleJWT } from 'google-auth-library';

const router = Router();
router.use(jwtVerify, schoolScope);

router.get('/', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const fileId = req.query.id as string;

    if (!fileId || !/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    // Get the school's Google Drive access token
    const cfg = await pool.query(
      `SELECT google_drive_auth FROM school_settings WHERE school_id = $1`,
      [school_id]
    );
    const authConfig: any = cfg.rows[0]?.google_drive_auth;
    if (!authConfig) return res.status(400).json({ error: 'Google Drive not configured' });

    // Generate access token
    let accessToken: string | null = null;
    const parsed = typeof authConfig === 'string' ? JSON.parse(authConfig) : authConfig;

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
    } else if (parsed.type === 'service_account') {
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

    if (!accessToken) return res.status(401).json({ error: 'Could not get Drive access token' });

    // Fetch the file from Drive and stream it
    const driveRes = await axios.get(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: 'stream',
        timeout: 30000,
      }
    );

    // Forward content-type and cache headers
    const contentType = driveRes.headers['content-type'] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // cache 1 day
    res.setHeader('Access-Control-Allow-Origin', '*');

    driveRes.data.pipe(res);
  } catch (err: any) {
    const status = err.response?.status || 500;
    console.error('[drive-proxy]', err.response?.data || err.message);
    return res.status(status).json({ error: 'Failed to fetch file from Drive' });
  }
});

export default router;
