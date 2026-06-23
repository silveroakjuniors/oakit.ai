import { Router } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, permissionGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify);

/**
 * Fee Reminders
 *
 * Lists students with outstanding fees and records reminder dispatches in the
 * audit log. Actual SMS/email delivery should be wired to a notification
 * provider by replacing the audit-log insert with a real dispatch call.
 */

// ── GET /pending — List students with outstanding fees (reminder candidates) ──
// Query params: class_id, min_outstanding (number)
router.get('/pending', permissionGuard('SEND_REMINDER'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { class_id, min_outstanding } = req.query as Record<string, string>;

    const params: any[] = [schoolId];
    let idx = 2;
    let whereFilters = '';
    let havingFilter = '';

    if (class_id) {
      whereFilters += ` AND s.class_id = $${idx++}`;
      params.push(class_id);
    }
    if (min_outstanding) {
      havingFilter = ` HAVING SUM(sfa.outstanding_balance) >= $${idx++}`;
      params.push(parseFloat(min_outstanding));
    }

    const result = await pool.query(
      `SELECT
         s.id AS student_id,
         s.name AS student_name,
         c.name AS class_name,
         SUM(sfa.outstanding_balance) AS total_outstanding,
         COUNT(sfa.id) AS fee_heads_pending
       FROM student_fee_accounts sfa
       JOIN students s ON s.id = sfa.student_id
       LEFT JOIN classes c ON c.id = s.class_id
       WHERE sfa.school_id = $1
         AND sfa.deleted_at IS NULL
         AND sfa.outstanding_balance > 0
         AND sfa.status != 'paid'${whereFilters}
       GROUP BY s.id, s.name, c.name${havingFilter}
       ORDER BY total_outstanding DESC`,
      params
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[reminders GET /pending]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /send — Record reminder dispatch for students with outstanding fees ──
// Body: { student_ids?: string[], class_id?: string, min_outstanding?: number }
// Scope priority: student_ids > class_id > all students in school.
router.post('/send', permissionGuard('SEND_REMINDER'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { student_ids, class_id, min_outstanding = 0 } = req.body as {
      student_ids?: string[];
      class_id?: string;
      min_outstanding?: number;
    };

    const params: any[] = [schoolId, parseFloat(String(min_outstanding))];
    let idx = 3;
    let whereFilters = '';

    if (student_ids && student_ids.length > 0) {
      whereFilters += ` AND s.id = ANY($${idx++})`;
      params.push(student_ids);
    } else if (class_id) {
      whereFilters += ` AND s.class_id = $${idx++}`;
      params.push(class_id);
    }

    const result = await pool.query(
      `SELECT
         s.id AS student_id,
         s.name AS student_name,
         c.name AS class_name,
         SUM(sfa.outstanding_balance) AS total_outstanding
       FROM student_fee_accounts sfa
       JOIN students s ON s.id = sfa.student_id
       LEFT JOIN classes c ON c.id = s.class_id
       WHERE sfa.school_id = $1
         AND sfa.deleted_at IS NULL
         AND sfa.outstanding_balance > 0
         AND sfa.status != 'paid'${whereFilters}
       GROUP BY s.id, s.name, c.name
       HAVING SUM(sfa.outstanding_balance) >= $2
       ORDER BY total_outstanding DESC`,
      params
    );

    const students = result.rows;

    if (students.length === 0) {
      return res.json({
        success: true,
        reminders_sent: 0,
        message: 'No students with outstanding fees found matching the criteria',
      });
    }

    const reminderBatch = students.map((s: any) => ({
      student_id: s.student_id,
      student_name: s.student_name,
      class_name: s.class_name,
      total_outstanding: parseFloat(s.total_outstanding),
    }));

    // Record in audit log — replace this with real SMS/email dispatch
    await pool.query(
      `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, after_data)
       VALUES ($1,$2,$3,'SEND_FEE_REMINDER','fees',$4)`,
      [schoolId, req.user!.id, req.user!.role,
       JSON.stringify({ reminders_sent: students.length, students: reminderBatch })]
    ).catch(() => {});

    return res.json({
      success: true,
      reminders_sent: students.length,
      students: reminderBatch,
    });
  } catch (err) {
    console.error('[reminders POST /send]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
