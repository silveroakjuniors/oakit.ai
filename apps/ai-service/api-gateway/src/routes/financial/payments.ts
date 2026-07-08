import { Router } from 'express';
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

// -- GET /check-reference � Check if a reference number is already used --------
router.get('/check-reference', permissionGuard('COLLECT_PAYMENT'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { reference_number } = req.query as { reference_number?: string };
    if (!reference_number?.trim()) return res.json({ is_duplicate: false });

    const result = await pool.query(
      `SELECT fp.id, fp.amount, fp.payment_date, fp.payment_mode,
              s.name AS student_name, c.name AS class_name, fp.receipt_number
       FROM fee_payments fp
       JOIN students s ON s.id = fp.student_id
       LEFT JOIN classes c ON c.id = s.class_id
       WHERE fp.school_id = $1 AND fp.reference_number = $2 AND fp.deleted_at IS NULL
       LIMIT 1`,
      [schoolId, reference_number.trim()]
    );
    return res.json({ is_duplicate: result.rows.length > 0, existing_payment: result.rows[0] || null });
  } catch (err) {
    console.error('[payments GET /check-reference]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// -- POST /request-duplicate-override � Admin flags a proof for principal approval --
router.post('/request-duplicate-override', permissionGuard('COLLECT_PAYMENT'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { proof_id } = req.body;
    if (!proof_id) return res.status(400).json({ error: 'proof_id is required' });

    const result = await pool.query(
      `UPDATE online_payment_proofs
       SET is_duplicate_ref = true, override_requested_by = $1, override_status = 'pending_approval'
       WHERE id = $2 AND school_id = $3 AND status = 'pending'
       RETURNING *`,
      [req.user!.id, proof_id, schoolId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Proof not found' });
    return res.json({ success: true, message: 'Sent to principal for approval.' });
  } catch (err) {
    console.error('[payments POST /request-duplicate-override]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// -- POST /approve-duplicate-override � Principal approves/rejects duplicate ref --
router.post('/approve-duplicate-override', permissionGuard('APPROVE_CONCESSION'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { proof_id, action } = req.body as { proof_id: string; action: 'approve' | 'reject' };
    if (!['approve', 'reject'].includes(action))
      return res.status(400).json({ error: 'action must be approve or reject' });

    const result = await pool.query(
      `UPDATE online_payment_proofs
       SET override_status = $1, override_approved_by = $2, override_approved_at = now(),
           status = CASE WHEN $1 = 'approved' THEN 'pending' ELSE 'rejected' END
       WHERE id = $3 AND school_id = $4 AND override_status = 'pending_approval'
       RETURNING *`,
      [action === 'approve' ? 'approved' : 'rejected', req.user!.id, proof_id, schoolId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Proof not found or not pending approval' });
    return res.json({ success: true });
  } catch (err) {
    console.error('[payments POST /approve-duplicate-override]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// -- POST / � Record a fee payment --------------------------------------------
// Rules:
//   - UPI/online/bank_transfer: reference_number REQUIRED
//   - Duplicate reference_number: blocked (409 with is_duplicate: true)
//   - Cash: receipt generated immediately
//   - UPI/online/bank_transfer: payment recorded, receipt generated ONLY after reconciliation
router.post('/', permissionGuard('COLLECT_PAYMENT'), async (req, res) => {
  const client = await pool.connect();
  try {
    const schoolId = req.user!.school_id;
    const {
      student_id, fee_head_id, amount, payment_mode, payment_date,
      reference_number, screenshot_url, allow_duplicate, override_reason,
    } = req.body;

    if (!amount || amount <= 0)
      return res.status(400).json({ error: 'amount must be > 0' });
    if (!student_id || !fee_head_id || !payment_mode || !payment_date)
      return res.status(400).json({ error: 'student_id, fee_head_id, payment_mode, payment_date are required' });

    const validModes = ['cash', 'upi', 'online', 'bank_transfer'];
    if (!validModes.includes(payment_mode))
      return res.status(400).json({ error: `payment_mode must be one of: ${validModes.join(', ')}` });

    // Reference number mandatory for non-cash
    const needsReconciliation = payment_mode !== 'cash';
    if (needsReconciliation && !reference_number?.trim())
      return res.status(400).json({
        error: 'Reference / UTR number is required for UPI, online, and bank transfer payments.',
        code: 'REFERENCE_REQUIRED',
      });

    // Duplicate reference check — skip if admin explicitly overrode
    if (reference_number?.trim() && !allow_duplicate) {
      const dupCheck = await pool.query(
        `SELECT fp.id, s.name AS student_name, fp.amount, fp.payment_date
         FROM fee_payments fp
         JOIN students s ON s.id = fp.student_id
         WHERE fp.school_id = $1 AND fp.reference_number = $2 AND fp.deleted_at IS NULL
         LIMIT 1`,
        [schoolId, reference_number.trim()]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'This reference number has already been used for another payment.',
          code: 'DUPLICATE_REFERENCE',
          existing_payment: dupCheck.rows[0],
        });
      }
    }

    await client.query('BEGIN');

    // Fetch fee account + student + class info
    const acctResult = await client.query(
      `SELECT sfa.*, s.name AS student_name, c.name AS class_name,
              sc.subdomain AS school_code, fs.academic_year
       FROM student_fee_accounts sfa
       JOIN students s ON s.id = sfa.student_id
       LEFT JOIN classes c ON c.id = s.class_id
       JOIN schools sc ON sc.id = sfa.school_id
       LEFT JOIN fee_heads fh ON fh.id = sfa.fee_head_id
       LEFT JOIN fee_structures fs ON fs.id = fh.fee_structure_id
       WHERE sfa.student_id = $1 AND sfa.fee_head_id = $2 AND sfa.school_id = $3 AND sfa.deleted_at IS NULL`,
      [student_id, fee_head_id, schoolId]
    );
    if (acctResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Fee account not found' });
    }
    const acct = acctResult.rows[0];

    // Generate receipt number: SCHOOLCODE-YY-YY-CLASS-SERIAL
    // e.g. SOJ-26-27-LKG-0001
    const serialResult = await client.query(
      `SELECT COALESCE(MAX(
         CAST(NULLIF(regexp_replace(receipt_number, '^.*-', '', 'g'), '') AS INTEGER)
       ), 0) + 1 AS next_serial
       FROM fee_payments
       WHERE school_id = $1 AND deleted_at IS NULL`,
      [schoolId]
    );
    const serial = String(serialResult.rows[0].next_serial).padStart(4, '0');
    const schoolCode = (acct.school_code || 'SCH').toUpperCase().slice(0, 6);
    const academicYear = acct.academic_year || '';
    const yearShort = academicYear
      ? academicYear.replace(/\d{2}(\d{2})-\d{2}(\d{2})/, '$1-$2')
      : `${new Date().getFullYear().toString().slice(2)}-${(new Date().getFullYear() + 1).toString().slice(2)}`;
    const className = (acct.class_name || 'GEN').toUpperCase().replace(/\s+/g, '').slice(0, 5);
    const receiptNumber = `${schoolCode}-${yearShort}-${className}-${serial}`;

    // Update outstanding balance
    const outstanding = parseFloat(acct.outstanding_balance);
    const newBalance = Math.max(0, outstanding - amount);
    const excess = amount > outstanding ? amount - outstanding : 0;
    const newStatus = newBalance === 0 ? 'paid' : 'partially_paid';

    await client.query(
      `UPDATE student_fee_accounts SET outstanding_balance = $1, status = $2, updated_at = now() WHERE id = $3`,
      [newBalance, newStatus, acct.id]
    );

    // Excess: apply to next pending instalment, then credit balance
    if (excess > 0) {
      const nextAcctResult = await client.query(
        `SELECT sfa.id, sfa.outstanding_balance
         FROM student_fee_accounts sfa
         WHERE sfa.student_id = $1 AND sfa.school_id = $2
           AND sfa.id != $3 AND sfa.outstanding_balance > 0 AND sfa.deleted_at IS NULL
         ORDER BY sfa.created_at ASC LIMIT 1`,
        [student_id, schoolId, acct.id]
      );
      let remainingExcess = excess;
      if (nextAcctResult.rows.length > 0) {
        const next = nextAcctResult.rows[0];
        const nextOutstanding = parseFloat(next.outstanding_balance);
        const applied = Math.min(excess, nextOutstanding);
        const nextNewBalance = nextOutstanding - applied;
        await client.query(
          `UPDATE student_fee_accounts SET outstanding_balance = $1, status = $2, updated_at = now() WHERE id = $3`,
          [nextNewBalance, nextNewBalance === 0 ? 'paid' : 'partially_paid', next.id]
        );
        remainingExcess = excess - applied;
      }
      if (remainingExcess > 0) {
        await client.query(
          `INSERT INTO credit_balances (student_id, school_id, amount)
           VALUES ($1, $2, $3)
           ON CONFLICT (student_id, school_id)
           DO UPDATE SET amount = credit_balances.amount + $3, updated_at = now()`,
          [student_id, schoolId, remainingExcess]
        );
      }
    }

    // Fetch school branding + letterhead
    const schoolResult = await client.query(
      `SELECT s.name, s.contact->>'address' AS address, s.logo_path, hs.letterhead_url
       FROM schools s LEFT JOIN hr_settings hs ON hs.school_id = s.id
       WHERE s.id = $1`, [schoolId]
    );
    const school = schoolResult.rows[0] || { name: 'School', address: '', logo_path: null, letterhead_url: null };

    const headResult = await client.query(`SELECT name FROM fee_heads WHERE id = $1`, [fee_head_id]);
    const feeHeadName = headResult.rows[0]?.name || 'Fee';

    // Fetch parent info for receipt
    const parentResult = await client.query(
      `SELECT father_name, mother_name, parent_contact FROM students WHERE id = $1`,
      [student_id]
    );
    const parentInfo = parentResult.rows[0] || {};

    // Cash: generate receipt immediately. Online/UPI/bank: receipt after reconciliation.
    let receiptUrl: string | null = null;
    let receiptReleasedAt: string | null = null;

    if (!needsReconciliation) {
      const branding: BrandingContext = {
        school_name: school.name,
        school_address: school.address || '',
        logo_url: school.logo_path || null,
        letterhead_url: school.letterhead_url || null,
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
        father_name: parentInfo.father_name || undefined,
        mother_name: parentInfo.mother_name || undefined,
        parent_contact: parentInfo.parent_contact || undefined,
        fee_head_breakdown: [{ name: feeHeadName, amount }],
        amount_paid: amount,
        payment_mode,
        payment_date: new Date(payment_date),
        school_name: school.name,
        outstanding_after_payment: newBalance,
        reference_number: reference_number || undefined,
      };
      const pdfBuffer = await generateReceiptPDF(receiptData, branding, ctx);
      receiptUrl = await uploadPdfBuffer(pdfBuffer, `receipts/${schoolId}/${receiptNumber}.pdf`);
      receiptReleasedAt = new Date().toISOString();
    }

    const paymentResult = await client.query(
      `INSERT INTO fee_payments
         (school_id, student_id, fee_head_id, amount, payment_mode, payment_date,
          reference_number, receipt_number, receipt_url, screenshot_url,
          needs_reconciliation, receipt_released_at,
          override_status, override_reason, override_requested_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [schoolId, student_id, fee_head_id, amount, payment_mode, payment_date,
       reference_number?.trim() || null, receiptNumber, receiptUrl,
       screenshot_url || null, needsReconciliation, receiptReleasedAt,
       allow_duplicate ? 'pending_approval' : null,
       allow_duplicate ? (override_reason || '') : null,
       allow_duplicate ? req.user!.id : null]
    );

    // If this was a duplicate-reference override, log it to audit_logs
    if (allow_duplicate && reference_number?.trim()) {
      pool.query(
        `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, affected_record_id, after_data)
         VALUES ($1,$2,$3,'DUPLICATE_REF_OVERRIDE','fees',$4,$5)`,
        [schoolId, req.user!.id, req.user!.role, paymentResult.rows[0].id,
         JSON.stringify({ reference_number: reference_number.trim(), override_reason: override_reason || '' })]
      ).catch(() => {});
    }

    await client.query('COMMIT');
    return res.status(201).json({
      ...paymentResult.rows[0],
      needs_reconciliation: needsReconciliation,
      reconciliation_message: needsReconciliation
        ? 'Payment recorded. Receipt will be generated after reconciliation with bank statement.'
        : null,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[payments POST]', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// -- GET / � List payments with filters ---------------------------------------
router.get('/', permissionGuard('VIEW_FEES'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { student_id, fee_head_id, payment_mode, from, to, page = '1', limit = '50' } = req.query as Record<string, string>;

    const params: any[] = [schoolId];
    let idx = 2;
    let filters = '';
    if (student_id)   { filters += ` AND fp.student_id = $${idx++}`;    params.push(student_id); }
    if (fee_head_id)  { filters += ` AND fp.fee_head_id = $${idx++}`;   params.push(fee_head_id); }
    if (payment_mode) { filters += ` AND fp.payment_mode = $${idx++}`;  params.push(payment_mode); }
    if (from)         { filters += ` AND fp.payment_date >= $${idx++}`; params.push(from); }
    if (to)           { filters += ` AND fp.payment_date <= $${idx++}`; params.push(to); }

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const offset   = (pageNum - 1) * limitNum;

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM fee_payments fp WHERE fp.school_id = $1 AND fp.deleted_at IS NULL${filters}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    params.push(limitNum, offset);
    const result = await pool.query(
      `SELECT ROW_NUMBER() OVER (ORDER BY fp.payment_date DESC, fp.created_at DESC) AS sl_no,
              fp.*, s.name AS student_name, fh.name AS fee_head_name, c.name AS class_name
       FROM fee_payments fp
       JOIN students s ON s.id = fp.student_id
       JOIN fee_heads fh ON fh.id = fp.fee_head_id
       LEFT JOIN classes c ON c.id = s.class_id
       WHERE fp.school_id = $1 AND fp.deleted_at IS NULL${filters}
       ORDER BY fp.payment_date DESC, fp.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );
    return res.json({ payments: result.rows, total, page: pageNum, limit: limitNum });
  } catch (err) {
    console.error('[payments GET /]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// -- GET /student/:studentId — Payment history ---------------------------------
router.get('/student/:studentId', permissionGuard('VIEW_FEES'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { studentId } = req.params;

    const paymentsResult = await pool.query(
      `SELECT ROW_NUMBER() OVER (ORDER BY fp.payment_date DESC, fp.created_at DESC) AS sl_no,
              fp.*, fh.name AS fee_head_name,
              u_collected.name AS collected_by_name, u_collected.role AS collected_by_role,
              u_reconciled.name AS reconciled_by_name, u_reconciled.role AS reconciled_by_role
       FROM fee_payments fp
       LEFT JOIN fee_heads fh ON fh.id = fp.fee_head_id
       LEFT JOIN users u_collected ON u_collected.id = fp.collected_by
       LEFT JOIN users u_reconciled ON u_reconciled.id = fp.reconciled_by
       WHERE fp.student_id = $1 AND fp.school_id = $2 AND fp.deleted_at IS NULL
       ORDER BY fp.payment_date DESC`,
      [studentId, schoolId]
    ).catch(() =>
      // Fallback if collected_by column doesn't exist yet (migration 087 pending)
      pool.query(
        `SELECT ROW_NUMBER() OVER (ORDER BY fp.payment_date DESC, fp.created_at DESC) AS sl_no,
                fp.*, fh.name AS fee_head_name,
                u_reconciled.name AS reconciled_by_name, u_reconciled.role AS reconciled_by_role
         FROM fee_payments fp
         LEFT JOIN fee_heads fh ON fh.id = fp.fee_head_id
         LEFT JOIN users u_reconciled ON u_reconciled.id = fp.reconciled_by
         WHERE fp.student_id = $1 AND fp.school_id = $2 AND fp.deleted_at IS NULL
         ORDER BY fp.payment_date DESC`,
        [studentId, schoolId]
      )
    );

    const cancellationsResult = await pool.query(
      `SELECT fpc.*, fh.name AS fee_head_name
       FROM fee_payment_cancellations fpc
       LEFT JOIN fee_heads fh ON fh.id = fpc.fee_head_id
       WHERE fpc.student_id = $1 AND fpc.school_id = $2
       ORDER BY fpc.approved_at DESC`,
      [studentId, schoolId]
    ).catch(() => ({ rows: [] as any[] })); // graceful fallback if migration 089 not yet run

    return res.json({
      payments: paymentsResult.rows,
      cancellations: cancellationsResult.rows,
    });
  } catch (err) {
    console.error('[payments GET /student/:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// -- GET /receipt/:paymentId/pdf � Redirect to receipt PDF --------------------
router.get('/receipt/:paymentId/pdf', permissionGuard('VIEW_FEES'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { paymentId } = req.params;
    const result = await pool.query(
      `SELECT receipt_url, needs_reconciliation FROM fee_payments WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
      [paymentId, schoolId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Payment not found' });
    const { receipt_url, needs_reconciliation } = result.rows[0];
    if (needs_reconciliation && !receipt_url)
      return res.status(202).json({ error: 'Receipt pending reconciliation', code: 'RECONCILIATION_PENDING' });
    if (!receipt_url) return res.status(404).json({ error: 'Receipt not available' });
    return res.redirect(receipt_url);
  } catch (err) {
    console.error('[payments GET /receipt/:id/pdf]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// -- GET /invoice/:studentId � Consolidated invoice with instalment details ----
router.get('/invoice/:studentId', permissionGuard('VIEW_FEES'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { studentId } = req.params;

    const [accountsResult, concessionsResult, creditResult, instalmentsResult] = await Promise.all([
      pool.query(
        `SELECT ROW_NUMBER() OVER (ORDER BY fh.name) AS sl_no,
                sfa.*, fh.name AS fee_head_name, fh.type AS fee_head_type,
                fh.pricing_model, fh.instalment_count,
                fs.academic_year, c.name AS class_name
         FROM student_fee_accounts sfa
         JOIN fee_heads fh ON fh.id = sfa.fee_head_id
         JOIN fee_structures fs ON fs.id = fh.fee_structure_id
         LEFT JOIN students s ON s.id = sfa.student_id
         LEFT JOIN classes c ON c.id = s.class_id
         WHERE sfa.student_id = $1 AND sfa.school_id = $2 AND sfa.deleted_at IS NULL`,
        [studentId, schoolId]
      ),
      pool.query(
        `SELECT ROW_NUMBER() OVER (ORDER BY c.created_at DESC) AS sl_no,
                c.*, fh.name AS fee_head_name
         FROM concessions c
         JOIN fee_heads fh ON fh.id = c.fee_head_id
         WHERE c.student_id = $1 AND c.school_id = $2 AND c.status = 'approved' AND c.deleted_at IS NULL`,
        [studentId, schoolId]
      ),
      pool.query(
        `SELECT amount FROM credit_balances WHERE student_id = $1 AND school_id = $2`,
        [studentId, schoolId]
      ),
      // Pending instalments for all fee heads assigned to this student
      pool.query(
        `SELECT fi.id, fi.fee_head_id, fi.instalment_number, fi.label, fi.amount, fi.due_date,
                COALESCE((
                  SELECT SUM(fp.amount) FROM fee_payments fp
                  WHERE fp.student_id = $1 AND fp.fee_head_id = fi.fee_head_id
                    AND fp.school_id = $2 AND fp.deleted_at IS NULL
                ), 0) AS total_paid_for_head
         FROM fee_instalments fi
         JOIN student_fee_accounts sfa
           ON sfa.fee_head_id = fi.fee_head_id AND sfa.student_id = $1
           AND sfa.school_id = $2 AND sfa.deleted_at IS NULL
         WHERE fi.school_id = $2
         ORDER BY fi.fee_head_id, fi.instalment_number ASC`,
        [studentId, schoolId]
      ),
    ]);

    // Compute pending instalments per fee head
    const instalmentsByHead: Record<string, any[]> = {};
    for (const inst of instalmentsResult.rows) {
      if (!instalmentsByHead[inst.fee_head_id]) instalmentsByHead[inst.fee_head_id] = [];
      instalmentsByHead[inst.fee_head_id].push(inst);
    }

    const accountsWithInstalments = accountsResult.rows.map((acc: any) => {
      const insts = instalmentsByHead[acc.fee_head_id] || [];
      if (insts.length === 0) return { ...acc, instalments: [], next_instalment: null };

      const totalPaid = parseFloat(insts[0]?.total_paid_for_head || '0');
      let cumulative = 0;
      const pendingInstalments = insts.filter((inst: any) => {
        cumulative += parseFloat(inst.amount);
        return cumulative > totalPaid;
      });

      return {
        ...acc,
        instalments: pendingInstalments,
        next_instalment: pendingInstalments[0] || null,
        total_instalments: insts.length,
        pending_instalments_count: pendingInstalments.length,
      };
    });

    const grossPayable = accountsResult.rows.reduce(
      (sum: number, a: any) => sum + parseFloat(a.outstanding_balance), 0
    );
    const creditBalance = parseFloat(creditResult.rows[0]?.amount || '0');
    const netPayable = Math.max(0, grossPayable - creditBalance);

    // Reconciliation pending: UPI/online/bank payments recorded but not yet matched
    const reconResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*)::int AS count
       FROM fee_payments
       WHERE student_id = $1 AND school_id = $2
         AND needs_reconciliation = true
         AND reconciled_at IS NULL
         AND deleted_at IS NULL`,
      [studentId, schoolId]
    );
    const reconPendingAmount = parseFloat(reconResult.rows[0]?.total || '0');
    const reconPendingCount = reconResult.rows[0]?.count || 0;

    // Total assigned across all fee heads
    const totalAssigned = accountsResult.rows.reduce(
      (sum: number, a: any) => sum + parseFloat(a.assigned_amount), 0
    );

    // Total actually paid = sum of all non-deleted fee_payments for this student
    // total_paid = all payments received (cash + UPI/bank, reconciled or not)
    // reconciliation_pending = UPI/bank not yet matched to bank statement (informational only)
    const paidResult = await pool.query(
      `SELECT
         COALESCE(SUM(amount), 0) AS total_paid
       FROM fee_payments
       WHERE student_id = $1 AND school_id = $2 AND deleted_at IS NULL`,
      [studentId, schoolId]
    );
    const totalPaid = parseFloat(paidResult.rows[0]?.total_paid || '0');
    const confirmedPaid = totalPaid; // all received payments count as paid

    // Total concessions applied
    const totalConcessions = concessionsResult.rows.reduce((sum: number, c: any) => {
      if (c.type === 'fixed') return sum + parseFloat(c.value);
      // percentage: applied against the fee head's assigned amount
      const acct = accountsResult.rows.find((a: any) => a.fee_head_id === c.fee_head_id);
      if (acct) return sum + (parseFloat(acct.assigned_amount) * parseFloat(c.value) / 100);
      return sum;
    }, 0);

    return res.json({
      accounts: accountsWithInstalments,
      concessions: concessionsResult.rows,
      credit_balance: creditBalance,
      gross_payable: grossPayable,
      net_payable: netPayable,
      total_assigned: totalAssigned,
      total_paid: totalPaid,
      confirmed_paid: confirmedPaid,
      total_concessions: Math.round(totalConcessions * 100) / 100,
      reconciliation_pending_amount: reconPendingAmount,
      reconciliation_pending_count: reconPendingCount,
    });
  } catch (err) {
    console.error('[payments GET /invoice/:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /pending-overrides — Principal sees all payments awaiting override approval
router.get('/pending-overrides', permissionGuard('APPROVE_CONCESSION'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const result = await pool.query(
      `SELECT
         fp.id, fp.amount, fp.payment_mode, fp.payment_date,
         fp.reference_number, fp.receipt_number, fp.override_reason,
         fp.created_at,
         s.name AS student_name, c.name AS class_name,
         fh.name AS fee_head_name,
         u.name AS requested_by_name, u.role AS requested_by_role
       FROM fee_payments fp
       JOIN students s ON s.id = fp.student_id
       LEFT JOIN classes c ON c.id = s.class_id
       JOIN fee_heads fh ON fh.id = fp.fee_head_id
       LEFT JOIN users u ON u.id = fp.override_requested_by
       WHERE fp.school_id = $1
         AND fp.override_status = 'pending_approval'
         AND fp.deleted_at IS NULL
       ORDER BY fp.created_at DESC`,
      [schoolId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[payments GET /pending-overrides]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /:id/approve-override — Principal approves or rejects a duplicate-ref override
router.post('/:id/approve-override', permissionGuard('APPROVE_CONCESSION'), async (req, res) => {
  const client = await pool.connect();
  try {
    const schoolId = req.user!.school_id;
    const { id } = req.params;
    const { action, rejection_reason } = req.body as {
      action: 'approve' | 'reject';
      rejection_reason?: string;
    };

    if (!['approve', 'reject'].includes(action))
      return res.status(400).json({ error: 'action must be approve or reject' });
    if (action === 'reject' && !rejection_reason?.trim())
      return res.status(400).json({ error: 'rejection_reason is required when rejecting' });

    await client.query('BEGIN');

    const paymentResult = await client.query(
      `SELECT fp.*, s.name AS student_name
       FROM fee_payments fp
       JOIN students s ON s.id = fp.student_id
       WHERE fp.id = $1 AND fp.school_id = $2
         AND fp.override_status = 'pending_approval' AND fp.deleted_at IS NULL`,
      [id, schoolId]
    );
    if (paymentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment not found or not pending override approval' });
    }
    const payment = paymentResult.rows[0];

    if (action === 'approve') {
      await client.query(
        `UPDATE fee_payments
         SET override_status = 'approved', override_approved_by = $1, override_approved_at = now()
         WHERE id = $2`,
        [req.user!.id, id]
      );
    } else {
      // Reject: reverse the payment — restore outstanding balance
      const acctResult = await client.query(
        `SELECT id, outstanding_balance, assigned_amount FROM student_fee_accounts
         WHERE student_id = $1 AND fee_head_id = $2 AND school_id = $3 AND deleted_at IS NULL`,
        [payment.student_id, payment.fee_head_id, schoolId]
      );
      if (acctResult.rows.length > 0) {
        const acct = acctResult.rows[0];
        const restored = Math.min(
          parseFloat(acct.assigned_amount),
          parseFloat(acct.outstanding_balance) + parseFloat(payment.amount)
        );
        const newStatus = restored >= parseFloat(acct.assigned_amount) ? 'pending' : 'partially_paid';
        await client.query(
          `UPDATE student_fee_accounts SET outstanding_balance = $1, status = $2, updated_at = now() WHERE id = $3`,
          [restored, newStatus, acct.id]
        );
      }
      // Soft-delete the payment and mark rejected
      await client.query(
        `UPDATE fee_payments
         SET override_status = 'rejected', override_approved_by = $1, override_approved_at = now(),
             deleted_at = now()
         WHERE id = $2 AND school_id = $3`,
        [req.user!.id, id, schoolId]
      );
    }

    await client.query('COMMIT');

    // Audit log — use pool (outside transaction) so a failure doesn't roll back the approval
    pool.query(
      `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, affected_record_id, after_data)
       VALUES ($1,$2,$3,$4,'fees',$5,$6)`,
      [schoolId, req.user!.id, req.user!.role,
       action === 'approve' ? 'APPROVE_OVERRIDE' : 'REJECT_OVERRIDE',
       id, JSON.stringify({ action, rejection_reason: rejection_reason || '' })]
    ).catch(() => {});

    return res.json({ success: true, action });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[payments POST /:id/approve-override]', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── POST /:id/reverse — Reverse a payment (principal only) ───────────────────
router.post('/:id/reverse', permissionGuard('COLLECT_PAYMENT'), async (req, res) => {
  const client = await pool.connect();
  try {
    const schoolId = req.user!.school_id;
    const { id } = req.params;
    const { reason } = req.body as { reason?: string };

    if (!reason?.trim())
      return res.status(400).json({ error: 'reason is required for payment reversal' });
    if (!['principal', 'super_admin'].includes(req.user!.role))
      return res.status(403).json({ error: 'Only the Principal can reverse payments' });

    await client.query('BEGIN');

    const paymentResult = await client.query(
      `SELECT fp.*, fh.name AS fee_head_name FROM fee_payments fp
       LEFT JOIN fee_heads fh ON fh.id = fp.fee_head_id
       WHERE fp.id = $1 AND fp.school_id = $2 AND fp.deleted_at IS NULL`,
      [id, schoolId]
    );
    if (paymentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment not found' });
    }
    const payment = paymentResult.rows[0];
    const reversedAmount = parseFloat(payment.amount);

    const acctResult = await client.query(
      `SELECT id, outstanding_balance, assigned_amount FROM student_fee_accounts
       WHERE student_id = $1 AND fee_head_id = $2 AND school_id = $3 AND deleted_at IS NULL`,
      [payment.student_id, payment.fee_head_id, schoolId]
    );
    if (acctResult.rows.length > 0) {
      const acct = acctResult.rows[0];
      const restoredBalance = Math.min(
        parseFloat(acct.assigned_amount),
        parseFloat(acct.outstanding_balance) + reversedAmount
      );
      const newStatus = restoredBalance >= parseFloat(acct.assigned_amount) ? 'pending' : 'partially_paid';
      await client.query(
        `UPDATE student_fee_accounts SET outstanding_balance = $1, status = $2, updated_at = now() WHERE id = $3`,
        [restoredBalance, newStatus, acct.id]
      );
    }

    const creditResult = await client.query(
      `SELECT id, amount FROM credit_balances WHERE student_id = $1 AND school_id = $2`,
      [payment.student_id, schoolId]
    );
    if (creditResult.rows.length > 0) {
      const newCredit = Math.max(0, parseFloat(creditResult.rows[0].amount) - reversedAmount);
      await client.query(
        `UPDATE credit_balances SET amount = $1, updated_at = now() WHERE id = $2`,
        [newCredit, creditResult.rows[0].id]
      );
    }

    await client.query(`UPDATE fee_payments SET deleted_at = now() WHERE id = $1`, [id]);

    await client.query('COMMIT');

    pool.query(
      `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, affected_record_id, before_data, after_data)
       VALUES ($1,$2,$3,'REVERSE_PAYMENT','fees',$4,$5,$6)`,
      [schoolId, req.user!.id, req.user!.role, id,
       JSON.stringify(payment), JSON.stringify({ reversed_amount: reversedAmount, reason })]
    ).catch(() => {});

    return res.json({ success: true, reversed_payment_id: id, reversed_amount: reversedAmount });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[payments POST /:id/reverse]', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── POST /:id/request-cancel — Admin requests receipt cancellation ────────────
router.post('/:id/request-cancel', permissionGuard('COLLECT_PAYMENT'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { id } = req.params;
    const { reason } = req.body as { reason?: string };

    if (!reason?.trim())
      return res.status(400).json({ error: 'reason is required' });

    const result = await pool.query(
      `UPDATE fee_payments
       SET cancel_status = 'pending_approval',
           cancel_reason = $1,
           cancel_requested_by = $2,
           cancel_requested_at = now()
       WHERE id = $3 AND school_id = $4
         AND deleted_at IS NULL
         AND (cancel_status IS NULL OR cancel_status = 'rejected')
       RETURNING id, receipt_number`,
      [reason.trim(), req.user!.id, id, schoolId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Payment not found or already has a pending cancellation request' });

    return res.json({ success: true, receipt_number: result.rows[0].receipt_number });
  } catch (err) {
    console.error('[payments POST /:id/request-cancel]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /pending-cancellations — Principal sees all pending cancel requests ───
router.get('/pending-cancellations', permissionGuard('APPROVE_CONCESSION'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const result = await pool.query(
      `SELECT
         fp.id, fp.amount, fp.payment_mode, fp.payment_date,
         fp.reference_number, fp.receipt_number, fp.receipt_url,
         fp.cancel_reason, fp.cancel_requested_at,
         s.name AS student_name, c.name AS class_name,
         fh.name AS fee_head_name,
         u.name AS requested_by_name, u.role AS requested_by_role
       FROM fee_payments fp
       JOIN students s ON s.id = fp.student_id
       LEFT JOIN classes c ON c.id = s.class_id
       JOIN fee_heads fh ON fh.id = fp.fee_head_id
       LEFT JOIN users u ON u.id = fp.cancel_requested_by
       WHERE fp.school_id = $1
         AND fp.cancel_status = 'pending_approval'
         AND fp.deleted_at IS NULL
       ORDER BY fp.cancel_requested_at DESC`,
      [schoolId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[payments GET /pending-cancellations]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /:id/approve-cancel — Principal approves or rejects cancellation ─────
router.post('/:id/approve-cancel', permissionGuard('APPROVE_CONCESSION'), async (req, res) => {
  const client = await pool.connect();
  try {
    const schoolId = req.user!.school_id;
    const { id } = req.params;
    const { action, rejection_reason } = req.body as {
      action: 'approve' | 'reject';
      rejection_reason?: string;
    };

    if (!['approve', 'reject'].includes(action))
      return res.status(400).json({ error: 'action must be approve or reject' });
    if (action === 'reject' && !rejection_reason?.trim())
      return res.status(400).json({ error: 'rejection_reason is required when rejecting' });

    await client.query('BEGIN');

    const pmtResult = await client.query(
      `SELECT fp.*,
              s.name AS student_name,
              u_req.name AS requested_by_name,
              u_req.role AS requested_by_role
       FROM fee_payments fp
       JOIN students s ON s.id = fp.student_id
       LEFT JOIN users u_req ON u_req.id = fp.cancel_requested_by
       WHERE fp.id = $1 AND fp.school_id = $2
         AND fp.cancel_status = 'pending_approval' AND fp.deleted_at IS NULL`,
      [id, schoolId]
    );
    if (pmtResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment not found or not pending cancellation approval' });
    }
    const pmt = pmtResult.rows[0];

    if (action === 'reject') {
      await client.query(
        `UPDATE fee_payments
         SET cancel_status = 'rejected',
             cancel_approved_by = $1,
             cancel_approved_at = now()
         WHERE id = $2`,
        [req.user!.id, id]
      );
      await client.query('COMMIT');
      return res.json({ success: true, action: 'rejected' });
    }

    // ── APPROVE: hard-delete payment, restore balance, log cancellation ──────

    // 1. Restore outstanding balance on student_fee_accounts
    const acctResult = await client.query(
      `SELECT id, outstanding_balance, assigned_amount FROM student_fee_accounts
       WHERE student_id = $1 AND fee_head_id = $2 AND school_id = $3 AND deleted_at IS NULL`,
      [pmt.student_id, pmt.fee_head_id, schoolId]
    );
    if (acctResult.rows.length > 0) {
      const acct = acctResult.rows[0];
      const restored = Math.min(
        parseFloat(acct.assigned_amount),
        parseFloat(acct.outstanding_balance) + parseFloat(pmt.amount)
      );
      const newStatus = restored >= parseFloat(acct.assigned_amount) ? 'pending' : 'partially_paid';
      await client.query(
        `UPDATE student_fee_accounts
         SET outstanding_balance = $1, status = $2, updated_at = now()
         WHERE id = $3`,
        [restored, newStatus, acct.id]
      );
    }

    // 2. Reverse any credit balance that was created from excess payment
    await client.query(
      `UPDATE credit_balances
       SET amount = GREATEST(0, amount - $1), updated_at = now()
       WHERE student_id = $2 AND school_id = $3`,
      [pmt.amount, pmt.student_id, schoolId]
    );

    // 3. Write cancellation audit record (survives hard-delete)
    const approverResult = await client.query(
      `SELECT name, role FROM users WHERE id = $1`, [req.user!.id]
    );
    const approver = approverResult.rows[0] || { name: 'Principal', role: 'principal' };

    await client.query(
      `INSERT INTO fee_payment_cancellations
         (school_id, student_id, fee_head_id, original_payment_id,
          receipt_number, amount, payment_mode, payment_date, reference_number,
          cancel_reason, requested_by, requested_by_name,
          approved_by, approved_by_name, approved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now())`,
      [
        schoolId, pmt.student_id, pmt.fee_head_id, id,
        pmt.receipt_number, pmt.amount, pmt.payment_mode, pmt.payment_date,
        pmt.reference_number || null,
        pmt.cancel_reason,
        pmt.cancel_requested_by, pmt.requested_by_name || null,
        req.user!.id, approver.name,
      ]
    );

    // 4. Hard-delete the payment record
    await client.query(`DELETE FROM fee_payments WHERE id = $1`, [id]);

    await client.query('COMMIT');

    pool.query(
      `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, after_data)
       VALUES ($1,$2,$3,'CANCEL_PAYMENT','fees',$4)`,
      [schoolId, req.user!.id, req.user!.role,
       JSON.stringify({ receipt_number: pmt.receipt_number, amount: pmt.amount, reason: pmt.cancel_reason })]
    ).catch(() => {});

    return res.json({ success: true, action: 'approved', receipt_number: pmt.receipt_number });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[payments POST /:id/approve-cancel]', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

export default router;
