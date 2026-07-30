// @ts-ignore: supabase client may be unavailable in some dev environments
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { pool } from './db';
import axios from 'axios';
import { JWT as GoogleJWT } from 'google-auth-library';

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'oakit-uploads';

// Lazy init — only create client if env vars are present
let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient | null {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key || key === 'your_service_role_key_here') return null;
  _supabase = createClient(url, key);
  return _supabase;
}

export type StorageFolder = 'logos' | 'students' | 'notes' | 'resources';
export type StorageType = 'supabase' | 'google_drive';

export interface UploadOptions {
  schoolId: string;
  folder: StorageFolder;
  localPath: string;
  originalName: string;
  mimeType: string;
  // Audit fields
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  entityType?: string;
  entityId?: string;
  expiresAt?: Date | null;
  auditMeta?: Record<string, any>;
}

/**
 * Upload a file to Supabase Storage and write an audit log entry.
 * Path: {school_id}/{folder}/{timestamp}-{random}.{ext}
 */
export async function uploadFile(opts: UploadOptions): Promise<{ storagePath: string; publicUrl: string }> {
  const supabase = getSupabase();
  const ext = path.extname(opts.originalName) || '';
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const storagePath = `${opts.schoolId}/${opts.folder}/${filename}`;

  const fileBuffer = fs.readFileSync(opts.localPath);

  if (!supabase) {
    // Supabase not configured — fall back to local disk
    const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads', opts.folder);
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const localDest = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(localDest, fileBuffer);
    fs.unlink(opts.localPath, () => {});
    return { storagePath: localDest, publicUrl: `/uploads/${opts.folder}/${filename}` };
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, { contentType: opts.mimeType, upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  fs.unlink(opts.localPath, () => {});

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

  // Write audit log
  if (opts.actorId) {
    const actionMap: Record<StorageFolder, string> = {
      logos: 'upload_logo',
      students: 'upload_photo',
      notes: 'upload_note',
      resources: 'upload_resource',
    };
    await pool.query(
      `INSERT INTO audit_logs (school_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, metadata, storage_path, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        opts.schoolId, opts.actorId, opts.actorName || null, opts.actorRole || null,
        actionMap[opts.folder],
        opts.entityType || opts.folder,
        opts.entityId || null,
        JSON.stringify({ file_name: opts.originalName, file_size: fileBuffer.length, ...(opts.auditMeta || {}) }),
        storagePath,
        opts.expiresAt || null,
      ]
    ).catch(e => console.error('[audit log]', e));
  }

  return { storagePath, publicUrl: data.publicUrl };
}

/**
 * Upload a file to Google Drive.
 * Uses service account credentials from environment variables or user OAuth tokens.
 */
export async function uploadToGoogleDrive(opts: {
  schoolId: string;
  localPath: string;
  originalName: string;
  mimeType: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  folderId?: string;
  driveFolderName?: string;
}): Promise<{ driveFileId: string; driveUrl: string; storagePath: string; classFolderId: string | null }> {
  const ext = path.extname(opts.originalName) || '';
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

  // Get Google Drive config for school
  const schoolConfig = await pool.query(
    `SELECT google_drive_enabled, google_drive_folder_id, google_drive_auth FROM school_settings WHERE school_id = $1`,
    [opts.schoolId]
  );

  if (schoolConfig.rows.length === 0) {
    throw new Error('Google Drive not configured for this school');
  }

  const config = schoolConfig.rows[0];
  if (!config.google_drive_enabled || !config.google_drive_folder_id) {
    throw new Error('Google Drive is not enabled for this school');
  }

  const folderId = config.google_drive_folder_id;

  // Check for OAuth credentials in config or environment
  let accessToken: string | null = null;

  if (config.google_drive_auth) {
    try {
      // pg returns JSONB columns as already-parsed JS objects — never call JSON.parse on them
      const authConfig: any = typeof config.google_drive_auth === 'string'
        ? JSON.parse(config.google_drive_auth)
        : config.google_drive_auth;

      if (authConfig.type === 'oauth' && authConfig.refresh_token && authConfig.client_id && authConfig.client_secret) {
        // ── OAuth refresh token flow (personal Google account) ──────────────
        const tokenBody = new URLSearchParams({
          client_id:     authConfig.client_id,
          client_secret: authConfig.client_secret,
          refresh_token: authConfig.refresh_token,
          grant_type:    'refresh_token',
        }).toString();

        let tokenRes: any;
        try {
          tokenRes = await axios.post<{ access_token: string; expires_in: number }>(
            'https://oauth2.googleapis.com/token',
            tokenBody,
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
          );
        } catch (tokenErr: any) {
          const detail = tokenErr.response?.data || tokenErr.message;
          console.error('[google drive token error]', JSON.stringify(detail));
          throw new Error(`Failed to refresh Google OAuth token: ${JSON.stringify(detail)}`);
        }
        accessToken = tokenRes.data.access_token;
        console.log('[google drive] OAuth access token refreshed via refresh_token');

      } else if (authConfig.type === 'service_account' && authConfig.client_email && authConfig.private_key) {
        // ── Service account with domain delegation ───────────────────────────
        // Only works with Google Workspace accounts that have delegation enabled.
        // For personal Gmail, use the oauth refresh_token flow above instead.
        const delegateEmail = authConfig.delegate_email || null;
        const jwtClient = new GoogleJWT({
          key:     authConfig.private_key,
          email:   authConfig.client_email,
          scopes:  ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'],
          subject: delegateEmail,
        });
        const { access_token } = await jwtClient.authorize();
        accessToken = access_token;
        console.log('[google drive] JWT token generated for', authConfig.client_email,
          delegateEmail ? `(delegating to ${delegateEmail})` : '(no delegation)');

      } else if (authConfig.access_token) {
        // ── Static access token (fallback, expires in 1 hour) ───────────────
        accessToken = authConfig.access_token;
        console.log('[google drive] Using static access token from config');
      }
    } catch (err: any) {
      console.error('[google drive auth error]', err.message);
      throw new Error(`Google Drive auth error: ${err.message}`);
    }
  }

  // Fallback to environment variable
  if (!accessToken) {
    accessToken = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  }

  if (!accessToken) {
    throw new Error('Google Drive credentials not configured. Please configure the service account in Admin → Settings → Google Drive.');
  }

  // Read file
  const fileBuffer = fs.readFileSync(opts.localPath);

  // ── 1. Resolve / create the target folder path ───────────────────────────
  // Walk ClassName / YYYY-MM-DD [/ EventName] inside the configured root folder
  let targetFolderId = folderId;
  let classFolderId: string | null = null; // ID of the first-level (class) subfolder

  if (opts.driveFolderName) {
    const parts = opts.driveFolderName.split('/').map(p => p.trim()).filter(Boolean);
    let currentFolderId = folderId;

    for (let i = 0; i < parts.length; i++) {
      const folderName = parts[i];
      // Check if sub-folder already exists
      const existing = await axios.get<{ files: { id: string }[] }>(
        'https://www.googleapis.com/drive/v3/files',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: {
            q: `name='${folderName.replace(/'/g, "\\'")}' and '${currentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id)',
            spaces: 'drive',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
          },
        }
      );

      if (existing.data.files?.length > 0) {
        currentFolderId = existing.data.files[0].id;
      } else {
        // Create the sub-folder
        const created = await axios.post<{ id: string }>(
          'https://www.googleapis.com/drive/v3/files',
          {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [currentFolderId],
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            params: { fields: 'id', supportsAllDrives: true },
          }
        );
        currentFolderId = created.data.id;
      }
      // Capture the first-level folder ID (the class/section folder)
      if (i === 0) classFolderId = currentFolderId;
    }
    targetFolderId = currentFolderId;
  }

  // ── 2. Upload the file directly into the target folder (multipart) ────────
  // Using multipart upload sets parents at creation time — no patch needed.
  const FormDataNode = (await import('form-data')).default;
  const form = new FormDataNode();

  // Metadata part
  form.append('metadata', JSON.stringify({
    name: opts.originalName,
    parents: [targetFolderId],
  }), { contentType: 'application/json' });

  // Media part
  form.append('file', fileBuffer, {
    filename: opts.originalName,
    contentType: opts.mimeType,
  });

  let uploadResponse: { id: string; webViewLink: string; webContentLink?: string };
  try {
    const res = await axios.post<{ id: string; webViewLink: string; webContentLink?: string }>(
      // supportsAllDrives=true  → file is billed to the folder owner's quota, not the service account
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink,webContentLink',
      form,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...form.getHeaders(),
        },
      }
    );
    uploadResponse = res.data;
  } catch (uploadErr: any) {
    const googleMsg = uploadErr.response?.data?.error?.message || uploadErr.message;
    console.error('[google drive upload 403 detail]', JSON.stringify(uploadErr.response?.data || {}));
    throw new Error(`Google Drive upload failed: ${googleMsg}`);
  }

  // Log to audit
  if (opts.actorId) {
    await pool.query(
      `INSERT INTO audit_logs (school_id, actor_id, actor_name, actor_role, action, entity_type, metadata, storage_path)
       VALUES ($1, $2, $3, $4, 'upload_photo', 'google_drive_media', $5, $6)`,
      [
        opts.schoolId,
        opts.actorId,
        opts.actorName || null,
        opts.actorRole || null,
        JSON.stringify({
          file_name: opts.originalName,
          file_size: fileBuffer.length,
          drive_file_id: uploadResponse.id,
          drive_url: uploadResponse.webViewLink,
          folder_path: opts.driveFolderName || null,
        }),
        `google_drive:${uploadResponse.id}`,
      ]
    ).catch(e => console.error('[audit log]', e));
  }

  fs.unlink(opts.localPath, () => {});

  return {
    driveFileId: uploadResponse.id,
    driveUrl: uploadResponse.webViewLink || uploadResponse.webContentLink || '',
    storagePath: `google_drive:${uploadResponse.id}`,
    classFolderId: classFolderId,
  };
}

/**
 * Delete a file from Supabase Storage and log the deletion.
 */
export async function deleteFile(storagePath: string | null, auditOpts?: {
  schoolId: string; actorId: string; actorName?: string; actorRole?: string; entityType?: string;
}): Promise<void> {
  if (!storagePath) return;
  // Old local path — delete from disk
  if (storagePath.startsWith('./') || storagePath.startsWith('/') || storagePath.includes('\\')) {
    if (fs.existsSync(storagePath)) fs.unlink(storagePath, () => {});
    return;
  }
  const supabase = getSupabase();
  if (supabase) await supabase.storage.from(BUCKET).remove([storagePath]);

  if (auditOpts) {
    await pool.query(
      `INSERT INTO audit_logs (school_id, actor_id, actor_name, actor_role, action, entity_type, storage_path, metadata)
       VALUES ($1, $2, $3, $4, 'file_deleted', $5, $6, $7)`,
      [auditOpts.schoolId, auditOpts.actorId, auditOpts.actorName || null, auditOpts.actorRole || null,
       auditOpts.entityType || 'file', storagePath, JSON.stringify({ storage_path: storagePath })]
    ).catch(e => console.error('[audit log delete]', e));
  }
}

/**
 * Get a public URL for a stored path.
 * Handles both old local paths and new Supabase paths.
 */
export function getPublicUrl(storagePath: string | null): string | null {
  if (!storagePath) return null;
  // Old local disk path
  if (storagePath.startsWith('./') || storagePath.startsWith('/') || storagePath.includes('\\')) {
    const filename = path.basename(storagePath);
    if (storagePath.includes('students')) return `/uploads/students/${filename}`;
    if (storagePath.includes('logos')) return `/uploads/logos/${filename}`;
    if (storagePath.includes('resources')) return `/uploads/resources/${filename}`;
    return `/uploads/${filename}`;
  }
  // Already a full URL (shouldn't happen but guard anyway)
  if (storagePath.startsWith('http')) return storagePath;
  // Supabase storage path
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Log a message (communication) to audit_logs.
 */
export async function auditMessage(opts: {
  schoolId: string;
  actorId: string;
  actorName: string;
  actorRole: 'teacher' | 'parent';
  entityId: string;  // message id
  meta: Record<string, any>;
}): Promise<void> {
  await pool.query(
    `INSERT INTO audit_logs (school_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, $3, $4, 'message_sent', 'message', $5, $6)`,
    [opts.schoolId, opts.actorId, opts.actorName, opts.actorRole, opts.entityId, JSON.stringify(opts.meta)]
  ).catch(e => console.error('[audit message]', e));
}

/**
 * Cleanup expired files from Supabase Storage for a school.
 * Called by the scheduled cleanup job.
 */
export async function cleanupExpiredFiles(schoolId: string): Promise<{ deleted: number; errors: number }> {
  let deleted = 0;
  let errors = 0;
  const supabase = getSupabase();

  const expired = await pool.query(
    `SELECT id, storage_path, entity_type FROM audit_logs
     WHERE school_id = $1 AND expires_at IS NOT NULL AND expires_at < now()
       AND storage_path IS NOT NULL AND action != 'file_deleted'`,
    [schoolId]
  ).catch(() => ({ rows: [] }));

  for (const row of expired.rows) {
    try {
      if (row.storage_path) {
        if (supabase && !row.storage_path.startsWith('/') && !row.storage_path.includes('\\')) {
          await supabase.storage.from(BUCKET).remove([row.storage_path]);
        } else if (row.storage_path.startsWith('/') || row.storage_path.includes('\\')) {
          if (fs.existsSync(row.storage_path)) fs.unlink(row.storage_path, () => {});
        }
      }
      await pool.query(
        `UPDATE audit_logs SET action = 'file_deleted', metadata = metadata || '{"auto_deleted": true}'
         WHERE id = $1`,
        [row.id]
      );
      deleted++;
    } catch { errors++; }
  }

  await pool.query(
    `DELETE FROM teacher_notes WHERE school_id = $1 AND expires_at < now()`,
    [schoolId]
  ).catch(() => {});

  return { deleted, errors };
}
