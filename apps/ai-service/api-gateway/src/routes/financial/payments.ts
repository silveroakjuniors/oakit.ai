import { Router } from 'express';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { pool } from '../../lib/db';
import { jwtVerify, permissionGuard } from '../../middleware/auth';
import { generateReceiptPDF } from '../../lib/pdfService';
import type { BrandingContext, GeneratorContext, ReceiptData } from '../../lib/pdfService';

const router = Router();
router.use(jwtVerify);

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'oakit-uploads';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key || key === 'your_service_role_key_here') return null;
  return createClient(url, key);
}

async function uploadPdfBuffer(buffer: Buffer, path: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) return `/receipts/${path}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: 'application/pdf', upsert: true,
  });
  if (error) throw new Error(`PDF upload failed: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ── POST / — Record a fee payment ────────────────────────────────────────────
router.post('/', permissionGuard('COLLECT_PAYMENT'), async (req, res) => {
  const client = await pool.connect();
  try {
    const schoolId = req.user!.school_id;
    const { student_id, fee_head_id, amount, payment_mode, payment_date, reference_number } = req.body;

    if (!amount || amount <= 0) return res.status(400).json({ error: 'amount must be > 0' });
    if (!student_id || !fee_head_id || !payment_mode || !payment_date)
      return res.status(400).json({ error: 'student_id, fee_head_id, payment_mode, payment_date are required' });

    await client.query('BEGIN');

    // Fetch fee account
    const acctResult = await client.query(
      `SELECT sfa.*, s.name AS student_name, c.name AS class_name
       FROM student_fee_accounts sfa
       JOIN students s ON s.id = sfa.student_id
       LEFT JOIN classes c ON c.id = s.class_id
       WHERE sfa.student_id = $1 AND sfa.fee_head_id = $2 AND sfa.school_id = $3 AND sfa.deleted_at IS NULL`,
      [student_id, fee_head_id, schoolId]
    );
    if (acctResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Fee account not found' });
    }
    const acct = acctResult.rows[0];

    // Sequential receipt number
    const receiptNumResult = await client.query(
      `SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(receipt_number, '[^0-9]', '', 'g'), '') AS INTEGER)), 0) + 1 AS next_num
       FROM fee_payments WHERE school_id = $1`,
      [schoolId]
    );
    const receiptNumber = String(receiptNumResult.rows[0].next_num).padStart(6, '0');

    // Credit balance logic
    const outstanding = parseFloat(acct.outstanding_balance);
    const newBalance = Math.max(0, outstanding - amount);
    const excess = amount > outstanding ? amount - outstanding : 0;

    // Update outstanding balance and status
    const newStatus = newBalance === 0 ? 'paid' : 'partially_paid';
    await client.query(
      `UPDATE student_fee_accounts SET outstanding_balance = $1, status = $2 WHERE id = $3`,
      [newBalance, newStatus, acct.id]
    );

    // Handle credit balance
    if (excess > 0) {
      await client.query(
        `INSERT INTO credit_balances (student_id, school_id, amount)
         VALUES ($1, $2, $3)
         ON CONFLICT (student_id, school_id)
         DO UPDATE SET amount = credit_balances.amount + $3, updated_at = now()`,
        [student_id, schoolId, excess]
      );
    }

    // Fetch school branding
    const schoolResult = await client.query(
      `SELECT name, address FROM schools WHERE id = $1`, [schoolId]
    );
    const school = schoolResult.rows[0] || { name: 'School', address: '' };

    // Fetch fee head name
    const headResult = await client.query(
      `SELECT name FROM fee_heads WHERE id = $1`, [fee_head_id]
    );
    const feeHeadName = headResult.rows[0]?.name || 'Fee';

    // Generate receipt PDF
    const branding: BrandingContext = {
      school_name: school.name,
      school_address: school.address || '',
      logo_url: null,
    };
    const ctx: GeneratorContext = {
      generated_by_name: (req.user as any).name || 'System',
      generated_by_role: req.user!.role,
      generated_at: new Date(),
    };
    const receiptData: ReceiptData = {
      receipt_number: receiptNumber,
      student_name: acct.student_name,
      class_name: acct.class_name || '',
      fee_head_breakdown: [{ name: feeHeadName, amount }],
      amount_paid: amount,
      payment_mode,
      payment_date: new Date(payment_date),
      school_name: school.name,
    };
    const pdfBuffer = await generateReceiptPDF(receiptData, branding, ctx);
    const receiptUrl = await uploadPdfBuffer(pdfBuffer, `receipts/${schoolId}/${receiptNumber}.pdf`);

    // Insert payment record
    const paymentResult = await client.query(
      `INSERT INTO fee_payments (school_id, student_id, fee_head_id, amount, payment_mode, payment_date,
         reference_number, receipt_number, receipt_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [schoolId, student_id, fee_head_id, amount, payment_mode, payment_date,
       reference_number || null, receiptNumber, receiptUrl]
    );

    await client.query('COMMIT');
    return res.status(201).json(paymentResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[payments POST]', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── GET /student/:studentId — Payment history ─────────────────────────────────
router.get('/student/:studentId', permissionGuard('VIEW_FEES'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { studentId } = req.params;
    const result = await pool.query(
      `SELECT fp.*, fh.name AS fee_head_name
       FROM fee_payments fp
       LEFT JOIN fee_heads fh ON fh.id = fp.fee_head_id
       WHERE fp.student_id = $1 AND fp.school_id = $2 AND fp.deleted_at IS NULL
       ORDER BY fp.payment_date DESC`,
      [studentId, schoolId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[payments GET /student/:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /receipt/:paymentId/pdf — Get receipt URL ────────────────────────────
router.get('/receipt/:paymentId/pdf', permissionGuard('VIEW_FEES'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { paymentId } = req.params;
    const result = await pool.query(
      `SELECT receipt_url FROM fee_payments WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
      [paymentId, schoolId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Payment not found' });
    const { receipt_url } = result.rows[0];
    if (!receipt_url) return res.status(404).json({ error: 'Receipt not available' });
    return res.redirect(receipt_url);
  } catch (err) {
    console.error('[payments GET /receipt/:id/pdf]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /invoice/:studentId — Consolidated invoice ───────────────────────────
router.get('/invoice/:studentId', permissionGuard('VIEW_FEES'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { studentId } = req.params;

    const accountsResult = await pool.query(
      `SELECT sfa.*, fh.name AS fee_head_name, fh.type AS fee_head_type
       FROM student_fee_accounts sfa
       JOIN fee_heads fh ON fh.id = sfa.fee_head_id
       WHERE sfa.student_id = $1 AND sfa.school_id = $2 AND sfa.deleted_at IS NULL`,
      [studentId, schoolId]
    );

    const concessionsResult = await pool.query(
      `SELECT c.*, fh.name AS fee_head_name
       FROM concessions c
       JOIN fee_heads fh ON fh.id = c.fee_head_id
       WHERE c.student_id = $1 AND c.school_id = $2 AND c.status = 'approved' AND c.deleted_at IS NULL`,
      [studentId, schoolId]
    );

    const creditResult = await pool.query(
      `SELECT amount FROM credit_balances WHERE student_id = $1 AND school_id = $2`,
      [studentId, schoolId]
    );

    const grossPayable = accountsResult.rows.reduce(
      (sum: number, a: any) => sum + parseFloat(a.outstanding_balance), 0
    );
    const creditBalance = parseFloat(creditResult.rows[0]?.amount || '0');
    const netPayable = Math.max(0, grossPayable - creditBalance);

    return res.json({
      accounts: accountsResult.rows,
      concessions: concessionsResult.rows,
      credit_balance: creditBalance,
      gross_payable: grossPayable,
      net_payable: netPayable,
    });
  } catch (err) {
    console.error('[payments GET /invoice/:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
