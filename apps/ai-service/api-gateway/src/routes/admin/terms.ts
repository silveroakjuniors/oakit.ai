/**
 * School term date management
 * GET  /api/v1/admin/terms          — list terms for current academic year
 * POST /api/v1/admin/terms          — upsert all terms at once
 * GET  /api/v1/admin/terms/current  — get the current active term (time-machine aware)
 */
import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard } from '../../middleware/auth';
import { getToday } from '../../lib/today';

const router = Router();
router.use(jwtVerify, schoolScope);

// GET /api/v1/admin/terms — list all terms for the school's current academic year
router.get('/', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const today = await getToday(school_id);

    // Get current academic year
    const calRow = await pool.query(
      `SELECT academic_year FROM school_calendar
       WHERE school_id = $1 AND $2::date BETWEEN start_date AND end_date
       ORDER BY start_date DESC LIMIT 1`,
      [school_id, today]
    );
    const academicYear = calRow.rows[0]?.academic_year;
    if (!academicYear) return res.json([]);

    const result = await pool.query(
      `SELECT id, term_name, start_date::text, end_date::text, academic_year
       FROM school_terms WHERE school_id = $1 AND academic_year = $2
       ORDER BY start_date`,
      [school_id, academicYear]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[terms GET]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/terms/current — returns the active term for today (time-machine aware)
router.get('/current', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const today = await getToday(school_id);

    const result = await pool.query(
      `SELECT id, term_name, start_date::text, end_date::text, academic_year
       FROM school_terms
       WHERE school_id = $1 AND $2::date BETWEEN start_date AND end_date
       ORDER BY start_date LIMIT 1`,
      [school_id, today]
    );

    if (result.rows.length === 0) {
      // No term configured for today — return null with today for context
      return res.json({ current_term: null, today });
    }

    return res.json({ current_term: result.rows[0], today });
  } catch (err) {
    console.error('[terms GET /current]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/terms — upsert all terms (admin only)
// Body: { terms: [{ term_name, start_date, end_date }] }
router.post('/', roleGuard('admin', 'principal'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { terms } = req.body as {
      terms: { term_name: string; start_date: string; end_date: string }[];
    };

    if (!Array.isArray(terms) || terms.length === 0) {
      return res.status(400).json({ error: 'terms array is required' });
    }

    // Validate term names
    const valid = ['Term 1', 'Term 2', 'Term 3', 'Annual'];
    for (const t of terms) {
      if (!valid.includes(t.term_name)) return res.status(400).json({ error: `Invalid term_name: ${t.term_name}` });
      if (!t.start_date || !t.end_date) return res.status(400).json({ error: 'start_date and end_date required for each term' });
      if (t.start_date > t.end_date) return res.status(400).json({ error: `${t.term_name}: start_date must be before end_date` });
    }

    // Get academic year from the first term's date range
    const calRow = await pool.query(
      `SELECT academic_year FROM school_calendar
       WHERE school_id = $1 AND $2::date BETWEEN start_date AND end_date
       ORDER BY start_date DESC LIMIT 1`,
      [school_id, terms[0].start_date]
    );
    // Fallback: most recent calendar
    const calFallback = calRow.rows.length === 0 ? await pool.query(
      `SELECT academic_year FROM school_calendar WHERE school_id = $1 ORDER BY start_date DESC LIMIT 1`,
      [school_id]
    ) : null;
    const academicYear = calRow.rows[0]?.academic_year ?? calFallback?.rows[0]?.academic_year;
    if (!academicYear) return res.status(400).json({ error: 'No school calendar found. Set up the academic year first.' });

    // Upsert all terms
    const saved = [];
    for (const t of terms) {
      const result = await pool.query(
        `INSERT INTO school_terms (school_id, academic_year, term_name, start_date, end_date)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (school_id, academic_year, term_name)
         DO UPDATE SET start_date = $4, end_date = $5, updated_at = now()
         RETURNING id, term_name, start_date::text, end_date::text, academic_year`,
        [school_id, academicYear, t.term_name, t.start_date, t.end_date]
      );
      saved.push(result.rows[0]);
    }

    return res.json(saved);
  } catch (err) {
    console.error('[terms POST]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
