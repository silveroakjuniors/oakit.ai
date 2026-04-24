import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../../lib/db';
import { jwtVerify, permissionGuard } from '../../middleware/auth';

const router = Router();

// All routes require authentication
router.use(jwtVerify);

const VALID_STATUSES = ['open', 'converted', 'closed'] as const;
type EnquiryStatus = typeof VALID_STATUSES[number];

// ── POST /api/v1/financial/enquiries ─────────────────────────────────────────
// Creates a new enquiry for the school.
router.post(
  '/',
  permissionGuard('VIEW_FEES'),
  async (req, res) => {
    try {
      const schoolId = req.user!.school_id;
      const createdBy = req.user!.id;
      const {
        student_name,
        parent_name,
        contact_number,
        class_of_interest,
        enquiry_date,
        notes,
      } = req.body as {
        student_name: string;
        parent_name: string;
        contact_number: string;
        class_of_interest?: string;
        enquiry_date?: string;
        notes?: string;
      };

      if (!student_name || !parent_name || !contact_number) {
        return res.status(400).json({
          error: 'student_name, parent_name, and contact_number are required',
        });
      }

      const result = await pool.query(
        `INSERT INTO enquiries (
           school_id, student_name, parent_name, contact_number,
           class_of_interest, enquiry_date, status, notes, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8)
         RETURNING *`,
        [
          schoolId,
          student_name,
          parent_name,
          contact_number,
          class_of_interest ?? null,
          enquiry_date ?? null,
          notes ?? null,
          createdBy,
        ]
      );

      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('[enquiries POST /]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ── GET /api/v1/financial/enquiries ──────────────────────────────────────────
// Lists enquiries for the school, with optional status filter.
router.get(
  '/',
  permissionGuard('VIEW_FEES'),
  async (req, res) => {
    try {
      const schoolId = req.user!.school_id;
      const { status } = req.query as { status?: string };

      if (status && !VALID_STATUSES.includes(status as EnquiryStatus)) {
        return res.status(400).json({
          error: `status must be one of: ${VALID_STATUSES.join(', ')}`,
        });
      }

      let query = `SELECT * FROM enquiries WHERE school_id = $1`;
      const params: any[] = [schoolId];

      if (status) {
        query += ` AND status = $2`;
        params.push(status);
      }

      query += ` ORDER BY created_at DESC`;

      const result = await pool.query(query, params);
      return res.json(result.rows);
    } catch (err) {
      console.error('[enquiries GET /]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ── PUT /api/v1/financial/enquiries/:id ───────────────────────────────────────
// Updates status and/or notes on an enquiry.
router.put(
  '/:id',
  permissionGuard('VIEW_FEES'),
  async (req, res) => {
    try {
      const schoolId = req.user!.school_id;
      const { id } = req.params;
      const { status, notes } = req.body as {
        status?: string;
        notes?: string;
      };

      if (status && !VALID_STATUSES.includes(status as EnquiryStatus)) {
        return res.status(400).json({
          error: `status must be one of: ${VALID_STATUSES.join(', ')}`,
        });
      }

      // Verify ownership
      const existing = await pool.query(
        `SELECT id FROM enquiries WHERE id = $1 AND school_id = $2`,
        [id, schoolId]
      );
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Enquiry not found' });
      }

      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (status !== undefined) {
        updates.push(`status = $${idx++}`);
        values.push(status);
      }
      if (notes !== undefined) {
        updates.push(`notes = $${idx++}`);
        values.push(notes);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      values.push(id, schoolId);

      const result = await pool.query(
        `UPDATE enquiries SET ${updates.join(', ')}
         WHERE id = $${idx++} AND school_id = $${idx}
         RETURNING *`,
        values
      );

      return res.json(result.rows[0]);
    } catch (err) {
      console.error('[enquiries PUT /:id]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ── POST /api/v1/financial/enquiries/:id/convert ─────────────────────────────
// Converts an enquiry to an admission.
// Steps (all in a transaction):
//   1. Fetch enquiry, verify it belongs to this school and is status = 'open'
//   2. Create student record
//   3. Link or create parent account
//   4. Find active fee structure for the class
//   5. Bulk-insert student_fee_accounts if fee structure exists
//   6. Update enquiry to 'converted'
//   7. Return { student_id, parent_id, fee_accounts_created }
router.post(
  '/:id/convert',
  permissionGuard('VIEW_FEES'),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const schoolId = req.user!.school_id;
      const { id } = req.params;
      const { class_id, section_id, admission_date } = req.body as {
        class_id: string;
        section_id?: string;
        admission_date?: string;
      };

      if (!class_id) {
        return res.status(400).json({ error: 'class_id is required' });
      }

      await client.query('BEGIN');

      // Step 1: Fetch enquiry, verify ownership and open status
      const enquiryResult = await client.query(
        `SELECT * FROM enquiries WHERE id = $1 AND school_id = $2`,
        [id, schoolId]
      );
      if (enquiryResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Enquiry not found' });
      }
      const enquiry = enquiryResult.rows[0];
      if (enquiry.status !== 'open') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Enquiry is not open (current status: ${enquiry.status})`,
        });
      }

      // Step 2: Create student record
      const studentResult = await client.query(
        `INSERT INTO students (school_id, name, class_id, section_id, status, created_at)
         VALUES ($1, $2, $3, $4, 'active', now())
         RETURNING id`,
        [schoolId, enquiry.student_name, class_id, section_id ?? null]
      );
      const studentId: string = studentResult.rows[0].id;

      // Step 3: Check if parent account exists with matching mobile
      const existingParentResult = await client.query(
        `SELECT id FROM users WHERE mobile = $1 AND school_id = $2 LIMIT 1`,
        [enquiry.contact_number, schoolId]
      );

      let parentId: string;

      if (existingParentResult.rows.length > 0) {
        // Link existing parent
        parentId = existingParentResult.rows[0].id;
        await client.query(
          `INSERT INTO student_parents (student_id, parent_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [studentId, parentId]
        );
      } else {
        // Create new parent user — initial password is the contact number itself
        const passwordHash = await bcrypt.hash(enquiry.contact_number, 10);
        const newParentResult = await client.query(
          `INSERT INTO users (school_id, name, mobile, role, password_hash)
           VALUES ($1, $2, $3, 'parent', $4)
           RETURNING id`,
          [schoolId, enquiry.parent_name, enquiry.contact_number, passwordHash]
        );
        parentId = newParentResult.rows[0].id;

        await client.query(
          `INSERT INTO student_parents (student_id, parent_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [studentId, parentId]
        );
      }

      // Step 4: Find active fee structure for the class
      const feeStructureResult = await client.query(
        `SELECT * FROM fee_structures
         WHERE class_id = $1 AND school_id = $2 AND is_active = true
         LIMIT 1`,
        [class_id, schoolId]
      );

      let feeAccountsCreated = 0;

      if (feeStructureResult.rows.length > 0) {
        const feeStructure = feeStructureResult.rows[0];

        // Step 5: Fetch fee heads and bulk-insert student_fee_accounts
        const headsResult = await client.query(
          `SELECT * FROM fee_heads
           WHERE fee_structure_id = $1 AND school_id = $2 AND deleted_at IS NULL`,
          [feeStructure.id, schoolId]
        );
        const feeHeads = headsResult.rows;

        for (const head of feeHeads) {
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
             ) VALUES ($1, $2, $3, $4, $5, 'pending', $6)
             ON CONFLICT DO NOTHING`,
            [
              studentId,
              schoolId,
              head.id,
              assignedAmount,
              assignedAmount,
              admission_date ?? null,
            ]
          );
          feeAccountsCreated++;
        }
      }

      // Step 6: Update enquiry to 'converted'
      await client.query(
        `UPDATE enquiries
         SET status = 'converted', converted_student_id = $1
         WHERE id = $2 AND school_id = $3`,
        [studentId, id, schoolId]
      );

      await client.query('COMMIT');

      // Step 7: Return result
      return res.status(201).json({
        student_id: studentId,
        parent_id: parentId,
        fee_accounts_created: feeAccountsCreated,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[enquiries POST /:id/convert]', err);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  }
);

// ── POST /api/v1/financial/enquiries/:id/onboarding-fee-assignment ────────────
// Preview endpoint — computes effective amounts for selected fee components.
// Does NOT save anything.
router.post(
  '/:id/onboarding-fee-assignment',
  permissionGuard('VIEW_FEES'),
  async (req, res) => {
    try {
      const schoolId = req.user!.school_id;
      const { id } = req.params;
      const { fee_components } = req.body as {
        fee_components: Array<{
          fee_head_id: string;
          custom_amount?: number;
          hours_per_day?: number;
          days_per_week?: number;
          transport_route?: string;
          transport_stop?: string;
          selected_activities?: string[];
        }>;
      };

      if (!Array.isArray(fee_components) || fee_components.length === 0) {
        return res.status(400).json({ error: 'fee_components array is required' });
      }

      // Verify enquiry belongs to this school
      const enquiryResult = await pool.query(
        `SELECT id FROM enquiries WHERE id = $1 AND school_id = $2`,
        [id, schoolId]
      );
      if (enquiryResult.rows.length === 0) {
        return res.status(404).json({ error: 'Enquiry not found' });
      }

      const lineItems: Array<{
        fee_head_id: string;
        fee_head_name: string;
        effective_amount: number;
        custom_amount?: number;
        transport_route?: string;
        transport_stop?: string;
        selected_activities?: string[];
      }> = [];

      let total = 0;

      for (const component of fee_components) {
        const headResult = await pool.query(
          `SELECT * FROM fee_heads WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
          [component.fee_head_id, schoolId]
        );

        if (headResult.rows.length === 0) {
          return res.status(404).json({
            error: `Fee head not found: ${component.fee_head_id}`,
          });
        }

        const head = headResult.rows[0];

        // Effective amount: custom_amount if provided, else rounded_monthly_fee ?? calculated_monthly_fee ?? amount
        const effectiveAmount =
          component.custom_amount !== undefined
            ? component.custom_amount
            : (head.rounded_monthly_fee ??
               head.calculated_monthly_fee ??
               head.amount ??
               0);

        total += effectiveAmount;

        lineItems.push({
          fee_head_id: head.id,
          fee_head_name: head.name,
          effective_amount: effectiveAmount,
          ...(component.custom_amount !== undefined && { custom_amount: component.custom_amount }),
          ...(component.transport_route && { transport_route: component.transport_route }),
          ...(component.transport_stop && { transport_stop: component.transport_stop }),
          ...(component.selected_activities && { selected_activities: component.selected_activities }),
        });
      }

      return res.json({ line_items: lineItems, total });
    } catch (err) {
      console.error('[enquiries POST /:id/onboarding-fee-assignment]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ── POST /api/v1/financial/enquiries/:id/onboarding-fee-assignment/confirm ────
// Saves the fee assignment for the student linked to this enquiry.
router.post(
  '/:id/onboarding-fee-assignment/confirm',
  permissionGuard('VIEW_FEES'),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const schoolId = req.user!.school_id;
      const { id } = req.params;
      const { fee_components } = req.body as {
        fee_components: Array<{
          fee_head_id: string;
          custom_amount?: number;
          hours_per_day?: number;
          days_per_week?: number;
          transport_route?: string;
          transport_stop?: string;
          selected_activities?: string[];
        }>;
      };

      if (!Array.isArray(fee_components) || fee_components.length === 0) {
        return res.status(400).json({ error: 'fee_components array is required' });
      }

      // Fetch enquiry and verify it belongs to this school and has been converted
      const enquiryResult = await client.query(
        `SELECT * FROM enquiries WHERE id = $1 AND school_id = $2`,
        [id, schoolId]
      );
      if (enquiryResult.rows.length === 0) {
        return res.status(404).json({ error: 'Enquiry not found' });
      }
      const enquiry = enquiryResult.rows[0];

      if (!enquiry.converted_student_id) {
        return res.status(400).json({
          error: 'Enquiry has not been converted to an admission yet',
        });
      }

      const studentId: string = enquiry.converted_student_id;

      await client.query('BEGIN');

      let accountsCreated = 0;

      for (const component of fee_components) {
        const headResult = await client.query(
          `SELECT * FROM fee_heads WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
          [component.fee_head_id, schoolId]
        );

        if (headResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({
            error: `Fee head not found: ${component.fee_head_id}`,
          });
        }

        const head = headResult.rows[0];

        const assignedAmount =
          component.custom_amount !== undefined
            ? component.custom_amount
            : (head.rounded_monthly_fee ??
               head.calculated_monthly_fee ??
               head.amount ??
               0);

        const insertResult = await client.query(
          `INSERT INTO student_fee_accounts (
             student_id, school_id, fee_head_id,
             assigned_amount, outstanding_balance,
             status, admission_date
           ) VALUES ($1, $2, $3, $4, $5, 'pending', CURRENT_DATE)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [studentId, schoolId, head.id, assignedAmount, assignedAmount]
        );

        if (insertResult.rowCount && insertResult.rowCount > 0) {
          accountsCreated++;
        }
      }

      await client.query('COMMIT');

      return res.json({ success: true, accounts_created: accountsCreated });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[enquiries POST /:id/onboarding-fee-assignment/confirm]', err);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  }
);

export default router;
