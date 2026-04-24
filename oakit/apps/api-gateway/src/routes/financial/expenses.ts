import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { pool } from '../../lib/db';
import { jwtVerify, permissionGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify);

const upload = multer({ dest: './uploads/expense-tmp/' });
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'oakit-uploads';
const LARGE_EXPENSE_THRESHOLD = parseFloat(process.env.LARGE_EXPENSE_THRESHOLD || '10000');

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key || key === 'your_service_role_key_here') return null;
  return createClient(url, key);
}

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf'];

// ── POST / — Create expense ───────────────────────────────────────────────────
router.post('/', permissionGuard('ADD_EXPENSE'), upload.single('attachment'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { date, amount, category, notes } = req.body;

    if (!date || !amount || !category)
      return res.status(400).json({ error: 'date, amount, category are required' });
    if (parseFloat(amount) <= 0)
      return res.status(400).json({ error: 'amount must be > 0' });

    const validCategories = ['rent', 'salary', 'utilities', 'marketing', 'maintenance', 'miscellaneous'];
    if (!validCategories.includes(category))
      return res.status(400).json({ error: `category must be one of: ${validCategories.join(', ')}` });

    let attachmentUrl: string | null = null;

    if (req.file) {
      if (!ALLOWED_MIME.includes(req.file.mimetype)) {
        return res.status(400).json({ error: 'Attachment must be JPEG, PNG, or PDF' });
      }
      const supabase = getSupabase();
      const ext = path.extname(req.file.originalname);
      const storagePath = `${schoolId}/expenses/${Date.now()}${ext}`;
      if (supabase) {
        const fs = await import('fs');
        const buffer = fs.readFileSync(req.file.path);
        const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
          contentType: req.file.mimetype, upsert: false,
        });
        if (!error) {
          const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
          attachmentUrl = data.publicUrl;
        }
        fs.unlinkSync(req.file.path);
      }
    }

    const result = await pool.query(
      `INSERT INTO expenses (school_id, date, amount, category, notes, attachment_url, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [schoolId, date, amount, category, notes || null, attachmentUrl, req.user!.id]
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, affected_record_id, after_data)
       VALUES ($1,$2,$3,'CREATE_EXPENSE','expense',$4,$5)`,
      [schoolId, req.user!.id, req.user!.role, result.rows[0].id,
       JSON.stringify({ date, amount, category })]
    ).catch(() => {});

    // Large-expense alert (in-app notification to Principal — best-effort)
    if (parseFloat(amount) > LARGE_EXPENSE_THRESHOLD) {
      await pool.query(
        `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, affected_record_id, after_data)
         VALUES ($1,$2,$3,'LARGE_EXPENSE_ALERT','expense',$4,$5)`,
        [schoolId, req.user!.id, req.user!.role, result.rows[0].id,
         JSON.stringify({ amount, threshold: LARGE_EXPENSE_THRESHOLD })]
      ).catch(() => {});
    }

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[expenses POST]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET / — List expenses with filters ───────────────────────────────────────
router.get('/', permissionGuard('VIEW_EXPENSE'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { from, to, category } = req.query as Record<string, string>;

    let query = `SELECT * FROM expenses WHERE school_id = $1 AND deleted_at IS NULL`;
    const params: any[] = [schoolId];
    let idx = 2;

    if (from) { query += ` AND date >= $${idx++}`; params.push(from); }
    if (to)   { query += ` AND date <= $${idx++}`; params.push(to); }
    if (category) { query += ` AND category = $${idx++}`; params.push(category); }

    query += ` ORDER BY date DESC`;

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[expenses GET]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /:id — Edit expense (Principal only; Finance_Manager blocked) ─────────
router.put('/:id', permissionGuard('ADD_EXPENSE'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { id } = req.params;

    // Finance_Manager cannot edit expenses regardless of permissions
    if (req.user!.role === 'finance_manager')
      return res.status(403).json({ error: 'Finance managers cannot edit expense records' });

    const existing = await pool.query(
      `SELECT * FROM expenses WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
      [id, schoolId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Expense not found' });

    const { date, amount, category, notes } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (date !== undefined)     { updates.push(`date = $${idx++}`);     values.push(date); }
    if (amount !== undefined)   { updates.push(`amount = $${idx++}`);   values.push(amount); }
    if (category !== undefined) { updates.push(`category = $${idx++}`); values.push(category); }
    if (notes !== undefined)    { updates.push(`notes = $${idx++}`);    values.push(notes); }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(id, schoolId);
    const result = await pool.query(
      `UPDATE expenses SET ${updates.join(', ')} WHERE id = $${idx++} AND school_id = $${idx} RETURNING *`,
      values
    );

    await pool.query(
      `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, affected_record_id, before_data, after_data)
       VALUES ($1,$2,$3,'EDIT_EXPENSE','expense',$4,$5,$6)`,
      [schoolId, req.user!.id, req.user!.role, id,
       JSON.stringify(existing.rows[0]), JSON.stringify(result.rows[0])]
    ).catch(() => {});

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[expenses PUT /:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /:id — Soft-delete expense (Principal only) ───────────────────────
router.delete('/:id', permissionGuard('ADD_EXPENSE'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { id } = req.params;

    if (req.user!.role === 'finance_manager')
      return res.status(403).json({ error: 'Finance managers cannot delete expense records' });

    const result = await pool.query(
      `UPDATE expenses SET deleted_at = now(), deleted_by = $1
       WHERE id = $2 AND school_id = $3 AND deleted_at IS NULL RETURNING *`,
      [req.user!.id, id, schoolId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Expense not found' });

    await pool.query(
      `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, affected_record_id, before_data)
       VALUES ($1,$2,$3,'DELETE_EXPENSE','expense',$4,$5)`,
      [schoolId, req.user!.id, req.user!.role, id, JSON.stringify(result.rows[0])]
    ).catch(() => {});

    return res.json({ success: true, id });
  } catch (err) {
    console.error('[expenses DELETE /:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
