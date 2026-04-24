import { Router } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, forceResetGuard, roleGuard } from '../../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
router.use(jwtVerify, forceResetGuard, roleGuard('admin', 'super_admin'));

// Screenshot upload setup
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads', 'payment-screenshots');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir, limits: { fileSize: 5 * 1024 * 1024 } });

// ── GET /api/v1/admin/enquiries ───────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { status } = req.query as { status?: string };

    const params: any[] = [schoolId];
    let query = `SELECT * FROM enquiries WHERE school_id = $1`;

    if (status && ['open', 'converted', 'closed'].includes(status)) {
      params.push(status);
      query += ` AND status = $2`;
    }

    query += ` ORDER BY created_at DESC`;
    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[admin enquiries GET /]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/v1/admin/enquiries/:id ──────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { id } = req.params;
    const { status, notes } = req.body as { status?: string; notes?: string };

    const existing = await pool.query(
      'SELECT id FROM enquiries WHERE id = $1 AND school_id = $2',
      [id, schoolId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }

    const setClauses: string[] = [];
    const values: any[] = [];

    if (status && ['open', 'converted', 'closed'].includes(status)) {
      values.push(status);
      setClauses.push(`status = $${values.length}`);
    }
    if (notes !== undefined) {
      values.push(notes);
      setClauses.push(`notes = $${values.length}`);
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    values.push(id);
    values.push(schoolId);
    const result = await pool.query(
      `UPDATE enquiries SET ${setClauses.join(', ')} WHERE id = $${values.length - 1} AND school_id = $${values.length} RETURNING *`,
      values
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[admin enquiries PUT /:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/v1/admin/enquiries/fee-structures?class_id=xxx ──────────────
// Returns active fee structure with fee heads for a given class
router.get('/fee-structures', async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { class_id } = req.query as { class_id?: string };

    if (!class_id) {
      return res.status(400).json({ error: 'class_id is required' });
    }

    // Find active fee structure for this class
    const structureResult = await pool.query(
      `SELECT * FROM fee_structures WHERE school_id = $1 AND class_id = $2 AND is_active = true ORDER BY created_at DESC LIMIT 1`,
      [schoolId, class_id]
    );

    if (structureResult.rows.length === 0) {
      return res.json(null); // No fee structure — not an error
    }

    const structure = structureResult.rows[0];

    // Fetch fee heads
    const headsResult = await pool.query(
      `SELECT * FROM fee_heads WHERE fee_structure_id = $1 AND school_id = $2 AND deleted_at IS NULL ORDER BY created_at ASC`,
      [structure.id, schoolId]
    );

    return res.json({ ...structure, fee_heads: headsResult.rows });
  } catch (err) {
    console.error('[admin enquiries GET /fee-structures]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/v1/admin/enquiries/student-fee-accounts ────────────────────
// Creates a student_fee_account for a specific fee head
router.post('/student-fee-accounts', async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { student_id, fee_head_id, assigned_amount, outstanding_balance, admission_date } = req.body;

    if (!student_id || !fee_head_id || assigned_amount === undefined) {
      return res.status(400).json({ error: 'student_id, fee_head_id, assigned_amount are required' });
    }

    const result = await pool.query(
      `INSERT INTO student_fee_accounts (student_id, school_id, fee_head_id, assigned_amount, outstanding_balance, status, admission_date)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [student_id, schoolId, fee_head_id, assigned_amount, outstanding_balance ?? assigned_amount, admission_date ?? new Date().toISOString().split('T')[0]]
    );

    return res.status(201).json(result.rows[0] || { message: 'Already exists' });
  } catch (err) {
    console.error('[admin enquiries POST /student-fee-accounts]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/v1/admin/enquiries/payments ────────────────────────────────
// Records an initial payment against a student fee account
router.post('/payments', async (req, res) => {
  const client = await pool.connect();
  try {
    const schoolId = req.user!.school_id;
    const { student_id, fee_head_id, amount, payment_mode, payment_date, reference_number, screenshot_url } = req.body;

    if (!student_id || !fee_head_id || !amount || !payment_mode || !payment_date) {
      return res.status(400).json({ error: 'student_id, fee_head_id, amount, payment_mode, payment_date are required' });
    }

    await client.query('BEGIN');

    // Fetch fee account
    const acctResult = await client.query(
      `SELECT * FROM student_fee_accounts WHERE student_id = $1 AND fee_head_id = $2 AND school_id = $3 AND deleted_at IS NULL`,
      [student_id, fee_head_id, schoolId]
    );

    if (acctResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Fee account not found for this student and fee head' });
    }

    const acct = acctResult.rows[0];
    const outstanding = parseFloat(acct.outstanding_balance);
    const newBalance = Math.max(0, outstanding - amount);
    const newStatus = newBalance === 0 ? 'paid' : 'partially_paid';

    // Update outstanding balance
    await client.query(
      `UPDATE student_fee_accounts SET outstanding_balance = $1, status = $2 WHERE id = $3`,
      [newBalance, newStatus, acct.id]
    );

    // Generate receipt number
    const receiptNumResult = await client.query(
      `SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(receipt_number, '[^0-9]', '', 'g'), '') AS INTEGER)), 0) + 1 AS next_num FROM fee_payments WHERE school_id = $1`,
      [schoolId]
    );
    const receiptNumber = String(receiptNumResult.rows[0].next_num).padStart(6, '0');

    // Insert payment record
    const paymentResult = await client.query(
      `INSERT INTO fee_payments (school_id, student_id, fee_head_id, amount, payment_mode, payment_date, reference_number, receipt_number, receipt_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [schoolId, student_id, fee_head_id, amount, payment_mode, payment_date, reference_number ?? null, receiptNumber, screenshot_url ?? null]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      payment: paymentResult.rows[0],
      receipt_number: receiptNumber,
      new_outstanding_balance: newBalance,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[admin enquiries POST /payments]', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── POST /api/v1/admin/enquiries/upload-screenshot ───────────────────────
// Uploads a payment screenshot and returns the URL
router.post('/upload-screenshot', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const fileUrl = `/uploads/payment-screenshots/${req.file.filename}`;
    return res.json({ url: fileUrl });
  } catch (err) {
    console.error('[admin enquiries POST /upload-screenshot]', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
});

export default router;
