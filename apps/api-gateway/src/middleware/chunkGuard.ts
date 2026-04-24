/**
 * chunkGuard.ts — Franchise Chunk Protection (Req 3.6)
 *
 * Prevents school-scoped users (admin, principal, teacher) from deleting,
 * modifying, or re-ingesting franchise-owned curriculum documents and chunks.
 *
 * Only applies to schools that ARE franchise members (Req 3.6f).
 * Independent schools retain full control.
 */

import { Request, Response, NextFunction } from 'express';
import { pool } from '../lib/db';

const FRANCHISE_CHUNK_ERROR = { error: 'Franchise-owned chunks cannot be modified by school admins' };
const FRANCHISE_DOC_DELETE_ERROR = { error: 'Franchise-owned curriculum cannot be deleted by school admins' };
const FRANCHISE_DOC_REPLACE_ERROR = { error: 'Franchise-owned curriculum cannot be replaced by school admins' };

export async function chunkGuard(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;

  // Only applies to school-scoped roles
  if (!user || !['admin', 'principal', 'teacher'].includes(user.role)) return next();
  if (!user.school_id) return next();

  // Only applies to mutating methods
  if (!['DELETE', 'PUT', 'PATCH', 'POST'].includes(req.method)) return next();

  // Check if this school is a franchise member (Req 3.6f)
  const membership = await pool.query(
    'SELECT franchise_id FROM franchise_memberships WHERE school_id = $1',
    [user.school_id]
  ).catch(() => ({ rows: [] }));

  if (membership.rows.length === 0) return next(); // independent school — no restriction

  const franchiseId = membership.rows[0].franchise_id;

  // Check if the target resource is franchise-owned
  const path = req.path;

  // Chunk mutation
  if (/\/chunks\/([a-f0-9-]+)/.test(path)) {
    const chunkId = path.match(/\/chunks\/([a-f0-9-]+)/)?.[1];
    if (chunkId) {
      const chunk = await pool.query(
        'SELECT franchise_id FROM curriculum_chunks WHERE id = $1',
        [chunkId]
      ).catch(() => ({ rows: [] }));
      if (chunk.rows[0]?.franchise_id === franchiseId) {
        return res.status(403).json(FRANCHISE_CHUNK_ERROR);
      }
    }
  }

  // Document deletion
  if (req.method === 'DELETE' && /\/curriculum\//.test(path)) {
    const docId = path.match(/\/curriculum\/([a-f0-9-]+)/)?.[1];
    if (docId) {
      const doc = await pool.query(
        'SELECT franchise_id FROM curriculum_documents WHERE id = $1',
        [docId]
      ).catch(() => ({ rows: [] }));
      if (doc.rows[0]?.franchise_id === franchiseId) {
        return res.status(403).json(FRANCHISE_DOC_DELETE_ERROR);
      }
    }
  }

  // Document re-ingest / replace (POST to upload with same class)
  if (req.method === 'POST' && /\/curriculum\/upload/.test(path)) {
    const classId = req.body?.class_id || req.query?.class_id;
    if (classId) {
      const existing = await pool.query(
        `SELECT franchise_id FROM curriculum_documents
         WHERE class_id = $1 AND franchise_id IS NOT NULL LIMIT 1`,
        [classId]
      ).catch(() => ({ rows: [] }));
      if (existing.rows.length > 0) {
        return res.status(403).json(FRANCHISE_DOC_REPLACE_ERROR);
      }
    }
  }

  return next();
}
