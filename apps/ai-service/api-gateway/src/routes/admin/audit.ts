import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { cleanupExpiredFiles } from '../../lib/storage';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('admin', 'principal'));

// GET /api/v1/admin/audit?type=uploads|messages|all&page=1&limit=50
router.get('/', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const type = (req.query.type as string) || 'all';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const offset = (page - 1) * limit;

    let actionFilter = '';
    if (type === 'uploads') {
      actionFilter = `AND action IN ('upload_note','upload_photo','upload_logo','upload_resource','file_deleted')`;
    } else if (type === 'messages') {
      actionFilter = `AND action = 'message_sent'`;
    }

    const [rows, countRow] = await Promise.all([
      pool.query(
        `SELECT id, actor_name, actor_role, action, entity_type, entity_id,
                metadata, storage_path, expires_at, created_at
         FROM audit_logs
         WHERE school_id = $1 ${actionFilter}
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [school_id, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*)::int as total FROM audit_logs WHERE school_id = $1 ${actionFilter}`,
        [school_id]
      ),
    ]);

    return res.json({
      logs: rows.rows,
      total: countRow.rows[0].total,
      page,
      limit,
      pages: Math.ceil(countRow.rows[0].total / limit),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/audit/messages — all parent-teacher messages for admin view
router.get('/messages', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const offset = (page - 1) * limit;
    const teacher_id = req.query.teacher_id as string;
    const student_id = req.query.student_id as string;

    let where = 'WHERE m.school_id = $1';
    const params: any[] = [school_id];
    if (teacher_id) { params.push(teacher_id); where += ` AND m.teacher_id = $${params.length}`; }
    if (student_id) { params.push(student_id); where += ` AND m.student_id = $${params.length}`; }

    const [rows, countRow] = await Promise.all([
      pool.query(
        `SELECT m.id, m.sender_role, m.body, m.sent_at, m.read_at,
                u.name as teacher_name, pu.name as parent_name, pu.mobile as parent_mobile,
                st.name as student_name, c.name as class_name, sec.label as section_label
         FROM messages m
         JOIN users u ON u.id = m.teacher_id
         JOIN parent_users pu ON pu.id = m.parent_id
         JOIN students st ON st.id = m.student_id
         JOIN classes c ON c.id = st.class_id
         JOIN sections sec ON sec.id = st.section_id
         ${where}
         ORDER BY m.sent_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*)::int as total FROM messages m ${where}`,
        params
      ),
    ]);

    return res.json({
      messages: rows.rows,
      total: countRow.rows[0].total,
      page, limit,
      pages: Math.ceil(countRow.rows[0].total / limit),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/audit/cleanup — trigger manual cleanup of expired files
router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await cleanupExpiredFiles(school_id);
    return res.json({ message: `Cleanup complete`, ...result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/audit/ai-queries — AI query log with user names
router.get('/ai-queries', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const offset = (page - 1) * limit;
    const outcome = req.query.outcome as string;

    const baseParams: any[] = [school_id];
    let outcomeWhere = '';
    if (outcome) {
      baseParams.push(outcome);
      outcomeWhere = `AND al.metadata->>'outcome' = $${baseParams.length}`;
    }

    const [rows, countRow] = await Promise.all([
      pool.query(
        `SELECT
           al.id, al.actor_id, al.actor_role, al.created_at,
           al.metadata,
           COALESCE(u.name, pu.name, 'Unknown') as actor_name,
           COALESCE(u.mobile, pu.mobile) as actor_mobile
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.actor_id::uuid AND u.school_id = $1
         LEFT JOIN parent_users pu ON pu.id = al.actor_id::uuid AND pu.school_id = $1
         WHERE al.school_id = $1 AND al.action = 'ai_query' ${outcomeWhere}
         ORDER BY al.created_at DESC
         LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}`,
        [...baseParams, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*)::int as total FROM audit_logs al
         WHERE al.school_id = $1 AND al.action = 'ai_query' ${outcomeWhere}`,
        baseParams
      ),
    ]);

    return res.json({
      queries: rows.rows,
      total: countRow.rows[0].total,
      page, limit,
      pages: Math.ceil(countRow.rows[0].total / limit),
    });
  } catch (err) {
    console.error('[ai-queries]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/admin/audit/ai-queries — delete selected log entries
router.delete('/ai-queries', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { ids } = req.body; // array of audit_log ids
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    await pool.query(
      `DELETE FROM audit_logs WHERE school_id = $1 AND id = ANY($2::uuid[]) AND action = 'ai_query'`,
      [school_id, ids]
    );
    return res.json({ message: `${ids.length} log(s) deleted` });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/audit/safety-alerts — unread + recent safety alerts
router.get('/safety-alerts', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const includeAll = req.query.all === 'true';

    const result = await pool.query(
      `SELECT id, actor_id, actor_name, actor_role, query_text, dismissed_at, created_at
       FROM safety_alerts
       WHERE school_id = $1 ${includeAll ? '' : 'AND dismissed_at IS NULL'}
       ORDER BY created_at DESC
       LIMIT 100`,
      [school_id]
    );

    const unread = await pool.query(
      `SELECT COUNT(*)::int as count FROM safety_alerts WHERE school_id = $1 AND dismissed_at IS NULL`,
      [school_id]
    );

    return res.json({ alerts: result.rows, unread_count: unread.rows[0].count });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/audit/safety-alerts/:id/dismiss
router.post('/safety-alerts/:id/dismiss', async (req: Request, res: Response) => {
  try {
    const { school_id, user_id } = req.user!;
    await pool.query(
      `UPDATE safety_alerts SET dismissed_by = $1, dismissed_at = now()
       WHERE id = $2 AND school_id = $3`,
      [user_id, req.params.id, school_id]
    );
    return res.json({ message: 'Alert dismissed' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/audit/safety-alerts/dismiss-all
router.post('/safety-alerts/dismiss-all', async (req: Request, res: Response) => {
  try {
    const { school_id, user_id } = req.user!;
    const result = await pool.query(
      `UPDATE safety_alerts SET dismissed_by = $1, dismissed_at = now()
       WHERE school_id = $2 AND dismissed_at IS NULL`,
      [user_id, school_id]
    );
    return res.json({ message: `${result.rowCount} alert(s) dismissed` });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
