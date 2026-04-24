import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { pool } from '../../lib/db';
import { jwtVerify, permissionGuard } from '../../middleware/auth';

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
      `SELECT * FROM bank_reconciliation_items WHERE upload_id = $1 AND school_id = $2
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

// ── GET /cash — List cash reconciliation logs ─────────────────────────────────
router.get('/cash', permissionGuard('VIEW_RECONCILIATION'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const result = await pool.query(
      `SELECT * FROM cash_reconciliation_logs WHERE school_id = $1 ORDER BY date DESC`,
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

export default router;
