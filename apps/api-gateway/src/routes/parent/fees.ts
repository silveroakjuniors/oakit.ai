import { Router } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify);

// Helper: verify parent owns the student
async function verifyParentOwnsStudent(parentId: string, studentId: string, schoolId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM parent_student_links sp
     JOIN students s ON s.id = sp.student_id
     WHERE sp.parent_id = $1 AND sp.student_id = $2 AND s.school_id = $3`,
    [parentId, studentId, schoolId]
  );
  return result.rows.length > 0;
}

// ── GET /invoice/:studentId — Consolidated invoice ───────────────────────────
router.get('/invoice/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const parentId = req.user!.id;
    const schoolId = req.user!.school_id;

    if (!(await verifyParentOwnsStudent(parentId, studentId, schoolId)))
      return res.status(403).json({ error: 'Access denied' });

    const accountsResult = await pool.query(
      `SELECT sfa.*, fh.name AS fee_head_name, fh.type AS fee_head_type
       FROM student_fee_accounts sfa
       JOIN fee_heads fh ON fh.id = sfa.fee_head_id
       WHERE sfa.student_id = $1 AND sfa.school_id = $2 AND sfa.deleted_at IS NULL`,
      [studentId, schoolId]
    );

    const concessionsResult = await pool.query(
      `SELECT c.*, fh.name AS fee_head_name
       FROM concessions c JOIN fee_heads fh ON fh.id = c.fee_head_id
       WHERE c.student_id = $1 AND c.school_id = $2 AND c.status = 'approved' AND c.deleted_at IS NULL`,
      [studentId, schoolId]
    );

    const creditResult = await pool.query(
      `SELECT amount FROM credit_balances WHERE student_id = $1 AND school_id = $2`,
      [studentId, schoolId]
    );

    const usageResult = await pool.query(
      `SELECT ur.fee_head_id, fh.name AS fee_head_name, SUM(ur.quantity) AS total_quantity, fh.rate
       FROM usage_records ur JOIN fee_heads fh ON fh.id = ur.fee_head_id
       WHERE ur.student_id = $1 AND ur.school_id = $2
         AND ur.billing_period_year = EXTRACT(YEAR FROM CURRENT_DATE)
         AND ur.billing_period_month = EXTRACT(MONTH FROM CURRENT_DATE)
       GROUP BY ur.fee_head_id, fh.name, fh.rate`,
      [studentId, schoolId]
    );

    const grossPayable = accountsResult.rows.reduce(
      (sum: number, a: any) => sum + parseFloat(a.outstanding_balance), 0
    );
    const creditBalance = parseFloat(creditResult.rows[0]?.amount || '0');
    const netPayable = Math.max(0, grossPayable - creditBalance);

    return res.json({
      student_id: studentId,
      accounts: accountsResult.rows,
      concessions: concessionsResult.rows,
      usage_charges: usageResult.rows,
      credit_balance: creditBalance,
      gross_payable: grossPayable,
      net_payable: netPayable,
      non_refundable_notice: 'Please note: Fees once paid cannot be refunded under any circumstances. Please verify the amount before making payment.',
    });
  } catch (err) {
    console.error('[parent/fees GET /invoice/:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /history/:studentId — Payment history ─────────────────────────────────
router.get('/history/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const parentId = req.user!.id;
    const schoolId = req.user!.school_id;

    if (!(await verifyParentOwnsStudent(parentId, studentId, schoolId)))
      return res.status(403).json({ error: 'Access denied' });

    const result = await pool.query(
      `SELECT fp.*, fh.name AS fee_head_name
       FROM fee_payments fp LEFT JOIN fee_heads fh ON fh.id = fp.fee_head_id
       WHERE fp.student_id = $1 AND fp.school_id = $2 AND fp.deleted_at IS NULL
       ORDER BY fp.payment_date DESC`,
      [studentId, schoolId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[parent/fees GET /history/:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /receipt/:paymentId — Stream receipt PDF ──────────────────────────────
router.get('/receipt/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const parentId = req.user!.id;
    const schoolId = req.user!.school_id;

    const paymentResult = await pool.query(
      `SELECT fp.*, fp.student_id FROM fee_payments fp
       WHERE fp.id = $1 AND fp.school_id = $2 AND fp.deleted_at IS NULL`,
      [paymentId, schoolId]
    );
    if (paymentResult.rows.length === 0) return res.status(404).json({ error: 'Payment not found' });

    const payment = paymentResult.rows[0];
    if (!(await verifyParentOwnsStudent(parentId, payment.student_id, schoolId)))
      return res.status(403).json({ error: 'Access denied' });

    if (!payment.receipt_url) return res.status(404).json({ error: 'Receipt not available' });
    return res.redirect(payment.receipt_url);
  } catch (err) {
    console.error('[parent/fees GET /receipt/:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /pay/:studentId — Initiate online payment ───────────────────────────
router.post('/pay/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const parentId = req.user!.id;
    const schoolId = req.user!.school_id;
    const { amount, fee_head_id, acknowledged_non_refundable } = req.body;

    if (!acknowledged_non_refundable)
      return res.status(400).json({
        error: 'You must acknowledge the non-refundable notice before proceeding.',
        code: 'NON_REFUNDABLE_NOTICE_REQUIRED',
        notice: 'Please note: Fees once paid cannot be refunded under any circumstances.',
      });

    if (!(await verifyParentOwnsStudent(parentId, studentId, schoolId)))
      return res.status(403).json({ error: 'Access denied' });

    if (!amount || amount <= 0) return res.status(400).json({ error: 'amount must be > 0' });

    // Determine gateway from school settings (default Razorpay)
    const gateway = process.env.PAYMENT_GATEWAY || 'razorpay';
    const orderId = `ORD_${Date.now()}_${studentId.slice(0, 8)}`;

    // In production, create an order via Razorpay/PhonePe SDK here
    // For now, return the order details for the frontend to complete payment
    return res.json({
      gateway,
      order_id: orderId,
      amount,
      currency: 'INR',
      student_id: studentId,
      fee_head_id,
      key_id: process.env.RAZORPAY_KEY_ID || '',
      non_refundable_notice: 'Please note: Fees once paid cannot be refunded under any circumstances.',
    });
  } catch (err) {
    console.error('[parent/fees POST /pay/:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /siblings — Consolidated outstanding across all children ──────────────
router.get('/siblings', async (req, res) => {
  try {
    const parentId = req.user!.id;
    const schoolId = req.user!.school_id;

    const studentsResult = await pool.query(
      `SELECT s.id, s.name FROM parent_student_links sp
       JOIN students s ON s.id = sp.student_id
       WHERE sp.parent_id = $1 AND s.school_id = $2 AND s.is_active = true`,
      [parentId, schoolId]
    );

    const siblings = await Promise.all(
      studentsResult.rows.map(async (student: any) => {
        const balanceResult = await pool.query(
          `SELECT COALESCE(SUM(outstanding_balance), 0) AS total_outstanding
           FROM student_fee_accounts
           WHERE student_id = $1 AND school_id = $2 AND deleted_at IS NULL`,
          [student.id, schoolId]
        );
        const creditResult = await pool.query(
          `SELECT COALESCE(amount, 0) AS credit FROM credit_balances
           WHERE student_id = $1 AND school_id = $2`,
          [student.id, schoolId]
        );
        const outstanding = parseFloat(balanceResult.rows[0].total_outstanding);
        const credit = parseFloat(creditResult.rows[0]?.credit || '0');
        return {
          student_id: student.id,
          student_name: student.name,
          outstanding_balance: outstanding,
          credit_balance: credit,
          net_payable: Math.max(0, outstanding - credit),
        };
      })
    );

    const totalNetPayable = siblings.reduce((s: number, c: any) => s + c.net_payable, 0);
    return res.json({ children: siblings, total_net_payable: totalNetPayable });
  } catch (err) {
    console.error('[parent/fees GET /siblings]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /payment-proof — Parent submits transaction ID + optional screenshot ─
router.post('/payment-proof', async (req, res) => {
  try {
    const parentId = req.user!.id;
    const schoolId = req.user!.school_id;
    const { transaction_id, student_id } = req.body;

    if (!transaction_id && !req.file) {
      return res.status(400).json({ error: 'transaction_id or receipt file is required' });
    }

    // Verify parent owns the student if provided
    if (student_id && !(await verifyParentOwnsStudent(parentId, student_id, schoolId))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Store the payment proof submission
    await pool.query(
      `INSERT INTO parent_payment_proofs
         (school_id, parent_id, student_id, transaction_id, status, created_at)
       VALUES ($1, $2, $3, $4, 'pending', now())
       ON CONFLICT DO NOTHING`,
      [schoolId, parentId, student_id || null, transaction_id || null]
    ).catch(async () => {
      // Table may not exist yet — create it and retry
      await pool.query(`
        CREATE TABLE IF NOT EXISTS parent_payment_proofs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
          parent_id UUID NOT NULL,
          student_id UUID,
          transaction_id TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          admin_note TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          reviewed_at TIMESTAMPTZ
        )
      `);
      await pool.query(
        `INSERT INTO parent_payment_proofs (school_id, parent_id, student_id, transaction_id, status, created_at)
         VALUES ($1, $2, $3, $4, 'pending', now())`,
        [schoolId, parentId, student_id || null, transaction_id || null]
      );
    });

    return res.json({ ok: true, message: 'Payment proof submitted. Admin will verify and update your fee status.' });
  } catch (err) {
    console.error('[parent/fees POST /payment-proof]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
