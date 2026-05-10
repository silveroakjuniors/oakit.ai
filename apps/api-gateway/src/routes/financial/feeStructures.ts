import { Router } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, permissionGuard } from '../../middleware/auth';
import {
  calculateFee,
  validateFeeCalculationInput,
  VALID_BILLING_BASIS,
  FeeCalculationInput,
} from '../../lib/feeCalculation';

const router = Router();

// All routes require authentication
router.use(jwtVerify);

// ── POST /api/v1/financial/fee-structures ─────────────────────────────────────
// Creates a fee structure (year-level container: school + academic_year).
// No class_id on the container — classes are assigned per fee head.
router.post(
  '/',
  permissionGuard('MANAGE_FEE_STRUCTURE'),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const schoolId = req.user!.school_id;
      const { name, academic_year, fee_heads = [] } = req.body as {
        name: string;
        academic_year?: string;
        fee_heads: Array<{
          name: string;
          type: string;
          pricing_model?: string;
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

      const structureResult = await client.query(
        `INSERT INTO fee_structures (school_id, name, academic_year, is_active)
         VALUES ($1, $2, $3, true)
         RETURNING *`,
        [schoolId, name, academic_year ?? null]
      );
      const structure = structureResult.rows[0];

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
            structure.id, schoolId, head.name, head.type,
            head.pricing_model ?? 'fixed',
            head.amount ?? null, head.billing_basis ?? null,
            head.rate ?? null, head.hours_per_day ?? null, head.days_per_week ?? null,
            head.calculated_monthly_fee ?? null, head.rounded_monthly_fee ?? null,
            head.instalment_count ?? null, head.booking_amount ?? null,
            head.late_fee_amount ?? null, head.late_fee_grace_days ?? null,
            head.is_variable ?? false,
          ]
        );
        insertedHeads.push(headResult.rows[0]);
      }

      await client.query('COMMIT');
      return res.status(201).json({ ...structure, fee_heads: insertedHeads });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[fee-structures POST /]', err);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  }
);

// ── GET /api/v1/financial/fee-structures ──────────────────────────────────────
// Lists all fee structures for the school, with fee_head_count and each
// fee head's class_name (joined from fee_heads.class_id → classes.name).
router.get(
  '/',
  permissionGuard('VIEW_FEES'),
  async (req, res) => {
    try {
      const schoolId = req.user!.school_id;

      const result = await pool.query(
        `SELECT
           fs.*,
           COUNT(fh.id) AS fee_head_count,
           COALESCE(
             json_agg(
               json_build_object(
                 'id',                   fh.id,
                 'name',                 fh.name,
                 'type',                 fh.type,
                 'billing_basis',        fh.billing_basis,
                 'pricing_model',        fh.pricing_model,
                 'amount',               fh.amount,
                 'rate',                 fh.rate,
                 'hours_per_day',        fh.hours_per_day,
                 'days_per_week',        fh.days_per_week,
                 'calculated_monthly_fee', fh.calculated_monthly_fee,
                 'rounded_monthly_fee',  fh.rounded_monthly_fee,
                 'instalment_count',     fh.instalment_count,
                 'booking_amount',       fh.booking_amount,
                 'late_fee_amount',      fh.late_fee_amount,
                 'late_fee_grace_days',  fh.late_fee_grace_days,
                 'is_variable',          fh.is_variable,
                 'class_id',             fh.class_id,
                 'class_name',           cl.name,
                 'students_assigned',    (
                   SELECT COUNT(*)::int
                   FROM student_fee_accounts sfa
                   WHERE sfa.fee_head_id = fh.id
                     AND sfa.school_id = fh.school_id
                     AND sfa.deleted_at IS NULL
                 ),
                 'students_total',       (
                   SELECT COUNT(*)::int
                   FROM students s
                   WHERE s.school_id = fh.school_id
                     AND s.is_active = true
                     AND (fh.class_id IS NULL OR s.class_id = fh.class_id)
                 ),
                 'payments_count',       (
                   SELECT COUNT(*)::int
                   FROM fee_payments fp
                   WHERE fp.fee_head_id = fh.id
                     AND fp.school_id = fh.school_id
                     AND fp.deleted_at IS NULL
                 )
               ) ORDER BY fh.created_at ASC
             ) FILTER (WHERE fh.id IS NOT NULL),
             '[]'
           ) AS fee_heads
         FROM fee_structures fs
         LEFT JOIN fee_heads fh
           ON fh.fee_structure_id = fs.id AND fh.deleted_at IS NULL
         LEFT JOIN classes cl ON cl.id = fh.class_id
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

// ── GET /api/v1/financial/fee-structures/classes ──────────────────────────────
// Returns all classes for the school (used by the fee wizard assign-class UI).
// Optional ?structure_id=<uuid> — excludes classes already assigned to any
// fee head in that structure, so the same class can't be assigned twice.
router.get(
  '/classes',
  permissionGuard('VIEW_FEES'),
  async (req, res) => {
    try {
      const schoolId = req.user!.school_id;
      const { structure_id } = req.query as { structure_id?: string };

      const result = await pool.query(
        `SELECT id, name FROM classes
         WHERE school_id = $1
           ${structure_id
             ? `AND id NOT IN (
                  SELECT class_id FROM fee_heads
                  WHERE fee_structure_id = $2
                    AND school_id = $1
                    AND class_id IS NOT NULL
                    AND deleted_at IS NULL
                )`
             : ''}
         ORDER BY name ASC`,
        structure_id ? [schoolId, structure_id] : [schoolId]
      );
      return res.json(result.rows);
    } catch (err) {
      console.error('[fee-structures GET /classes]', err);
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
router.get(
  '/check-late-fees',
  permissionGuard('VIEW_FEES'),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const schoolId = req.user!.school_id;

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
        const accountsResult = await client.query(
          `SELECT id FROM student_fee_accounts
           WHERE fee_head_id = $1 AND school_id = $2
             AND deleted_at IS NULL AND status != 'paid'`,
          [instalment.fee_head_id, schoolId]
        );

        for (const account of accountsResult.rows) {
          await client.query(
            `UPDATE student_fee_accounts
             SET outstanding_balance = outstanding_balance + $1, updated_at = now()
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

// ── GET /api/v1/financial/fee-structures/late-joiner-check ───────────────────
// Checks whether a student (by admission_date) is a late joiner relative to
// the academic year start date. Pure calculation — no DB writes.
router.get(
  '/late-joiner-check',
  permissionGuard('VIEW_FEES'),
  async (req, res) => {
    try {
      const { admission_date, academic_year_start } = req.query as {
        admission_date?: string;
        academic_year_start?: string;
      };

      if (!admission_date || !academic_year_start) {
        return res.status(400).json({
          error: 'admission_date and academic_year_start query params are required',
        });
      }

      const admDate = new Date(admission_date);
      const yearStart = new Date(academic_year_start);

      if (isNaN(admDate.getTime()) || isNaN(yearStart.getTime())) {
        return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
      }

      const daysLate = Math.floor(
        (admDate.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)
      );
      const isLateJoiner = daysLate > 60;

      return res.json({
        is_late_joiner: isLateJoiner,
        days_late: isLateJoiner ? daysLate : undefined,
        suggestion: isLateJoiner
          ? 'Consider assigning term fee or applying a concession for the missed period.'
          : undefined,
      });
    } catch (err) {
      console.error('[fee-structures GET /late-joiner-check]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ── GET /api/v1/financial/fee-structures/fee-wizard/terms ────────────────────
// Returns the school's academic terms for the given academic_year.
// Used by the fee wizard when billing_basis = 'per_term'.
router.get('/fee-wizard/terms', async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { academic_year } = req.query as { academic_year?: string };

    const result = await pool.query(
      `SELECT term_name, start_date, end_date
       FROM academic_terms
       WHERE school_id = $1
         ${academic_year ? 'AND academic_year = $2' : ''}
       ORDER BY start_date ASC`,
      academic_year ? [schoolId, academic_year] : [schoolId]
    );

    return res.json({
      terms: result.rows,
      term_count: result.rows.length,
    });
  } catch (err) {
    console.error('[fee-wizard/terms GET]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/v1/financial/fee-structures/fee-wizard/calculate ───────────────
// Accepts FeeCalculationInput, returns the calculated fee result.
// No additional permission guard — any authenticated user can use the wizard.
router.post('/fee-wizard/calculate', async (req, res) => {
  try {
    const input = req.body as FeeCalculationInput;

    if (!input.billing_basis) {
      return res.status(400).json({ error: 'billing_basis is required' });
    }
    if (!VALID_BILLING_BASIS.includes(input.billing_basis)) {
      return res.status(400).json({
        error: `billing_basis must be one of: ${VALID_BILLING_BASIS.join(', ')}`,
      });
    }

    const validationError = validateFeeCalculationInput(input);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const result = calculateFee(input);
    return res.json({
      ...result,
      annual_equivalent: result.is_lump_sum ? result.amount : result.calculated_monthly_fee * 12,
    });
  } catch (err) {
    console.error('[fee-wizard/calculate POST]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/v1/financial/fee-structures/students ────────────────────────────
// Lists active students in a class, annotated with whether they already have
// a fee account for a specific fee head.
// Query params: class_id (required), head_id (required)
router.get(
  '/students',
  permissionGuard('VIEW_FEES'),
  async (req, res) => {
    try {
      const schoolId = req.user!.school_id;
      const { class_id, head_id } = req.query as { class_id?: string; head_id?: string };

      if (!class_id || !head_id) {
        return res.status(400).json({ error: 'class_id and head_id are required' });
      }

      const result = await pool.query(
        `SELECT
           s.id, s.name,
           sec.label AS section_label,
           CASE WHEN sfa.id IS NOT NULL THEN true ELSE false END AS is_assigned
         FROM students s
         JOIN sections sec ON sec.id = s.section_id
         LEFT JOIN student_fee_accounts sfa
           ON sfa.student_id = s.id
           AND sfa.fee_head_id = $3
           AND sfa.school_id = $1
           AND sfa.deleted_at IS NULL
         WHERE s.class_id = $2
           AND s.school_id = $1
           AND s.is_active = true
         ORDER BY s.name ASC`,
        [schoolId, class_id, head_id]
      );

      return res.json(result.rows);
    } catch (err) {
      console.error('[fee-structures GET /students]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ── GET /api/v1/financial/fee-structures/:id ─────────────────────────────────
// Returns a fee structure with its fee heads (including class_name) and
// all fee instalments for those heads.
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

      const headsResult = await pool.query(
        `SELECT fh.*, cl.name AS class_name
         FROM fee_heads fh
         LEFT JOIN classes cl ON cl.id = fh.class_id
         WHERE fh.fee_structure_id = $1 AND fh.school_id = $2 AND fh.deleted_at IS NULL
         ORDER BY fh.created_at ASC`,
        [id, schoolId]
      );

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

// ── PUT /api/v1/financial/fee-structures/:id ─────────────────────────────────
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

      if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name); }
      if (academic_year !== undefined) { updates.push(`academic_year = $${idx++}`); values.push(academic_year); }
      if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); values.push(is_active); }

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
// Hard-deletes a fee structure and all its fee heads.
// Blocked if any fee head has student_fee_accounts with payments (paid_amount > 0).
router.delete(
  '/:id',
  permissionGuard('MANAGE_FEE_STRUCTURE'),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const schoolId = req.user!.school_id;
      const { id } = req.params;

      const existing = await client.query(
        `SELECT id FROM fee_structures WHERE id = $1 AND school_id = $2`,
        [id, schoolId]
      );
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Fee structure not found' });
      }

      // Block if any fee head has student accounts with payments
      const paymentsCheck = await client.query(
        `SELECT COUNT(*) AS cnt
         FROM fee_payments fp
         JOIN fee_heads fh ON fh.id = fp.fee_head_id
         WHERE fh.fee_structure_id = $1
           AND fh.school_id = $2
           AND fp.deleted_at IS NULL`,
        [id, schoolId]
      );
      if (parseInt(paymentsCheck.rows[0].cnt) > 0) {
        return res.status(409).json({
          error:
            'Cannot delete: one or more fee heads have student accounts with recorded payments. ' +
            'Remove or reverse those payments first.',
        });
      }

      await client.query('BEGIN');

      // Delete student_fee_accounts for all fee heads in this structure
      await client.query(
        `DELETE FROM student_fee_accounts
         WHERE fee_head_id IN (
           SELECT id FROM fee_heads WHERE fee_structure_id = $1 AND school_id = $2
         )`,
        [id, schoolId]
      );

      // Delete fee instalments
      await client.query(
        `DELETE FROM fee_instalments
         WHERE fee_head_id IN (
           SELECT id FROM fee_heads WHERE fee_structure_id = $1 AND school_id = $2
         )`,
        [id, schoolId]
      );

      // Delete fee heads
      await client.query(
        `DELETE FROM fee_heads WHERE fee_structure_id = $1 AND school_id = $2`,
        [id, schoolId]
      );

      // Delete the structure
      await client.query(
        `DELETE FROM fee_structures WHERE id = $1 AND school_id = $2`,
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

// ── POST /api/v1/financial/fee-structures/:id/fee-heads ──────────────────────
// Adds a single fee head to an existing fee structure.
// Handles instalment schedule inline (within the same transaction).
router.post(
  '/:id/fee-heads',
  permissionGuard('MANAGE_FEE_STRUCTURE'),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const schoolId = req.user!.school_id;
      const { id } = req.params;

      const structureResult = await client.query(
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
        yearly_amount, term_amount, term_count,
        instalments,
      } = req.body;

      if (!name || !type) {
        return res.status(400).json({ error: 'name and type are required' });
      }

      // Block duplicate fee head name within the same structure
      const dupNameCheck = await client.query(
        `SELECT id FROM fee_heads
         WHERE fee_structure_id = $1 AND school_id = $2
           AND LOWER(name) = LOWER($3) AND deleted_at IS NULL`,
        [id, schoolId, name.trim()]
      );
      if (dupNameCheck.rows.length > 0) {
        return res.status(409).json({
          error: `A fee type named "${name.trim()}" already exists in this fee structure.`,
        });
      }

      // Validate billing_basis
      const validBases = ['per_hour', 'per_day', 'per_week', 'per_month_flat', 'per_year', 'per_term'];
      if (billing_basis && !validBases.includes(billing_basis)) {
        return res.status(400).json({
          error: `billing_basis must be one of: ${validBases.join(', ')}`,
        });
      }

      // Normalise pricing_model: 'flat' → 'fixed'
      const normalisedPricingModel =
        (pricing_model === 'flat' ? 'fixed' : pricing_model) ?? 'fixed';

      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO fee_heads (
           fee_structure_id, school_id, name, type, pricing_model,
           amount, billing_basis, rate, hours_per_day, days_per_week,
           calculated_monthly_fee, rounded_monthly_fee,
           yearly_amount, term_amount, term_count,
           instalment_count, booking_amount,
           late_fee_amount, late_fee_grace_days, is_variable
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,COALESCE($19,0),$20)
         RETURNING *`,
        [
          id, schoolId, name, type, normalisedPricingModel,
          amount ?? null, billing_basis ?? null, rate ?? null,
          hours_per_day ?? null, days_per_week ?? null,
          calculated_monthly_fee ?? null, rounded_monthly_fee ?? null,
          yearly_amount ?? null, term_amount ?? null, term_count ?? null,
          instalment_count ?? null, booking_amount ?? null,
          late_fee_amount ?? null, late_fee_grace_days ?? null,
          is_variable ?? false,
        ]
      );

      const newHead = result.rows[0];

      // If instalment schedule provided inline, insert them now
      if (
        normalisedPricingModel === 'instalment' &&
        Array.isArray(instalments) &&
        instalments.length > 0
      ) {
        for (let i = 0; i < instalments.length; i++) {
          const inst = instalments[i];
          if (!inst.label || inst.amount == null || !inst.due_date) {
            await client.query('ROLLBACK');
            return res.status(400).json({
              error: `Instalment ${i + 1}: label, amount, and due_date are required`,
            });
          }
          await client.query(
            `INSERT INTO fee_instalments
               (fee_head_id, school_id, instalment_number, label, amount, due_date)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [newHead.id, schoolId, i + 1, inst.label, inst.amount, inst.due_date]
          );
        }
      }

      await client.query('COMMIT');

      pool.query(
        `INSERT INTO audit_logs (school_id, action, module, entity_id, created_at)
         VALUES ($1, 'CREATE_FEE_HEAD', 'fees', $2, now())`,
        [schoolId, newHead.id]
      ).catch(() => {});

      return res.status(201).json(newHead);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[fee-structures POST /:id/fee-heads]', err);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  }
);

// ── DELETE /api/v1/financial/fee-structures/:id/fee-heads/:headId ─────────────
// Soft-deletes a fee head (sets deleted_at).
// Blocked if the fee head has student accounts with payments.
router.delete(
  '/:id/fee-heads/:headId',
  permissionGuard('MANAGE_FEE_STRUCTURE'),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const schoolId = req.user!.school_id;
      const { id, headId } = req.params;

      const headResult = await client.query(
        `SELECT id FROM fee_heads
         WHERE id = $1 AND fee_structure_id = $2 AND school_id = $3 AND deleted_at IS NULL`,
        [headId, id, schoolId]
      );
      if (headResult.rows.length === 0) {
        return res.status(404).json({ error: 'Fee head not found' });
      }

      // Block if any student account has payments
      const paymentsCheck = await client.query(
        `SELECT COUNT(*) AS cnt FROM fee_payments
         WHERE fee_head_id = $1 AND school_id = $2 AND deleted_at IS NULL`,
        [headId, schoolId]
      );
      if (parseInt(paymentsCheck.rows[0].cnt) > 0) {
        return res.status(409).json({
          error:
            'Cannot delete: fee payments have been collected against this fee type. Remove or reverse all payments first.',
        });
      }

      await client.query('BEGIN');

      // Soft-delete student_fee_accounts (no payments, safe to remove)
      await client.query(
        `UPDATE student_fee_accounts SET deleted_at = now()
         WHERE fee_head_id = $1 AND school_id = $2 AND deleted_at IS NULL`,
        [headId, schoolId]
      );

      // Soft-delete the fee head
      await client.query(
        `UPDATE fee_heads SET deleted_at = now()
         WHERE id = $1 AND school_id = $2`,
        [headId, schoolId]
      );

      await client.query('COMMIT');
      return res.json({ success: true, id: headId });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[fee-structures DELETE /:id/fee-heads/:headId]', err);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  }
);

// ── POST /api/v1/financial/fee-structures/:id/fee-heads/:headId/instalments ───
// Creates instalment schedule rows for a fee head.
router.post(
  '/:id/fee-heads/:headId/instalments',
  permissionGuard('MANAGE_FEE_STRUCTURE'),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const schoolId = req.user!.school_id;
      const { id, headId } = req.params;
      const { instalments } = req.body as {
        instalments: Array<{
          label: string;
          amount: number;
          due_date: string;
        }>;
      };

      if (!Array.isArray(instalments) || instalments.length === 0) {
        return res.status(400).json({ error: 'instalments array is required' });
      }

      // Verify fee head belongs to this structure and school
      const headResult = await client.query(
        `SELECT id FROM fee_heads
         WHERE id = $1 AND fee_structure_id = $2 AND school_id = $3 AND deleted_at IS NULL`,
        [headId, id, schoolId]
      );
      if (headResult.rows.length === 0) {
        return res.status(404).json({ error: 'Fee head not found' });
      }

      await client.query('BEGIN');

      // Remove existing instalments for this head before inserting new ones
      await client.query(
        `DELETE FROM fee_instalments WHERE fee_head_id = $1 AND school_id = $2`,
        [headId, schoolId]
      );

      const inserted: any[] = [];
      for (let i = 0; i < instalments.length; i++) {
        const inst = instalments[i];
        const result = await client.query(
          `INSERT INTO fee_instalments
             (fee_head_id, school_id, instalment_number, label, amount, due_date)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [headId, schoolId, i + 1, inst.label, inst.amount, inst.due_date]
        );
        inserted.push(result.rows[0]);
      }

      await client.query('COMMIT');
      return res.status(201).json({ success: true, instalments: inserted });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[fee-structures POST /:id/fee-heads/:headId/instalments]', err);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  }
);

// ── POST /api/v1/financial/fee-structures/:id/fee-heads/:headId/assign-class ──
// Assigns one fee head to a class and bulk-creates student_fee_accounts
// for all active students in that class.
//
// Guards:
//   - One active fee head per type per class per academic year (app-level check)
//   - Idempotent: ON CONFLICT DO NOTHING on student_fee_accounts
router.post(
  '/:id/fee-heads/:headId/assign-class',
  permissionGuard('MANAGE_FEE_STRUCTURE'),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const schoolId = req.user!.school_id;
      const { id, headId } = req.params;
      const { class_id } = req.body as { class_id: string };

      if (!class_id) {
        return res.status(400).json({ error: 'class_id is required' });
      }

      // Verify fee head belongs to this structure and school
      const headResult = await client.query(
        `SELECT fh.*, fs.academic_year
         FROM fee_heads fh
         JOIN fee_structures fs ON fs.id = fh.fee_structure_id
         WHERE fh.id = $1 AND fh.fee_structure_id = $2 AND fh.school_id = $3 AND fh.deleted_at IS NULL`,
        [headId, id, schoolId]
      );
      if (headResult.rows.length === 0) {
        return res.status(404).json({ error: 'Fee head not found' });
      }
      const head = headResult.rows[0];

      // Prevent duplicate: same fee type already assigned to this class in this academic year
      const duplicateCheck = await client.query(
        `SELECT fh2.id
         FROM fee_heads fh2
         JOIN fee_structures fs2 ON fs2.id = fh2.fee_structure_id
         WHERE fh2.school_id = $1
           AND fh2.class_id = $2
           AND fh2.type = $3
           AND fs2.academic_year = $4
           AND fh2.deleted_at IS NULL
           AND fh2.id != $5`,
        [schoolId, class_id, head.type, head.academic_year, headId]
      );
      if (duplicateCheck.rows.length > 0) {
        return res.status(409).json({
          error: `A "${head.type}" fee head is already assigned to this class for academic year ${head.academic_year}.`,
        });
      }

      await client.query('BEGIN');

      // Set class_id on the fee head
      await client.query(
        `UPDATE fee_heads SET class_id = $1, updated_at = now() WHERE id = $2 AND school_id = $3`,
        [class_id, headId, schoolId]
      );

      // Fetch all active students in the class
      const studentsResult = await client.query(
        `SELECT id FROM students WHERE class_id = $1 AND school_id = $2 AND is_active = true`,
        [class_id, schoolId]
      );
      const students = studentsResult.rows;

      const assignedAmount =
        head.rounded_monthly_fee ?? head.calculated_monthly_fee ?? head.amount ?? 0;

      let insertedCount = 0;
      for (const student of students) {
        const r = await client.query(
          `INSERT INTO student_fee_accounts (
             student_id, school_id, fee_head_id,
             assigned_amount, outstanding_balance, status, admission_date
           ) VALUES ($1, $2, $3, $4, $5, 'pending', CURRENT_DATE)
           ON CONFLICT DO NOTHING`,
          [student.id, schoolId, headId, assignedAmount, assignedAmount]
        );
        insertedCount += r.rowCount ?? 0;
      }

      await client.query('COMMIT');

      return res.json({
        success: true,
        fee_head_id: headId,
        class_id,
        students_enrolled: students.length,
        accounts_created: insertedCount,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[fee-structures POST /:id/fee-heads/:headId/assign-class]', err);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  }
);

// ── DELETE /api/v1/financial/fee-structures/:id/fee-heads/:headId/unassign-class
// Removes the class assignment from a fee head and soft-deletes the associated
// student_fee_accounts.
// Blocked if any of those accounts have payments (paid_amount > 0).
router.delete(
  '/:id/fee-heads/:headId/unassign-class',
  permissionGuard('MANAGE_FEE_STRUCTURE'),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const schoolId = req.user!.school_id;
      const { id, headId } = req.params;

      const headResult = await client.query(
        `SELECT id, class_id FROM fee_heads
         WHERE id = $1 AND fee_structure_id = $2 AND school_id = $3 AND deleted_at IS NULL`,
        [headId, id, schoolId]
      );
      if (headResult.rows.length === 0) {
        return res.status(404).json({ error: 'Fee head not found' });
      }
      if (!headResult.rows[0].class_id) {
        return res.status(400).json({ error: 'This fee head is not assigned to any class.' });
      }

      // Block if any student account has payments
      const paymentsCheck = await client.query(
        `SELECT COUNT(*) AS cnt FROM fee_payments
         WHERE fee_head_id = $1 AND school_id = $2 AND deleted_at IS NULL`,
        [headId, schoolId]
      );
      if (parseInt(paymentsCheck.rows[0].cnt) > 0) {
        return res.status(409).json({
          error:
            'Cannot unassign: one or more student accounts for this fee head have recorded payments.',
        });
      }

      await client.query('BEGIN');

      // Soft-delete student_fee_accounts
      await client.query(
        `UPDATE student_fee_accounts SET deleted_at = now()
         WHERE fee_head_id = $1 AND school_id = $2 AND deleted_at IS NULL`,
        [headId, schoolId]
      );

      // Clear class_id on the fee head
      await client.query(
        `UPDATE fee_heads SET class_id = NULL, updated_at = now()
         WHERE id = $1 AND school_id = $2`,
        [headId, schoolId]
      );

      await client.query('COMMIT');
      return res.json({ success: true, fee_head_id: headId });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[fee-structures DELETE /:id/fee-heads/:headId/unassign-class]', err);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  }
);

// ── GET /api/v1/financial/fee-structures/students ────────────────────────────
// Lists active students in a class, annotated with whether they already have
// a fee account for a specific fee head.
// Query params: class_id (required), head_id (required)
router.get(
  '/students',
  permissionGuard('VIEW_FEES'),
  async (req, res) => {
    try {
      const schoolId = req.user!.school_id;
      const { class_id, head_id } = req.query as { class_id?: string; head_id?: string };

      if (!class_id || !head_id) {
        return res.status(400).json({ error: 'class_id and head_id are required' });
      }

      const result = await pool.query(
        `SELECT
           s.id, s.name,
           sec.label AS section_label,
           CASE WHEN sfa.id IS NOT NULL THEN true ELSE false END AS is_assigned
         FROM students s
         JOIN sections sec ON sec.id = s.section_id
         LEFT JOIN student_fee_accounts sfa
           ON sfa.student_id = s.id
           AND sfa.fee_head_id = $3
           AND sfa.school_id = $1
           AND sfa.deleted_at IS NULL
         WHERE s.class_id = $2
           AND s.school_id = $1
           AND s.is_active = true
         ORDER BY s.name ASC`,
        [schoolId, class_id, head_id]
      );

      return res.json(result.rows);
    } catch (err) {
      console.error('[fee-structures GET /students]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);


// Removes a single student's fee account for this fee head.
router.delete(
  '/:id/fee-heads/:headId/unassign-student/:studentId',
  permissionGuard('MANAGE_FEE_STRUCTURE'),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const schoolId = req.user!.school_id;
      const { headId, studentId } = req.params;

      // Block if student has payments for this fee head
      const paymentsCheck = await client.query(
        `SELECT COUNT(*) AS cnt FROM fee_payments
         WHERE fee_head_id = $1 AND student_id = $2 AND school_id = $3 AND deleted_at IS NULL`,
        [headId, studentId, schoolId]
      );
      if (parseInt(paymentsCheck.rows[0].cnt) > 0) {
        return res.status(409).json({
          error: 'Cannot remove: this student has recorded payments for this fee.',
        });
      }

      await client.query(
        `UPDATE student_fee_accounts SET deleted_at = now()
         WHERE fee_head_id = $1 AND student_id = $2 AND school_id = $3 AND deleted_at IS NULL`,
        [headId, studentId, schoolId]
      );

      await client.query('COMMIT');
      return res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[fee-structures DELETE unassign-student]', err);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  }
);

// ── POST /api/v1/financial/fee-structures/:id/fee-heads/:headId/assign-student ─
// Assigns one fee head to a specific student and creates a student_fee_account.
router.post(
  '/:id/fee-heads/:headId/assign-student',
  permissionGuard('MANAGE_FEE_STRUCTURE'),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const schoolId = req.user!.school_id;
      const { id, headId } = req.params;
      const { student_id, admission_date } = req.body as {
        student_id: string;
        admission_date?: string;
      };

      if (!student_id) {
        return res.status(400).json({ error: 'student_id is required' });
      }

      // Verify fee head
      const headResult = await client.query(
        `SELECT * FROM fee_heads
         WHERE id = $1 AND fee_structure_id = $2 AND school_id = $3 AND deleted_at IS NULL`,
        [headId, id, schoolId]
      );
      if (headResult.rows.length === 0) {
        return res.status(404).json({ error: 'Fee head not found' });
      }
      const head = headResult.rows[0];

      // Verify student belongs to this school
      const studentResult = await client.query(
        `SELECT id FROM students WHERE id = $1 AND school_id = $2`,
        [student_id, schoolId]
      );
      if (studentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Student not found' });
      }

      const assignedAmount =
        head.rounded_monthly_fee ?? head.calculated_monthly_fee ?? head.amount ?? 0;

      const result = await client.query(
        `INSERT INTO student_fee_accounts (
           student_id, school_id, fee_head_id,
           assigned_amount, outstanding_balance, status, admission_date
         ) VALUES ($1, $2, $3, $4, $5, 'pending', $6)
         ON CONFLICT DO NOTHING
         RETURNING *`,
        [
          student_id, schoolId, headId,
          assignedAmount, assignedAmount,
          admission_date ?? new Date().toISOString().slice(0, 10),
        ]
      );

      if (result.rows.length === 0) {
        return res.status(409).json({
          error: 'A fee account for this student and fee head already exists.',
        });
      }

      return res.status(201).json({ success: true, account: result.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[fee-structures POST /:id/fee-heads/:headId/assign-student]', err);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  }
);

// ── POST /api/v1/financial/fee-structures/:id/fee-heads/:headId/sync-students ──
// Accepts { student_ids: string[] } — the full desired set of assigned students.
// In one transaction: assigns any newly checked students, unassigns any unchecked
// ones (soft-delete their fee accounts, blocked if paid_amount > 0).
router.post(
  '/:id/fee-heads/:headId/sync-students',
  permissionGuard('MANAGE_FEE_STRUCTURE'),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const schoolId = req.user!.school_id;
      const { id, headId } = req.params;
      const { student_ids } = req.body as { student_ids: string[] };

      if (!Array.isArray(student_ids)) {
        return res.status(400).json({ error: 'student_ids must be an array' });
      }

      // Verify fee head
      const headResult = await client.query(
        `SELECT * FROM fee_heads
         WHERE id = $1 AND fee_structure_id = $2 AND school_id = $3 AND deleted_at IS NULL`,
        [headId, id, schoolId]
      );
      if (headResult.rows.length === 0) {
        return res.status(404).json({ error: 'Fee head not found' });
      }
      const head = headResult.rows[0];

      await client.query('BEGIN');

      // Current assignments (non-deleted)
      const currentResult = await client.query(
        `SELECT student_id FROM student_fee_accounts
         WHERE fee_head_id = $1 AND school_id = $2 AND deleted_at IS NULL`,
        [headId, schoolId]
      );
      const currentIds = new Set(currentResult.rows.map((r: { student_id: string }) => r.student_id));
      const desiredIds = new Set(student_ids);

      // Block unassign if any to-remove student has payments
      const toRemove = [...currentIds].filter(sid => !desiredIds.has(sid));
      if (toRemove.length > 0) {
        const paidCheck = await client.query(
          `SELECT sfa.student_id FROM student_fee_accounts sfa
           WHERE sfa.fee_head_id = $1 AND sfa.school_id = $2 AND sfa.student_id = ANY($3)
             AND sfa.deleted_at IS NULL
             AND EXISTS (
               SELECT 1 FROM fee_payments fp
               WHERE fp.fee_head_id = sfa.fee_head_id
                 AND fp.student_id = sfa.student_id
                 AND fp.school_id = sfa.school_id
                 AND fp.deleted_at IS NULL
             )`,
          [headId, schoolId, toRemove]
        );
        if (paidCheck.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: 'Cannot unassign students who have already made payments.',
            student_ids: paidCheck.rows.map((r: { student_id: string }) => r.student_id),
          });
        }
        await client.query(
          `UPDATE student_fee_accounts
           SET deleted_at = now(), updated_at = now()
           WHERE fee_head_id = $1 AND school_id = $2 AND student_id = ANY($3) AND deleted_at IS NULL`,
          [headId, schoolId, toRemove]
        );
      }

      // Assign new students
      const toAdd = [...desiredIds].filter(sid => !currentIds.has(sid));
      const assignedAmount =
        head.rounded_monthly_fee ?? head.calculated_monthly_fee ?? head.amount ?? 0;
      let added = 0;
      for (const sid of toAdd) {
        const r = await client.query(
          `INSERT INTO student_fee_accounts (
             student_id, school_id, fee_head_id,
             assigned_amount, outstanding_balance, status, admission_date
           ) VALUES ($1, $2, $3, $4, $5, 'pending', CURRENT_DATE)
           ON CONFLICT DO NOTHING`,
          [sid, schoolId, headId, assignedAmount, assignedAmount]
        );
        added += r.rowCount ?? 0;
      }

      await client.query('COMMIT');
      return res.json({ success: true, assigned: added, unassigned: toRemove.length });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[fee-structures POST /:id/fee-heads/:headId/sync-students]', err);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  }
);

// ── POST /api/v1/financial/fee-structures/:id/fee-heads/:headId/restructure ───
// Nuclear option: wipes ALL payment data for this fee head (fee_payments,
// student_fee_accounts, online_payment_proofs, credit_balances contributions)
// then clears the class assignment so it can be reassigned fresh.
// Requires explicit confirmation: { confirm: "RESTRUCTURE" } in body.
// Only callable by admin with MANAGE_FEE_STRUCTURE permission.
router.post(
  '/:id/fee-heads/:headId/restructure',
  permissionGuard('MANAGE_FEE_STRUCTURE'),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const schoolId = req.user!.school_id;
      const { id, headId } = req.params;
      const { confirm } = req.body as { confirm?: string };

      if (confirm !== 'RESTRUCTURE') {
        return res.status(400).json({
          error: 'You must send { "confirm": "RESTRUCTURE" } to proceed.',
        });
      }

      const headResult = await client.query(
        `SELECT fh.id, fh.name FROM fee_heads fh
         WHERE fh.id = $1 AND fh.fee_structure_id = $2 AND fh.school_id = $3 AND fh.deleted_at IS NULL`,
        [headId, id, schoolId]
      );
      if (headResult.rows.length === 0) {
        return res.status(404).json({ error: 'Fee head not found' });
      }

      await client.query('BEGIN');

      // 1. Hard-delete all payment records for this fee head
      const paymentsResult = await client.query(
        `DELETE FROM fee_payments
         WHERE fee_head_id = $1 AND school_id = $2
         RETURNING id`,
        [headId, schoolId]
      );

      // 2. Hard-delete online payment proofs
      await client.query(
        `DELETE FROM online_payment_proofs
         WHERE fee_head_id = $1 AND school_id = $2`,
        [headId, schoolId]
      );

      // 3. Hard-delete student fee accounts
      const accountsResult = await client.query(
        `DELETE FROM student_fee_accounts
         WHERE fee_head_id = $1 AND school_id = $2
         RETURNING id`,
        [headId, schoolId]
      );

      // 4. Clear class assignment on the fee head
      await client.query(
        `UPDATE fee_heads SET class_id = NULL, updated_at = now()
         WHERE id = $1 AND school_id = $2`,
        [headId, schoolId]
      );

      await client.query('COMMIT');

      return res.json({
        success: true,
        fee_head_id: headId,
        payments_deleted: paymentsResult.rowCount ?? 0,
        accounts_deleted: accountsResult.rowCount ?? 0,
        message: 'Fee head has been restructured. All payment history has been permanently deleted.',
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[fee-structures POST /:id/fee-heads/:headId/restructure]', err);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  }
);

export default router;
