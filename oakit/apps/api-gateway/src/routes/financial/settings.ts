import { Router } from 'express';
import { pool } from '../../lib/db';
import { redis } from '../../lib/redis';
import { jwtVerify, roleGuard } from '../../middleware/auth';

const router = Router();

// All routes require authentication
router.use(jwtVerify);

// ── GET /api/v1/financial/settings ───────────────────────────────────────────
// Returns the financial module status for the requesting user's school.
router.get('/settings', async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    if (!schoolId) {
      return res.status(400).json({ error: 'No school associated with this account' });
    }

    const result = await pool.query(
      `SELECT is_enabled, expense_module_enabled, updated_at
       FROM financial_module_settings
       WHERE school_id = $1`,
      [schoolId]
    );

    if (result.rows.length === 0) {
      // Default: both enabled
      return res.json({ is_enabled: true, expense_module_enabled: true });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[financial/settings GET]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/v1/financial/settings ───────────────────────────────────────────
// Enable/disable the financial module or expense sub-module.
// Only super_admin and franchise_admin may call this.
router.put(
  '/settings',
  roleGuard('super_admin', 'franchise_admin'),
  async (req, res) => {
    try {
      const { school_id, is_enabled, expense_module_enabled } = req.body as {
        school_id: string;
        is_enabled?: boolean;
        expense_module_enabled?: boolean;
      };

      if (!school_id) {
        return res.status(400).json({ error: 'school_id is required' });
      }

      // franchise_admin may only manage schools within their franchise
      if (req.user!.role === 'franchise_admin') {
        const membership = await pool.query(
          `SELECT 1 FROM franchise_memberships
           WHERE franchise_id = $1 AND school_id = $2`,
          [(req.user as any).franchise_id, school_id]
        );
        if (membership.rows.length === 0) {
          return res.status(403).json({ error: 'School is not in your franchise' });
        }
      }

      // Upsert the settings row
      const updates: string[] = [];
      const values: any[] = [school_id];
      let idx = 2;

      if (is_enabled !== undefined) {
        updates.push(`is_enabled = $${idx++}`);
        values.push(is_enabled);
      }
      if (expense_module_enabled !== undefined) {
        updates.push(`expense_module_enabled = $${idx++}`);
        values.push(expense_module_enabled);
      }
      updates.push(`updated_at = now()`);

      await pool.query(
        `INSERT INTO financial_module_settings (school_id, is_enabled, expense_module_enabled)
         VALUES ($1, COALESCE($2, true), COALESCE($3, true))
         ON CONFLICT (school_id) DO UPDATE SET ${updates.join(', ')}`,
        [school_id, is_enabled ?? null, expense_module_enabled ?? null]
      );

      // Invalidate Redis cache so the guard picks up the new value immediately
      await redis.del(`financial_module:${school_id}`);

      return res.json({ success: true, school_id });
    } catch (err) {
      console.error('[financial/settings PUT]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ── GET /api/v1/financial/permissions ────────────────────────────────────────
// Returns the current user's effective financial permissions.
router.get('/permissions', async (req, res) => {
  try {
    const userId = req.user!.id;

    const result = await pool.query(
      `SELECT financial_permissions FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const overrides: Record<string, boolean> = result.rows[0].financial_permissions || {};
    // Merge JWT permissions with per-user overrides stored in the DB
    const jwtPerms: string[] = (req.user as any).permissions || [];
    const effectivePerms = jwtPerms.filter(p => overrides[p] !== false);
    // Add any permissions explicitly granted via overrides
    Object.entries(overrides).forEach(([perm, granted]) => {
      if (granted && !effectivePerms.includes(perm)) effectivePerms.push(perm);
    });

    return res.json({ permissions: effectivePerms, overrides });
  } catch (err) {
    console.error('[financial/permissions GET]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/v1/financial/permissions/:userId ─────────────────────────────────
// Principal only — update a Finance_Manager's financial permission set.
router.put(
  '/permissions/:userId',
  roleGuard('principal'),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { permissions } = req.body as { permissions: Record<string, boolean> };
      const schoolId = req.user!.school_id;

      if (!permissions || typeof permissions !== 'object') {
        return res.status(400).json({ error: 'permissions object is required' });
      }

      // Verify the target user belongs to the same school and is a finance_manager
      const target = await pool.query(
        `SELECT id, role, school_id FROM users WHERE id = $1`,
        [userId]
      );
      if (target.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (target.rows[0].school_id !== schoolId) {
        return res.status(403).json({ error: 'User does not belong to your school' });
      }
      if (target.rows[0].role !== 'finance_manager') {
        return res.status(400).json({ error: 'Permissions can only be updated for finance_manager role' });
      }

      // Fetch before-state for audit log
      const before = await pool.query(
        `SELECT financial_permissions FROM users WHERE id = $1`,
        [userId]
      );
      const beforePerms = before.rows[0]?.financial_permissions || {};

      // Update the financial_permissions JSONB column
      await pool.query(
        `UPDATE users SET financial_permissions = $1 WHERE id = $2`,
        [JSON.stringify(permissions), userId]
      );

      // Record audit log
      await pool.query(
        `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, affected_record_id, before_data, after_data)
         VALUES ($1, $2, $3, 'UPDATE_PERMISSIONS', 'financial', $4, $5, $6)`,
        [
          schoolId,
          req.user!.id,
          req.user!.role,
          userId,
          JSON.stringify({ financial_permissions: beforePerms }),
          JSON.stringify({ financial_permissions: permissions }),
        ]
      );

      return res.json({ success: true, user_id: userId, permissions });
    } catch (err) {
      console.error('[financial/permissions PUT]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
