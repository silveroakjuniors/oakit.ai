import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, forceResetGuard, schoolScope, roleGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('parent'));

// GET /connect?provider=google
router.get('/connect', async (req: Request, res: Response) => {
  try {
    const provider = (req.query.provider as string) || 'google';
    const { user_id } = req.user!;

    if (provider === 'google') {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/v1/parent/calendar/callback`;
      const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar');
      const state = encodeURIComponent(String(user_id));

      if (!clientId) {
        return res.status(501).json({ error: 'Google OAuth not configured' });
      }

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&access_type=offline&prompt=consent&state=${state}`;
      return res.json({ authUrl });
    }

    return res.status(400).json({ error: 'Unsupported provider' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /status - return connection status for the authenticated parent
router.get('/status', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.user!;
    const row = await pool.query('SELECT provider, status, expires_at FROM parent_calendar_tokens WHERE parent_id = $1', [user_id]);
    if (row.rows.length === 0) return res.json({ connected: false });
    const r = row.rows[0];
    return res.json({ connected: r.status === 'authorized', provider: r.provider, expires_at: r.expires_at });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /callback?provider=google&code=...&state=...
// This endpoint will store the authorization code for later exchange if server is not configured with client secret.
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const provider = (req.query.provider as string) || 'google';
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined; // contains user_id when we set state

    if (!code || !state) return res.status(400).send('Missing code/state');

    const parentId = state; // we used user_id as state earlier

    // Store the code for later token exchange
    await pool.query(
      `INSERT INTO parent_calendar_tokens (parent_id, provider, code, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (parent_id, provider) DO UPDATE SET code = EXCLUDED.code, status = 'pending', updated_at = now()`,
      [parentId, provider, code, 'pending']
    );

    // Redirect back to frontend with success
    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontend}/parent?calendar_connected=1`);
  } catch (err) {
    console.error(err);
    return res.status(500).send('Internal server error');
  }
});

// POST /token - exchange stored code or provided code for tokens (server-side)
router.post('/token', async (req: Request, res: Response) => {
  try {
    const provider = (req.query.provider as string) || 'google';
    const { user_id } = req.user!;
    const codeFromBody = req.body.code as string | undefined;

    if (provider !== 'google') return res.status(400).json({ error: 'Unsupported provider' });

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/v1/parent/calendar/callback`;

    if (!clientId || !clientSecret) {
      return res.status(501).json({ error: 'Server not configured for token exchange' });
    }

    // Prefer code from body, else stored code
    let code = codeFromBody;
    if (!code) {
      const row = await pool.query('SELECT code FROM parent_calendar_tokens WHERE parent_id = $1 AND provider = $2', [user_id, provider]);
      if (row.rows.length === 0 || !row.rows[0].code) return res.status(400).json({ error: 'No authorization code available' });
      code = row.rows[0].code;
    }

    const params = new URLSearchParams();
    params.append('code', code as string);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('redirect_uri', redirectUri);
    params.append('grant_type', 'authorization_code');

    const resp = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: params });
    if (!resp.ok) {
      const text = await resp.text();
      console.error('Token exchange failed', text);
      return res.status(500).json({ error: 'Token exchange failed' });
    }
    const data: any = await resp.json();

    const expiresAt = data.expires_in ? new Date(Date.now() + Number(data.expires_in) * 1000) : null;

    await pool.query(
      `INSERT INTO parent_calendar_tokens (parent_id, provider, code, access_token, refresh_token, scope, expires_at, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (parent_id, provider) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         scope = EXCLUDED.scope,
         expires_at = EXCLUDED.expires_at,
         status = 'authorized',
         updated_at = now()`,
      [user_id, provider, code, data.access_token || null, data.refresh_token || null, data.scope || null, expiresAt, 'authorized']
    );

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /export - download a simple ICS calendar (stubbed events)
router.get('/export', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.user!;

    // Query for school events if available - this is a stub that returns a minimal calendar
    const now = new Date();
    const starts = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const ends = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const uid = `oakit-${user_id}-${Date.now()}`;
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Silveroak Oakit//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART:${starts}`,
      `DTEND:${ends}`,
      'SUMMARY:School events export',
      'DESCRIPTION:Exported school events from Oakit',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="oakit-events.ics"');
    return res.send(ics);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /refresh - refresh access token using stored refresh_token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const provider = (req.query.provider as string) || 'google';
    const { user_id } = req.user!;

    if (provider !== 'google') return res.status(400).json({ error: 'Unsupported provider' });

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) return res.status(501).json({ error: 'Server not configured for token refresh' });

    const row = await pool.query('SELECT refresh_token FROM parent_calendar_tokens WHERE parent_id = $1 AND provider = $2', [user_id, provider]);
    if (row.rows.length === 0 || !row.rows[0].refresh_token) return res.status(400).json({ error: 'No refresh token available' });
    const refreshToken = row.rows[0].refresh_token;

    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('refresh_token', refreshToken);
    params.append('grant_type', 'refresh_token');

    const resp = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: params });
    if (!resp.ok) {
      const txt = await resp.text();
      console.error('Refresh failed', txt);
      return res.status(502).json({ error: 'Token refresh failed' });
    }
    const data: any = await resp.json();

    const expiresAt = data.expires_in ? new Date(Date.now() + Number(data.expires_in) * 1000) : null;

    await pool.query(
      `UPDATE parent_calendar_tokens SET access_token = $1, expires_at = $2, status = 'authorized', updated_at = now() WHERE parent_id = $3 AND provider = $4`,
      [data.access_token || null, expiresAt, user_id, provider]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /revoke - revoke tokens and clear stored credentials
router.post('/revoke', async (req: Request, res: Response) => {
  try {
    const provider = (req.query.provider as string) || 'google';
    const { user_id } = req.user!;

    if (provider !== 'google') return res.status(400).json({ error: 'Unsupported provider' });

    await pool.query('DELETE FROM parent_calendar_tokens WHERE parent_id = $1 AND provider = $2', [user_id, provider]);
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
