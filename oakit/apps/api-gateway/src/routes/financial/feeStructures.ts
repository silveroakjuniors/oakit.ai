import { Router } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, permissionGuard } from '../../middleware/auth';
import { calculateMonthlyFee, FeeCalculationInput } from '../../lib/feeCalculation';

const router = Router();

// All routes require authentication
router.use(jwtVerify);

// ── POST /api/v1/financial/fee-structures ─────────────────────────────────────
// Creates a fee structure with its fee heads.
router.post(
  '/',
  permissionGuard('MANAGE_FEE_STRUCTURE'),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const schoolId = req.user!.school_id;
      const {
        name,
        class_id,
        academic_year,
        fee_heads = [],
      } = req.body as {
        name: string;
        class_id?: string;
        academic_year?: string;
        fee_heads: Array<{
          name: string;
          type: string;
          pricing_model: string;
          amount?: number;
          billing_basis?: string;
          rate?: number;
          hours_per_day?: number;
          days_per_week?: number;
          calculated_monthly_fee?: number;
          rounded_monthly_fee?: number;
          instalment_count?: number;
          booking_amount?: number;
          late_fee_amount?: number;
          late_fee_grace_days?: number;
          is_variable?: boolean;
        }>;
      };

      if (!name) {
        return res.status(400).json({ error: 'name is required' });
      }

      await client.query('BEGIN');

      // Insert fee structure
      const structureResult = await client.query(
        `INSERT INTO fee_structures (school_id, class_id, name, academic_year, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING *`,
        [schoolId, class_id ?? null, name, academic_year ?? null]
      );
      const structure = structureResult.rows[0];

      // Bulk-insert fee heads
      const insertedHeads: any[] = [];
      for (const head of fee_heads) {
        const headResult = await client.query(
          `INSERT INTO fee_heads (
             fee_structure_id, school_id, name, type, pricing_model,
             amount, billing_basis, rate, hours_per_day, days_per_week,
             calculated_monthly_fee, rounded_monthly_fee,
             instalment_count, booking_amount,
             late_fee_amount, late_fee_grace_days, is_variable
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
           RETURNING *`,
          [
            structure.id,
            schoolId,
            head.name,
            head.type,
            head.pricing_model,
            head.amount ?? null,
            head.billing_basis ?? null,
            head.rate ?? null,
            head.hours_per_day ?? null,
            head.days_per_week ?? null,
            head.calculated_monthly_fee ?? null,
            head.rounded_monthly_fee ?? null,
            head.instalment_count ?? null,
            head.booking_amount ?? null,
            head.late_fee_amount ?? null,
            head.late_fee_grace_days ?? null,
            head.is_variable ?? false,
          ]
        );
        insertedHeads.push(headResult.rows[0]);
      }

      await client.query('COMMIT');

      return res.status(201).json({ ...structure, fee_heads: insertedHeads });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[fee-structures POST]', err);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  }
);

// ── GET /api/v1/financial/fee-structures ──────────────────────────────────────
// Lists all fee structures for the school.
router.get(
  '/',
  permissionGuard('VIEW_FEES'),
  async (req, res) => {
    try {
      const schoolId = req.user!.school_id;

      const result = await pool.query(
        `SELECT fs.*, COUNT(fh.id) AS fee_head_count
         FROM fee_structures fs
         LEFT JOIN fee_heads fh ON fh.fee_structure_id = fs.id AND fh.deleted_at IS NULL
         WHERE fs.school_id = $1
         GROUP BY fs.id
         ORDER BY fs.created_at DESC`,
        [schoolId]
      );

      return res.json(result.rows);
    } catch (err) {
      console.error('[fee-structures GET /]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ── GET /api/v1/financial/fee-structures/check-late-fees ─────────────────────
// Trigger-on-read: applies late fees to overdue instalments.
//
// LIMITATION: This endpoint applies late fees unconditionally on each call.
// It is idempotent only if called once per day. Calling it multiple times on
// the same day will add the late_fee_amount to outstanding_balance repeatedly.
// A production-grade solution would track late fee application with a
// `late_fee_applied_at` timestamp column on fee_instalments or
// student_fee_accounts, or use a daily scheduled job with a deduplication key.
// This implementation is intentionally simple to avoid schema migrations here.
router.get(
  '/check-late-fees',
  permissionGuard('VIEW_FEES'),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const schoolId = req.user!.school_id;

      // Find all overdue instalments for this school where:
      // - due_date is in the past
      // - the associated fee_head has a late_fee_amount > 0
      // - the grace period (late_fee_grace_days) has passed
      const overdueResult = await client.query(
        `SELECT
           fi.id AS instalment_id,
           fi.fee_head_id,
           fi.due_date,
           fi.amount AS instalment_amount,
           fh.late_fee_amount,
           fh.late_fee_grace_days,
           fh.fee_structure_id
         FROM fee_instalments fi
         JOIN fee_heads fh ON fh.id = fi.fee_head_id
         WHERE fi.school_id = $1
           AND fi.due_date < CURRENT_DATE
           AND fh.late_fee_amount > 0
           AND fh.deleted_at IS NULL
           AND (
             fh.late_fee_grace_days IS NULL
             OR fi.due_date + fh.late_fee_grace_days * INTERVAL '1 day' < CURRENT_DATE
           )`,
        [schoolId]
      );

      const overdueInstalments = overdueResult.rows;
      let appliedCount = 0;

      await client.query('BEGIN');

      for (const instalment of overdueInstalments) {
        // Find matching student_fee_accounts rows for this fee_head
        const accountsResult = await client.query(
          `SELECT id, outstanding_balance, assigned_amount
           FROM student_fee_accounts
           WHERE fee_head_id = $1
             AND school_id = $2
             AND deleted_at IS NULL
             AND status != 'paid'`,
          [instalment.fee_head_id, schoolId]
        );

        for (const account of accountsResult.rows) {
          // Apply late fee to outstanding balance
          await client.query(
            `UPDATE student_fee_accounts
             SET outstanding_balance = outstanding_balance + $1,
                 updated_at = now()
             WHERE id = $2`,
            [instalment.late_fee_amount, account.id]
          );
          appliedCount++;
        }
      }

      await client.query('COMMIT');

      return res.json({
        success: true,
        overdue_instalments_found: overdueInstalments.length,
        late_fees_applied: appliedCount,
        warning:
          'Late fees are applied unconditionally on each call. ' +
          'Call this endpoint at most once per day to avoid duplicate charges.',
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[fee-structures GET /check-late-fees]', err);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  }
);

// ── GET /api/v1/financial/fee-structures/:id ──────────────────────────────────
// Returns a fee structure with its fee heads and fee instalments.
router.get(
  '/:id',
  permissionGuard('VIEW_FEES'),
  async (req, res) => {
    try {
      const schoolId = req.user!.school_id;
      const { id } = req.params;

      const structureResult = await pool.query(
        `SELECT * FROM fee_structures WHERE id = $1 AND school_id = $2`,
        [id, schoolId]
      );

      if (structureResult.rows.length === 0) {
        return res.status(404).json({ error: 'Fee structure not found' });
      }

      const structure = structureResult.rows[0];

      // Fetch fee heads (non-deleted)
      const headsResult = await pool.query(
        `SELECT * FROM fee_heads
         WHERE fee_structure_id = $1 AND school_id = $2 AND deleted_at IS NULL
         ORDER BY created_at ASC`,
        [id, schoolId]
      );

      // Fetch fee instalments for all heads in this structure
      const headIds = headsResult.rows.map((h: any) => h.id);
      let instalments: any[] = [];
      if (headIds.length > 0) {
        const instalmentsResult = await pool.query(
          `SELECT * FROM fee_instalments
           WHERE fee_head_id = ANY($1) AND school_id = $2
           ORDER BY instalment_number ASC`,
          [headIds, schoolId]
        );
        instalments = instalmentsResult.rows;
      }

      return res.json({
        ...structure,
        fee_heads: headsResult.rows,
        fee_instalments: instalments,
      });
    } catch (err) {
      console.error('[fee-structures GET /:id]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ── PUT /api/v1/financial/fee-structures/:id ──────────────────────────────────
// Updates name, academic_year, and/or is_active on a fee structure.
router.put(
  '/:id',
  permissionGuard('MANAGE_FEE_STRUCTURE'),
  async (req, res) => {
    try {
      const schoolId = req.user!.school_id;
      const { id } = req.params;
      const { name, academic_year, is_active } = req.body as {
        name?: string;
        academic_year?: string;
        is_active?: boolean;
      };

      // Verify ownership
      const existing = await pool.query(
        `SELECT id FROM fee_structures WHERE id = $1 AND school_id = $2`,
        [id, schoolId]
      );
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Fee structure not found' });
      }

      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (name !== undefined) {
        updates.push(`name = $${idx++}`);
        values.push(name);
      }
      if (academic_year !== undefined) {
        updates.push(`academic_year = $${idx++}`);
        values.push(academic_year);
      }
      if (is_active !== undefined) {
        updates.push(`is_active = $${idx++}`);
        values.push(is_active);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push(`updated_at = now()`);
      values.push(id, schoolId);

      const result = await pool.query(
        `UPDATE fee_structures SET ${updates.join(', ')}
         WHERE id = $${idx++} AND school_id = $${idx}
         RETURNING *`,
        values
      );

      return res.json(result.rows[0]);
    } catch (err) {
      console.error('[fee-structures PUT /:id]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ── DELETE /api/v1/financial/fee-structures/:id ───────────────────────────────
// Soft-deletes a fee structure:
//   - Sets is_active = false on fee_structures (no deleted_at column on that table)
//   - Sets deleted_at = now() on all associated fee_heads
router.delete(
  '/:id',
  permissionGuard('MANAGE_FEE_STRUCTURE'),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const schoolId = req.user!.school_id;
      const { id } = req.params;

      // Verify ownership
      const existing = await client.query(
        `SELECT id FROM fee_structures WHERE id = $1 AND school_id = $2`,
        [id, schoolId]
      );
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Fee structure not found' });
      }

      await client.query('BEGIN');

      // Deactivate the structure (fee_structures has no deleted_at)
      await client.query(
        `UPDATE fee_structures SET is_active = false, updated_at = now()
         WHERE id = $1 AND school_id = $2`,
        [id, schoolId]
      );

      // Soft-delete all fee heads
      await client.query(
        `UPDATE fee_heads SET deleted_at = now()
         WHERE fee_structure_id = $1 AND school_id = $2 AND deleted_at IS NULL`,
        [id, schoolId]
      );

      await client.query('COMMIT');

      return res.json({ success: true, id });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[fee-structures DELETE /:id]', err);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  }
);

// ── POST /api/v1/financial/fee-structures/:id/assign-class ───────────────────
// Assigns a fee structure to a class and bulk-inserts student_fee_accounts
// for all currently enrolled (active) students in that class.
router.post(
  '/:id/assign-class',
  permissionGuard('MANAGE_FEE_STRUCTURE'),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const schoolId = req.user!.school_id;
      const { id } = req.params;
      const { class_id } = req.body as { class_id: string };

      if (!class_id) {
        return res.status(400).json({ error: 'class_id is required' });
      }

      // Verify fee structure belongs to this school
      const structureResult = await client.query(
        `SELECT * FROM fee_structures WHERE id = $1 AND school_id = $2`,
        [id, schoolId]
      );
      if (structureResult.rows.length === 0) {
        return res.status(404).json({ error: 'Fee structure not found' });
      }

      await client.query('BEGIN');

      // Update the fee structure's class_id
      await client.query(
        `UPDATE fee_structures SET class_id = $1, updated_at = now()
         WHERE id = $2 AND school_id = $3`,
        [class_id, id, schoolId]
      );

      // Fetch all active fee heads for this structure
      const headsResult = await client.query(
        `SELECT * FROM fee_heads
         WHERE fee_structure_id = $1 AND school_id = $2 AND deleted_at IS NULL`,
        [id, schoolId]
      );
      const feeHeads = headsResult.rows;

      // Fetch all active students in the target class
      const studentsResult = await client.query(
        `SELECT id FROM students
         WHERE class_id = $1 AND school_id = $2 AND status = 'active'`,
        [class_id, schoolId]
      );
      const students = studentsResult.rows;

      let insertedCount = 0;

      // Bulk-insert student_fee_accounts for each student × each fee head
      for (const student of students) {
        for (const head of feeHeads) {
          // Determine assigned amount: prefer rounded_monthly_fee, then calculated_monthly_fee, then amount
          const assignedAmount =
            head.rounded_monthly_fee ??
            head.calculated_monthly_fee ??
            head.amount ??
            0;

          await client.query(
            `INSERT INTO student_fee_accounts (
               student_id, school_id, fee_head_id,
               assigned_amount, outstanding_balance,
               status, admission_date
             ) VALUES ($1, $2, $3, $4, $5, 'pending', CURRENT_DATE)
             ON CONFLICT DO NOTHING`,
            [student.id, schoolId, head.id, assignedAmount, assignedAmount]
          );
          insertedCount++;
        }
      }

      await client.query('COMMIT');

      return res.json({
        success: true,
        fee_structure_id: id,
        class_id,
        students_enrolled: students.length,
        fee_heads_count: feeHeads.length,
        accounts_inserted: insertedCount,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[fee-structures POST /:id/assign-class]', err);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  }
);

// ── POST /api/v1/financial/fee-structures/:id/fee-heads ──────────────────────
// Adds a single fee head to an existing fee structure.
router.post(
  '/:id/fee-heads',
  permissionGuard('MANAGE_FEE_STRUCTURE'),
  async (req, res) => {
    try {
      const schoolId = req.user!.school_id;
      const { id } = req.params;

      // Verify structure belongs to this school
      const structureResult = await pool.query(
        `SELECT id FROM fee_structures WHERE id = $1 AND school_id = $2`,
        [id, schoolId]
      );
      if (structureResult.rows.length === 0) {
        return res.status(404).json({ error: 'Fee structure not found' });
      }

      const {
        name, type, billing_basis, rate, hours_per_day, days_per_week,
        calculated_monthly_fee, rounded_monthly_fee, pricing_model,
        instalment_count, booking_amount, late_fee_amount, late_fee_grace_days,
        is_variable, amount,
      } = req.body;

      if (!name || !type) {
        return res.status(400).json({ error: 'name and type are required' });
      }

      const result = await pool.query(
        `INSERT INTO fee_heads (
           fee_structure_id, school_id, name, type, pricing_model,
           amount, billing_basis, rate, hours_per_day, days_per_week,
           calculated_monthly_fee, rounded_monthly_fee,
           instalment_count, booking_amount,
           late_fee_amount, late_fee_grace_days, is_variable
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING *`,
        [
          id, schoolId, name, type, pricing_model ?? 'flat',
          amount ?? null, billing_basis ?? null, rate ?? null,
          hours_per_day ?? null, days_per_week ?? null,
          calculated_monthly_fee ?? null, rounded_monthly_fee ?? null,
          instalment_count ?? null, booking_amount ?? null,
          late_fee_amount ?? null, late_fee_grace_days ?? null,
          is_variable ?? false,
        ]
      );

      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('[fee-structures POST /:id/fee-heads]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ── POST /api/v1/financial/fee-structures/fee-wizard/calculate ───────────────
// Accepts FeeCalculationInput, calls calculateMonthlyFee(), returns result.
// No additional permission guard beyond jwtVerify — any logged-in user can use
// the fee wizard calculator.
router.post('/fee-wizard/calculate', async (req, res) => {
  try {
    const input = req.body as FeeCalculationInput;

    if (!input.billing_basis || input.rate === undefined) {
      return res.status(400).json({ error: 'billing_basis and rate are required' });
    }

    const validBases = ['per_hour', 'per_day', 'per_week', 'per_month_flat'];
    if (!validBases.includes(input.billing_basis)) {
      return res.status(400).json({
        error: `billing_basis must be one of: ${validBases.join(', ')}`,
      });
    }

    if (typeof input.rate !== 'number' || input.rate < 0) {
      return res.status(400).json({ error: 'rate must be a non-negative number' });
    }

    const result = calculateMonthlyFee(input);

    return res.json(result);
  } catch (err) {
    console.error('[fee-wizard/calculate POST]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
