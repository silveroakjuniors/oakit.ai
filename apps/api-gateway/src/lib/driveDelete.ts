/**
 * lib/driveDelete.ts
 * Delete a file from Google Drive using the school's configured OAuth credentials.
 */
import axios from 'axios';
import { pool } from './db';
import { JWT as GoogleJWT } from 'google-auth-library';

async function getAccessToken(schoolId: string): Promise<string | null> {
  const cfg = await pool.query(
    `SELECT google_drive_auth FROM school_settings WHERE school_id=$1`,
    [schoolId],
  ).catch(() => ({ rows: [] }));
  if (!cfg.rows[0]?.google_drive_auth) return null;

  const auth: any = typeof cfg.rows[0].google_drive_auth === 'string'
    ? JSON.parse(cfg.rows[0].google_drive_auth)
    : cfg.rows[0].google_drive_auth;

  if (auth.type === 'oauth' && auth.refresh_token) {
    const r = await axios.post<{ access_token: string }>(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        client_id:     auth.client_id,
        client_secret: auth.client_secret,
        refresh_token: auth.refresh_token,
        grant_type:    'refresh_token',
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    return r.data.access_token;
  }
  if (auth.type === 'service_account' && auth.client_email) {
    const jwt = new GoogleJWT({
      key: auth.private_key, email: auth.client_email,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
      subject: auth.delegate_email || null,
    });
    const { access_token } = await jwt.authorize();
    return access_token;
  }
  return null;
}

export async function deleteDriveFile(fileId: string, schoolId: string): Promise<void> {
  const token = await getAccessToken(schoolId);
  if (!token) { console.warn(`[driveDelete] No credentials for school ${schoolId}`); return; }
  await axios.delete(
    `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  ).catch(e => console.error(`[driveDelete] Failed to delete ${fileId}:`, e?.response?.data || e?.message));
}
