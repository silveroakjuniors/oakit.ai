// @ts-ignore: supabase client may be unavailable in some dev environments
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { pool } from './db';

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
