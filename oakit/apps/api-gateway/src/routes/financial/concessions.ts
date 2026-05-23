import { Router } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, permissionGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify);

// ── POST / — Create concession (PENDING_APPROVAL) ────────────────────────────
router.post('/', permissionGuard('MANAGE_CONCESSION'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { student_id, fee_head_id, type, value, reason } = req.body;

    if (!student_id || !fee_head_id || !type || value === undefined || !reason)
      return res.status(400).json({ error: 'student_id, fee_head_id, type, value, reason are required' });
    if (!['fixed', 'percentage'].includes(type))
      return res.status(400).json({ error: 'type must be fixed or percentage' });
    if (value <= 0)
      return res.status(400).json({ error: 'value must be > 0' });

    // Validate against fee account if it exists (not mandatory — concession can be pre-created)
    const acctResult = await pool.query(
      `SELECT assigned_amount FROM student_fee_accounts
       WHERE student_id = $1 AND fee_head_id = $2 AND school_id = $3 AND deleted_at IS NULL`,
      [student_id, fee_head_id, schoolId]
    );
    if (acctResult.rows.length > 0) {
      const assignedAmount = parseFloat(acctResult.rows[0].assigned_amount);
      const effectiveValue = type === 'percentage' ? (value / 100) * assignedAmount : value;
      if (effectiveValue > assignedAmount)
        return res.status(400).json({ error: 'Concession value exceeds the total fee amount for this fee head' });
    }

    const result = await pool.query(
      `INSERT INTO concessions (school_id, student_id, fee_head_id, type, value, reason, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,'pending_approval',$7) RETURNING *`,
      [schoolId, student_id, fee_head_id, type, value, reason, req.user!.id]
    );

    pool.query(
      `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, affected_record_id, after_data)
       VALUES ($1,$2,$3,'CREATE_CONCESSION','fees',$4,$5)`,
      [schoolId, req.user!.id, req.user!.role, result.rows[0].id,
       JSON.stringify({ student_id, fee_head_id, type, value, reason })]
    ).catch(() => {});

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[concessions POST]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET / — List all concessions (filterable by status) ──────────────────────
router.get('/', permissionGuard('MANAGE_CONCESSION'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { status } = req.query as { status?: string };

    const validStatuses = ['pending_approval', 'approved', 'rejected'];
    if (status && !validStatuses.includes(status))
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });

    const params: any[] = [schoolId];
    let filter = '';
    if (status) { filter = ` AND c.status = $2`; params.push(status); }

    const result = await pool.query(
      `SELECT
         ROW_NUMBER() OVER (ORDER BY c.created_at DESC) AS sl_no,
         c.*,
         s.name AS student_name,
         cl.name AS class_name,
         fh.name AS fee_head_name
       FROM concessions c
       JOIN students s ON s.id = c.student_id
       LEFT JOIN classes cl ON cl.id = s.class_id
       JOIN fee_heads fh ON fh.id = c.fee_head_id
       WHERE c.school_id = $1 AND c.deleted_at IS NULL${filter}
       ORDER BY c.created_at DESC`,
      params
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[concessions GET /]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /pending — List pending concessions ──────────────────────────────────
router.get('/pending', permissionGuard('APPROVE_CONCESSION'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const result = await pool.query(
      `SELECT
         ROW_NUMBER() OVER (ORDER BY c.created_at DESC) AS sl_no,
         c.*,
         s.name AS student_name,
         cl.name AS class_name,
         fh.name AS fee_head_name
       FROM concessions c
       JOIN students s ON s.id = c.student_id
       LEFT JOIN classes cl ON cl.id = s.class_id
       JOIN fee_heads fh ON fh.id = c.fee_head_id
       WHERE c.school_id = $1 AND c.status = 'pending_approval' AND c.deleted_at IS NULL
       ORDER BY c.created_at DESC`,
      [schoolId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[concessions GET /pending]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /:id/approve — Approve a concession ─────────────────────────────────
// Always updates concessions.status = 'approved'.
// If a student_fee_account exists for this fee head, also reduces the outstanding balance.
router.post('/:id/approve', permissionGuard('APPROVE_CONCESSION'), async (req, res) => {
  const client = await pool.connect();
  try {
    const schoolId = req.user!.school_id;
    const { id } = req.params;

    await client.query('BEGIN');

    // 1. Fetch and validate the concession
    const concResult = await client.query(
      `SELECT * FROM concessions WHERE id = $1 AND school_id = $2 AND status = 'pending_approval'`,
      [id, schoolId]
    );
    if (concResult.rows.length === 0) {
      await client.query('ROLLBACK');
      // Check if already approved
      const existing = await pool.query(
        `SELECT status FROM concessions WHERE id = $1 AND school_id = $2`, [id, schoolId]
      );
      if (existing.rows[0]?.status === 'approved') {
        return res.json({ success: true, already_approved: true });
      }
      return res.status(404).json({ error: 'Pending concession not found' });
    }
    const conc = concResult.rows[0];

    // 2. Update concession status — this ALWAYS happens
    await client.query(
      `UPDATE concessions
       SET status = 'approved', approved_by = $1, approved_at = now()
       WHERE id = $2`,
      [req.user!.id, id]
    );

    // 3. If a fee account exists, reduce the outstanding balance
    let concessionAmount = 0;
    let newBalance: number | null = null;

    const acctResult = await client.query(
      `SELECT * FROM student_fee_accounts
       WHERE student_id = $1 AND fee_head_id = $2 AND school_id = $3 AND deleted_at IS NULL`,
      [conc.student_id, conc.fee_head_id, schoolId]
    );

    if (acctResult.rows.length > 0) {
      const acct = acctResult.rows[0];
      const assignedAmount = parseFloat(acct.assigned_amount);
      concessionAmount = conc.type === 'percentage'
        ? (parseFloat(conc.value) / 100) * assignedAmount
        : parseFloat(conc.value);
      newBalance = Math.max(0, parseFloat(acct.outstanding_balance) - concessionAmount);
      const newStatus = newBalance === 0 ? 'paid' : 'partially_paid';

      await client.query(
        `UPDATE student_fee_accounts
         SET outstanding_balance = $1, status = $2
         WHERE id = $3`,
        [newBalance, newStatus, acct.id]
      );
    }

    pool.query(
      `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, affected_record_id, after_data)
       VALUES ($1,$2,$3,'APPROVE_CONCESSION','fees',$4,$5)`,
      [schoolId, req.user!.id, req.user!.role, id,
       JSON.stringify({ concession_amount: concessionAmount, new_balance: newBalance })]
    ).catch(() => {});

    await client.query('COMMIT');
    return res.json({ success: true, concession_amount: concessionAmount, new_balance: newBalance });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[concessions POST /:id/approve]', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── POST /:id/reject — Reject a concession ───────────────────────────────────
router.post('/:id/reject', permissionGuard('APPROVE_CONCESSION'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { id } = req.params;
    const { rejection_reason } = req.body;

    const result = await pool.query(
      `UPDATE concessions
       SET status = 'rejected', approved_by = $1, approved_at = now(), rejection_reason = $2
       WHERE id = $3 AND school_id = $4 AND status = 'pending_approval'
       RETURNING *`,
      [req.user!.id, rejection_reason || null, id, schoolId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Pending concession not found' });

    pool.query(
      `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, affected_record_id, after_data)
       VALUES ($1,$2,$3,'REJECT_CONCESSION','fees',$4,$5)`,
      [schoolId, req.user!.id, req.user!.role, id, JSON.stringify({ rejection_reason })]
    ).catch(() => {});

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[concessions POST /:id/reject]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /bulk-approve — Bulk approve concessions ────────────────────────────
router.post('/bulk-approve', permissionGuard('APPROVE_CONCESSION'), async (req, res) => {
  const client = await pool.connect();
  try {
    const schoolId = req.user!.school_id;
    const { ids } = req.body as { ids: string[] };
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ error: 'ids array is required' });

    await client.query('BEGIN');
    let approved = 0;

    for (const id of ids) {
      const concResult = await client.query(
        `SELECT * FROM concessions WHERE id = $1 AND school_id = $2 AND status = 'pending_approval'`,
        [id, schoolId]
      );
      if (concResult.rows.length === 0) continue;
      const conc = concResult.rows[0];

      // Always update concession status
      await client.query(
        `UPDATE concessions SET status = 'approved', approved_by = $1, approved_at = now() WHERE id = $2`,
        [req.user!.id, id]
      );

      // Update fee account balance if it exists
      const acctResult = await client.query(
        `SELECT * FROM student_fee_accounts
         WHERE student_id = $1 AND fee_head_id = $2 AND school_id = $3 AND deleted_at IS NULL`,
        [conc.student_id, conc.fee_head_id, schoolId]
      );
      if (acctResult.rows.length > 0) {
        const acct = acctResult.rows[0];
        const assignedAmount = parseFloat(acct.assigned_amount);
        const concessionAmount = conc.type === 'percentage'
          ? (parseFloat(conc.value) / 100) * assignedAmount
          : parseFloat(conc.value);
        const newBalance = Math.max(0, parseFloat(acct.outstanding_balance) - concessionAmount);
        const newStatus = newBalance === 0 ? 'paid' : 'partially_paid';
        await client.query(
          `UPDATE student_fee_accounts SET outstanding_balance = $1, status = $2 WHERE id = $3`,
          [newBalance, newStatus, acct.id]
        );
      }

      pool.query(
        `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, affected_record_id)
         VALUES ($1,$2,$3,'APPROVE_CONCESSION','fees',$4)`,
        [schoolId, req.user!.id, req.user!.role, id]
      ).catch(() => {});

      approved++;
    }

    await client.query('COMMIT');
    return res.json({ success: true, approved });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[concessions POST /bulk-approve]', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── PATCH /:id — Edit a pending concession ───────────────────────────────────
router.patch('/:id', permissionGuard('APPROVE_CONCESSION'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { id } = req.params;
    const { value, reason } = req.body as { value?: number; reason?: string };

    const concResult = await pool.query(
      `SELECT c.*, sfa.assigned_amount
       FROM concessions c
       LEFT JOIN student_fee_accounts sfa
         ON sfa.fee_head_id = c.fee_head_id AND sfa.student_id = c.student_id
         AND sfa.school_id = c.school_id AND sfa.deleted_at IS NULL
       WHERE c.id = $1 AND c.school_id = $2 AND c.deleted_at IS NULL`,
      [id, schoolId]
    );
    if (concResult.rows.length === 0)
      return res.status(404).json({ error: 'Concession not found' });

    const concession = concResult.rows[0];
    if (concession.status !== 'pending_approval')
      return res.status(409).json({ error: 'Only pending concessions can be edited' });

    if (value !== undefined && concession.assigned_amount) {
      const assignedAmount = parseFloat(concession.assigned_amount);
      const effectiveAmount = concession.type === 'percentage' ? (value / 100) * assignedAmount : value;
      if (effectiveAmount > assignedAmount)
        return res.status(400).json({ error: 'Concession value exceeds the total fee amount for this fee head' });
    }

    const result = await pool.query(
      `UPDATE concessions
       SET value = COALESCE($1, value), reason = COALESCE($2, reason)
       WHERE id = $3 AND school_id = $4 RETURNING *`,
      [value ?? null, reason ?? null, id, schoolId]
    );

    pool.query(
      `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, affected_record_id, after_data)
       VALUES ($1,$2,$3,'EDIT_CONCESSION','fees',$4,$5)`,
      [schoolId, req.user!.id, req.user!.role, id, JSON.stringify({ value, reason })]
    ).catch(() => {});

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[concessions PATCH /:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /student/:studentId — List concessions for a student ─────────────────
router.get('/student/:studentId', permissionGuard('VIEW_FEES'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { studentId } = req.params;
    const result = await pool.query(
      `SELECT ROW_NUMBER() OVER (ORDER BY c.created_at DESC) AS sl_no,
              c.*, fh.name AS fee_head_name
       FROM concessions c
       JOIN fee_heads fh ON fh.id = c.fee_head_id
       WHERE c.student_id = $1 AND c.school_id = $2 AND c.deleted_at IS NULL
       ORDER BY c.created_at DESC`,
      [studentId, schoolId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[concessions GET /student/:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
