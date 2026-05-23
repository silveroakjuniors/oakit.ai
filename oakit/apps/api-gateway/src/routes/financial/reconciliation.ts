import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { pool } from '../../lib/db';
import { jwtVerify, permissionGuard } from '../../middleware/auth';
import { generateReceiptPDF } from '../../lib/pdfService';
import type { BrandingContext, GeneratorContext, ReceiptData } from '../../lib/pdfService';

const router = Router();
router.use(jwtVerify);

const upload = multer({ dest: './uploads/reconciliation-tmp/' });
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'oakit-uploads';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key || key === 'your_service_role_key_here') return null;
  return createClient(url, key);
}

async function uploadPdfBuffer(buffer: Buffer, storagePath: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) return `/receipts/${storagePath}`;
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: 'application/pdf', upsert: true,
  });
  if (error) throw new Error(`PDF upload failed: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

// ── GET /bank — List all bank reconciliation uploads ─────────────────────────
router.get('/bank', permissionGuard('VIEW_RECONCILIATION'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const result = await pool.query(
      `SELECT
         ROW_NUMBER() OVER (ORDER BY bru.created_at DESC) AS sl_no,
         bru.*,
         COUNT(bri.id) AS total_items,
         COUNT(bri.id) FILTER (WHERE bri.match_status = 'matched') AS matched_items,
         COUNT(bri.id) FILTER (WHERE bri.match_status = 'unmatched') AS unmatched_items
       FROM bank_reconciliation_uploads bru
       LEFT JOIN bank_reconciliation_items bri ON bri.upload_id = bru.id
       WHERE bru.school_id = $1
       GROUP BY bru.id
       ORDER BY bru.created_at DESC`,
      [schoolId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[reconciliation GET /bank]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /bank/upload — Upload bank statement ─────────────────────────────────
router.post('/bank/upload', permissionGuard('PERFORM_RECONCILIATION'), upload.single('file'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!['.pdf', '.csv'].includes(ext)) {
      return res.status(400).json({ error: 'Only PDF or CSV files are accepted for bank reconciliation' });
    }

    // Upload to Supabase Storage
    const supabase = getSupabase();
    let fileUrl = `/uploads/reconciliation-tmp/${req.file.filename}`;
    if (supabase) {
      const fs = await import('fs');
      const buffer = fs.readFileSync(req.file.path);
      const storagePath = `${schoolId}/reconciliation/${Date.now()}-${req.file.originalname}`;
      const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
        contentType: req.file.mimetype, upsert: false,
      });
      if (!error) {
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
        fileUrl = data.publicUrl;
      }
      fs.unlinkSync(req.file.path);
    }

    // Create upload record
    const uploadResult = await pool.query(
      `INSERT INTO bank_reconciliation_uploads (school_id, uploaded_by, file_url, status)
       VALUES ($1,$2,$3,'processing') RETURNING *`,
      [schoolId, req.user!.id, fileUrl]
    );
    const uploadId = uploadResult.rows[0].id;

    // Call AI service to extract transactions (fire-and-forget, update status async)
    setImmediate(async () => {
      try {
        const aiRes = await fetch(`${AI_SERVICE_URL}/extract-bank-statement`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_url: fileUrl, upload_id: uploadId, school_id: schoolId }),
        });
        if (!aiRes.ok) throw new Error(`AI service error: ${aiRes.status}`);
        const aiData: any = await aiRes.json();
        const transactions: Array<{ date: string; amount: number; reference: string }> =
          aiData.transactions || [];

        // Fetch existing payments for matching
        const payments = await pool.query(
          `SELECT id, amount, reference_number, payment_date FROM fee_payments
           WHERE school_id = $1 AND deleted_at IS NULL`,
          [schoolId]
        );

        for (const tx of transactions) {
          // Simple matching: same amount + reference
          const match = payments.rows.find(
            (p: any) =>
              parseFloat(p.amount) === tx.amount &&
              (p.reference_number === tx.reference || !tx.reference)
          );
          const matchStatus = match ? 'matched' : 'unmatched';
          await pool.query(
            `INSERT INTO bank_reconciliation_items
               (upload_id, school_id, transaction_date, amount, reference, match_status, matched_payment_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [uploadId, schoolId, tx.date, tx.amount, tx.reference || null,
             matchStatus, match?.id || null]
          );
        }

        await pool.query(
          `UPDATE bank_reconciliation_uploads SET status = 'completed' WHERE id = $1`, [uploadId]
        );
      } catch (e) {
        console.error('[reconciliation AI extraction]', e);
        await pool.query(
          `UPDATE bank_reconciliation_uploads SET status = 'failed' WHERE id = $1`, [uploadId]
        );
      }
    });

    return res.status(201).json({ upload_id: uploadId, status: 'processing' });
  } catch (err) {
    console.error('[reconciliation POST /bank/upload]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /bank/:uploadId — Get reconciliation summary ─────────────────────────
router.get('/bank/:uploadId', permissionGuard('VIEW_RECONCILIATION'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { uploadId } = req.params;

    const uploadResult = await pool.query(
      `SELECT * FROM bank_reconciliation_uploads WHERE id = $1 AND school_id = $2`,
      [uploadId, schoolId]
    );
    if (uploadResult.rows.length === 0) return res.status(404).json({ error: 'Upload not found' });

    const summary = await pool.query(
      `SELECT match_status, COUNT(*) AS count, SUM(amount) AS total
       FROM bank_reconciliation_items WHERE upload_id = $1 AND school_id = $2
       GROUP BY match_status`,
      [uploadId, schoolId]
    );

    const items = await pool.query(
      `SELECT
         ROW_NUMBER() OVER (ORDER BY transaction_date DESC) AS sl_no,
         *
       FROM bank_reconciliation_items
       WHERE upload_id = $1 AND school_id = $2
       ORDER BY transaction_date DESC`,
      [uploadId, schoolId]
    );

    return res.json({
      upload: uploadResult.rows[0],
      summary: summary.rows,
      items: items.rows,
    });
  } catch (err) {
    console.error('[reconciliation GET /bank/:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /bank/:uploadId/confirm — Confirm reconciliation ────────────────────
router.post('/bank/:uploadId/confirm', permissionGuard('PERFORM_RECONCILIATION'), async (req, res) => {
  const client = await pool.connect();
  try {
    const schoolId = req.user!.school_id;
    const { uploadId } = req.params;

    await client.query('BEGIN');

    // Mark matched payments as reconciled
    const matchedItems = await client.query(
      `SELECT matched_payment_id FROM bank_reconciliation_items
       WHERE upload_id = $1 AND school_id = $2 AND match_status = 'matched' AND matched_payment_id IS NOT NULL`,
      [uploadId, schoolId]
    );

    for (const item of matchedItems.rows) {
      await client.query(
        `UPDATE fee_payments SET reconciled_at = now(), reconciled_by = $1
         WHERE id = $2 AND school_id = $3`,
        [req.user!.id, item.matched_payment_id, schoolId]
      );
    }

    await client.query(
      `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, affected_record_id, after_data)
       VALUES ($1,$2,$3,'CONFIRM_BANK_RECONCILIATION','reconciliation',$4,$5)`,
      [schoolId, req.user!.id, req.user!.role, uploadId,
       JSON.stringify({ matched_count: matchedItems.rows.length })]
    ).catch(() => {});

    await client.query('COMMIT');
    return res.json({ success: true, reconciled_payments: matchedItems.rows.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[reconciliation POST /bank/:id/confirm]', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── GET /online/pending — List pending online payment proofs ─────────────────
router.get('/online/pending', permissionGuard('VIEW_RECONCILIATION'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const result = await pool.query(
      `SELECT
         ROW_NUMBER() OVER (ORDER BY opp.submitted_at DESC) AS sl_no,
         opp.id, opp.transaction_id, opp.amount, opp.payment_mode,
         opp.status, opp.submitted_at, opp.notes,
         s.name AS student_name,
         c.name AS class_name,
         fh.name AS fee_head_name,
         sfa.outstanding_balance
       FROM online_payment_proofs opp
       JOIN students s ON s.id = opp.student_id
       LEFT JOIN classes c ON c.id = s.class_id
       JOIN fee_heads fh ON fh.id = opp.fee_head_id
       LEFT JOIN student_fee_accounts sfa
         ON sfa.student_id = opp.student_id
         AND sfa.fee_head_id = opp.fee_head_id
         AND sfa.school_id = opp.school_id
         AND sfa.deleted_at IS NULL
       WHERE opp.school_id = $1 AND opp.status = 'pending'
       ORDER BY opp.submitted_at DESC`,
      [schoolId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[reconciliation GET /online/pending]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /online/match — Match proofs against uploaded bank statement ─────────
// Accepts a list of bank statement rows (transaction_id + amount + date).
// For each proof, checks if a bank row with the SAME transaction_id AND SAME amount exists.
// Returns match results — does NOT confirm yet (admin reviews first).
router.post('/online/match', permissionGuard('PERFORM_RECONCILIATION'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { bank_rows } = req.body as {
      bank_rows: Array<{ transaction_id: string; amount: number; date: string }>;
    };

    if (!Array.isArray(bank_rows) || bank_rows.length === 0) {
      return res.status(400).json({ error: 'bank_rows array is required' });
    }

    // Fetch all pending proofs for this school
    const proofsResult = await pool.query(
      `SELECT
         opp.id, opp.transaction_id, opp.amount, opp.student_id, opp.fee_head_id,
         s.name AS student_name, fh.name AS fee_head_name
       FROM online_payment_proofs opp
       JOIN students s ON s.id = opp.student_id
       JOIN fee_heads fh ON fh.id = opp.fee_head_id
       WHERE opp.school_id = $1 AND opp.status = 'pending'`,
      [schoolId]
    );

    const results = proofsResult.rows.map((proof: any) => {
      // Match: transaction_id must match (case-insensitive) AND amount must match exactly
      const bankRow = bank_rows.find(
        r =>
          r.transaction_id.trim().toLowerCase() === proof.transaction_id.trim().toLowerCase() &&
          Math.abs(parseFloat(r.amount as any) - parseFloat(proof.amount)) < 0.01
      );

      return {
        proof_id: proof.id,
        transaction_id: proof.transaction_id,
        amount: parseFloat(proof.amount),
        student_name: proof.student_name,
        fee_head_name: proof.fee_head_name,
        matched: !!bankRow,
        bank_date: bankRow?.date || null,
      };
    });

    const matched = results.filter(r => r.matched).length;
    const unmatched = results.length - matched;

    return res.json({ results, matched, unmatched, total: results.length });
  } catch (err) {
    console.error('[reconciliation POST /online/match]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /online/confirm — Confirm matched proofs and release receipts ────────
// Accepts proof_ids with their bank_date. Creates fee_payments, marks proofs as matched,
// updates student_fee_accounts, and marks receipts as ready for release.
router.post('/online/confirm', permissionGuard('PERFORM_RECONCILIATION'), async (req, res) => {
  const client = await pool.connect();
  try {
    const schoolId = req.user!.school_id;
    const { confirmations } = req.body as {
      confirmations: Array<{ proof_id: string; bank_date: string }>;
    };

    if (!Array.isArray(confirmations) || confirmations.length === 0) {
      return res.status(400).json({ error: 'confirmations array is required' });
    }

    await client.query('BEGIN');

    const confirmed: any[] = [];

    for (const { proof_id, bank_date } of confirmations) {
      // Fetch the proof
      const proofResult = await client.query(
        `SELECT * FROM online_payment_proofs
         WHERE id = $1 AND school_id = $2 AND status = 'pending'`,
        [proof_id, schoolId]
      );
      if (proofResult.rows.length === 0) continue;
      const proof = proofResult.rows[0];

      // Fetch the fee account
      const acctResult = await client.query(
        `SELECT * FROM student_fee_accounts
         WHERE student_id = $1 AND fee_head_id = $2 AND school_id = $3 AND deleted_at IS NULL`,
        [proof.student_id, proof.fee_head_id, schoolId]
      );
      if (acctResult.rows.length === 0) continue;
      const acct = acctResult.rows[0];

      // Generate receipt number
      const receiptNumResult = await client.query(
        `SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(receipt_number, '[^0-9]', '', 'g'), '') AS INTEGER)), 0) + 1 AS next_num
         FROM fee_payments WHERE school_id = $1`,
        [schoolId]
      );
      const receiptNumber = String(receiptNumResult.rows[0].next_num).padStart(6, '0');

      // Create fee payment
      const paymentResult = await client.query(
        `INSERT INTO fee_payments
           (school_id, student_id, fee_head_id, amount, payment_mode, payment_date,
            reference_number, receipt_number, reconciled_at, reconciled_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now(),$9)
         RETURNING *`,
        [schoolId, proof.student_id, proof.fee_head_id, proof.amount,
         proof.payment_mode, bank_date, proof.transaction_id,
         receiptNumber, req.user!.id]
      );
      const payment = paymentResult.rows[0];

      // Update student fee account balance
      const newBalance = Math.max(0, parseFloat(acct.outstanding_balance) - parseFloat(proof.amount));
      const newStatus = newBalance === 0 ? 'paid' : 'partially_paid';
      await client.query(
        `UPDATE student_fee_accounts SET outstanding_balance = $1, status = $2, updated_at = now()
         WHERE id = $3`,
        [newBalance, newStatus, acct.id]
      );

      // Mark proof as matched
      await client.query(
        `UPDATE online_payment_proofs
         SET status = 'matched', matched_at = now(), matched_by = $1,
             bank_statement_date = $2, fee_payment_id = $3
         WHERE id = $4`,
        [req.user!.id, bank_date, payment.id, proof_id]
      );

      confirmed.push({
        proof_id,
        student_id: proof.student_id,
        fee_payment_id: payment.id,
        receipt_number: receiptNumber,
        amount: parseFloat(proof.amount),
        bank_date,
      });
    }

    await client.query(
      `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, after_data)
       VALUES ($1,$2,$3,'CONFIRM_ONLINE_RECONCILIATION','reconciliation',$4)`,
      [schoolId, req.user!.id, req.user!.role,
       JSON.stringify({ confirmed_count: confirmed.length })]
    ).catch(() => {});

    await client.query('COMMIT');
    return res.json({ success: true, confirmed_count: confirmed.length, confirmed });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[reconciliation POST /online/confirm]', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── POST /online/:proofId/reject — Reject a proof ────────────────────────────
router.post('/online/:proofId/reject', permissionGuard('PERFORM_RECONCILIATION'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { proofId } = req.params;
    const { reason } = req.body as { reason?: string };

    const result = await pool.query(
      `UPDATE online_payment_proofs
       SET status = 'rejected', rejection_reason = $1, matched_by = $2, matched_at = now()
       WHERE id = $3 AND school_id = $4 AND status = 'pending'
       RETURNING *`,
      [reason || null, req.user!.id, proofId, schoolId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Proof not found or already processed' });

    return res.json({ success: true });
  } catch (err) {
    console.error('[reconciliation POST /online/:id/reject]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /cash/pending — List unreconciled cash payments ──────────────────────
// Returns all cash fee_payments that have not yet been reconciled,
// grouped with student name, fee head, amount, date.
// Also returns the total unreconciled amount.
router.get('/cash/pending', permissionGuard('VIEW_RECONCILIATION'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { from, to } = req.query as { from?: string; to?: string };

    const params: any[] = [schoolId];
    let dateFilter = '';
    if (from) { params.push(from); dateFilter += ` AND fp.payment_date >= $${params.length}`; }
    if (to)   { params.push(to);   dateFilter += ` AND fp.payment_date <= $${params.length}`; }

    const result = await pool.query(
      `SELECT
         ROW_NUMBER() OVER (ORDER BY fp.payment_date DESC, fp.created_at DESC) AS sl_no,
         fp.id,
         fp.amount,
         fp.payment_date,
         fp.receipt_number,
         fp.reference_number,
         s.name AS student_name,
         c.name AS class_name,
         fh.name AS fee_head_name
       FROM fee_payments fp
       JOIN students s ON s.id = fp.student_id
       LEFT JOIN classes c ON c.id = s.class_id
       JOIN fee_heads fh ON fh.id = fp.fee_head_id
       WHERE fp.school_id = $1
         AND fp.payment_mode = 'cash'
         AND fp.reconciled_at IS NULL
         AND fp.deleted_at IS NULL
         ${dateFilter}
       ORDER BY fp.payment_date DESC, fp.created_at DESC`,
      params
    );

    const total = result.rows.reduce((sum: number, r: any) => sum + parseFloat(r.amount), 0);

    return res.json({ payments: result.rows, total_pending: total });
  } catch (err) {
    console.error('[reconciliation GET /cash/pending]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /cash/confirm — Principal confirms selected cash payments ─────────────
// Marks the selected payment IDs as reconciled and logs a cash_reconciliation_logs entry.
router.post('/cash/confirm', permissionGuard('PERFORM_RECONCILIATION'), async (req, res) => {
  const client = await pool.connect();
  try {
    const schoolId = req.user!.school_id;
    const { payment_ids, note } = req.body as { payment_ids: string[]; note?: string };

    if (!Array.isArray(payment_ids) || payment_ids.length === 0)
      return res.status(400).json({ error: 'payment_ids array is required' });

    await client.query('BEGIN');

    // Verify all payments belong to this school and are cash + unreconciled
    const verifyResult = await client.query(
      `SELECT id, amount FROM fee_payments
       WHERE id = ANY($1::uuid[])
         AND school_id = $2
         AND payment_mode = 'cash'
         AND reconciled_at IS NULL
         AND deleted_at IS NULL`,
      [payment_ids, schoolId]
    );

    if (verifyResult.rows.length !== payment_ids.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Some payments are invalid, already reconciled, or do not belong to this school.',
      });
    }

    const totalConfirmed = verifyResult.rows.reduce(
      (sum: number, r: any) => sum + parseFloat(r.amount), 0
    );

    // Mark all selected payments as reconciled
    await client.query(
      `UPDATE fee_payments
       SET reconciled_at = now(), reconciled_by = $1
       WHERE id = ANY($2::uuid[]) AND school_id = $3`,
      [req.user!.id, payment_ids, schoolId]
    );

    // Insert a cash reconciliation log entry
    const today = new Date().toISOString().split('T')[0];
    await client.query(
      `INSERT INTO cash_reconciliation_logs
         (school_id, logged_by, date, total_cash, expected_cash, status, reviewed_by, reviewed_at)
       VALUES ($1, $2, $3, $4, $4, 'matched', $2, now())
       ON CONFLICT (school_id, date) DO UPDATE
         SET total_cash = cash_reconciliation_logs.total_cash + $4,
             expected_cash = cash_reconciliation_logs.expected_cash + $4,
             status = 'matched',
             reviewed_by = $2,
             reviewed_at = now()`,
      [schoolId, req.user!.id, today, totalConfirmed]
    );

    await client.query(
      `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, after_data)
       VALUES ($1,$2,$3,'CONFIRM_CASH_RECONCILIATION','reconciliation',$4)`,
      [schoolId, req.user!.id, req.user!.role,
       JSON.stringify({ payment_count: payment_ids.length, total_confirmed: totalConfirmed, note })]
    ).catch(() => {});

    await client.query('COMMIT');
    return res.json({
      success: true,
      reconciled_count: payment_ids.length,
      total_confirmed: totalConfirmed,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[reconciliation POST /cash/confirm]', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── POST /cash — Log daily cash total ────────────────────────────────────────
router.post('/cash', permissionGuard('PERFORM_RECONCILIATION'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { date, total_cash } = req.body;
    if (!date || total_cash === undefined)
      return res.status(400).json({ error: 'date and total_cash are required' });

    // Compute expected cash from system records
    const expectedResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS expected
       FROM fee_payments
       WHERE school_id = $1 AND payment_mode = 'cash' AND payment_date = $2 AND deleted_at IS NULL`,
      [schoolId, date]
    );
    const expectedCash = parseFloat(expectedResult.rows[0].expected);

    const result = await pool.query(
      `INSERT INTO cash_reconciliation_logs (school_id, logged_by, date, total_cash, expected_cash, status)
       VALUES ($1,$2,$3,$4,$5,'pending')
       ON CONFLICT (school_id, date) DO UPDATE
         SET total_cash = $4, expected_cash = $5, logged_by = $2, status = 'pending'
       RETURNING *`,
      [schoolId, req.user!.id, date, total_cash, expectedCash]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[reconciliation POST /cash]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /cash — List cash reconciliation logs + serial numbers ────────────────
router.get('/cash', permissionGuard('VIEW_RECONCILIATION'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const result = await pool.query(
      `SELECT
         ROW_NUMBER() OVER (ORDER BY date DESC) AS sl_no,
         *
       FROM cash_reconciliation_logs
       WHERE school_id = $1
       ORDER BY date DESC`,
      [schoolId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[reconciliation GET /cash]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /cash/:id/review — Principal reviews cash log ───────────────────────
router.post('/cash/:id/review', permissionGuard('PERFORM_RECONCILIATION'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { id } = req.params;
    const { status } = req.body as { status: 'matched' | 'mismatch' };

    if (!['matched', 'mismatch'].includes(status))
      return res.status(400).json({ error: 'status must be matched or mismatch' });

    const result = await pool.query(
      `UPDATE cash_reconciliation_logs
       SET status = $1, reviewed_by = $2, reviewed_at = now()
       WHERE id = $3 AND school_id = $4
       RETURNING *`,
      [status, req.user!.id, id, schoolId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cash log not found' });

    if (status === 'mismatch') {
      await pool.query(
        `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, affected_record_id, after_data)
         VALUES ($1,$2,$3,'FLAG_CASH_MISMATCH','reconciliation',$4,$5)`,
        [schoolId, req.user!.id, req.user!.role, id,
         JSON.stringify({ variance: result.rows[0].variance })]
      ).catch(() => {});
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[reconciliation POST /cash/:id/review]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /admin-payments/match — Match pending admin-recorded payments against bank CSV rows
// Takes bank_rows: [{ reference: string, amount: number, date: string }]
// Groups pending payments by reference, matches by reference + total_amount in same bank row.
router.post('/admin-payments/match', permissionGuard('PERFORM_RECONCILIATION'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { bank_rows } = req.body as {
      bank_rows: Array<{ reference: string; amount: number; date: string }>;
    };
    if (!Array.isArray(bank_rows) || bank_rows.length === 0)
      return res.status(400).json({ error: 'bank_rows array is required' });

    // Fetch all pending payments grouped by reference
    const result = await pool.query(
      `SELECT fp.id, fp.reference_number, fp.amount, fp.payment_date
       FROM fee_payments fp
       WHERE fp.school_id = $1
         AND fp.needs_reconciliation = true
         AND fp.reconciled_at IS NULL
         AND fp.deleted_at IS NULL`,
      [schoolId]
    );

    // Group by reference
    const groups: Record<string, { ids: string[]; total: number }> = {};
    for (const row of result.rows) {
      const key = row.reference_number || `__no_ref_${row.id}`;
      if (!groups[key]) groups[key] = { ids: [], total: 0 };
      groups[key].ids.push(row.id);
      groups[key].total += parseFloat(row.amount);
    }

    // Match each group against bank rows
    const matches: Array<{
      reference_number: string | null;
      payment_ids: string[];
      total_amount: number;
      matched: boolean;
      bank_date: string | null;
    }> = [];

    for (const [key, group] of Object.entries(groups)) {
      const ref = key.startsWith('__no_ref_') ? null : key;
      const bankRow = ref
        ? bank_rows.find(r =>
            r.reference.trim().toLowerCase() === ref.trim().toLowerCase() &&
            Math.abs(r.amount - group.total) < 0.01
          )
        : null;

      matches.push({
        reference_number: ref,
        payment_ids: group.ids,
        total_amount: Math.round(group.total * 100) / 100,
        matched: !!bankRow,
        bank_date: bankRow?.date || null,
      });
    }

    return res.json({
      matches,
      matched_count: matches.filter(m => m.matched).length,
      unmatched_count: matches.filter(m => !m.matched).length,
    });
  } catch (err) {
    console.error('[reconciliation POST /admin-payments/match]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /admin-payments/confirm — Mark matched admin payments as reconciled + generate receipts
router.post('/admin-payments/confirm', permissionGuard('PERFORM_RECONCILIATION'), async (req, res) => {
  const client = await pool.connect();
  try {
    const schoolId = req.user!.school_id;
    const { confirmations } = req.body as {
      confirmations: Array<{ payment_ids: string[]; bank_date: string }>;
    };
    if (!Array.isArray(confirmations) || confirmations.length === 0)
      return res.status(400).json({ error: 'confirmations array is required' });

    // Fetch school branding once
    const schoolResult = await client.query(
      `SELECT s.name, s.contact->>'address' AS address, s.logo_path, hs.letterhead_url
       FROM schools s LEFT JOIN hr_settings hs ON hs.school_id = s.id
       WHERE s.id = $1`, [schoolId]
    );
    const school = schoolResult.rows[0] || { name: 'School', address: '', logo_path: null, letterhead_url: null };
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

    await client.query('BEGIN');
    let totalConfirmed = 0;

    for (const { payment_ids, bank_date } of confirmations) {
      // Mark reconciled
      await client.query(
        `UPDATE fee_payments
         SET reconciled_at = now(), reconciled_by = $1
         WHERE id = ANY($2::uuid[]) AND school_id = $3
           AND needs_reconciliation = true AND reconciled_at IS NULL AND deleted_at IS NULL`,
        [req.user!.id, payment_ids, schoolId]
      );
      totalConfirmed += payment_ids.length;

      // Generate one receipt per payment in this group
      for (const paymentId of payment_ids) {
        const pmtResult = await client.query(
          `SELECT fp.*, s.name AS student_name, c.name AS class_name,
                  fh.name AS fee_head_name, sc.subdomain AS school_code
           FROM fee_payments fp
           JOIN students s ON s.id = fp.student_id
           LEFT JOIN classes c ON c.id = s.class_id
           JOIN fee_heads fh ON fh.id = fp.fee_head_id
           JOIN schools sc ON sc.id = fp.school_id
           WHERE fp.id = $1`,
          [paymentId]
        );
        if (pmtResult.rows.length === 0) continue;
        const pmt = pmtResult.rows[0];

        try {
          const receiptData: ReceiptData = {
            receipt_number: pmt.receipt_number,
            student_name: pmt.student_name,
            class_name: pmt.class_name || '',
            fee_head_breakdown: [{ name: pmt.fee_head_name, amount: parseFloat(pmt.amount) }],
            amount_paid: parseFloat(pmt.amount),
            payment_mode: pmt.payment_mode,
            payment_date: new Date(bank_date),
            school_name: school.name,
            outstanding_after_payment: 0,
            reference_number: pmt.reference_number || undefined,
          };
          const pdfBuffer = await generateReceiptPDF(receiptData, branding, ctx);
          const receiptUrl = await uploadPdfBuffer(
            pdfBuffer,
            `receipts/${schoolId}/${pmt.receipt_number}.pdf`
          );
          await client.query(
            `UPDATE fee_payments SET receipt_url = $1, receipt_released_at = now() WHERE id = $2`,
            [receiptUrl, paymentId]
          );
        } catch (pdfErr) {
          console.error('[admin-payments/confirm] PDF generation failed for', paymentId, pdfErr);
          // Don't fail the whole reconciliation if PDF fails
        }
      }
    }

    await client.query('COMMIT');

    pool.query(
      `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, after_data)
       VALUES ($1,$2,$3,'RECONCILE_ADMIN_PAYMENTS','reconciliation',$4)`,
      [schoolId, req.user!.id, req.user!.role,
       JSON.stringify({ confirmed_payment_count: totalConfirmed })]
    ).catch(() => {});

    return res.json({ success: true, confirmed_payment_count: totalConfirmed });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[reconciliation POST /admin-payments/confirm]', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

export default router;
