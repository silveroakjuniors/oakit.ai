import { Router } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, permissionGuard } from '../../middleware/auth';
import { sendPushToStudentParents } from '../../lib/pushNotification';
import { sendTextMessage, normalisePhone } from '../../lib/whatsappSender';

const router = Router();
router.use(jwtVerify);

/**
 * Fee Reminders
 *
 * Sends in-app push notifications to parents and optionally WhatsApp messages.
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

// ── POST /send — Send fee reminder via push notification + WhatsApp ──────────
// Body: { student_ids?: string[], class_id?: string, min_outstanding?: number, send_whatsapp?: boolean }
router.post('/send', permissionGuard('SEND_REMINDER'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { student_ids, class_id, min_outstanding = 0, send_whatsapp = true } = req.body as {
      student_ids?: string[];
      class_id?: string;
      min_outstanding?: number;
      send_whatsapp?: boolean;
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

    // Fetch students with outstanding balances + their parent details
    const result = await pool.query(
      `SELECT
         s.id AS student_id,
         s.name AS student_name,
         c.name AS class_name,
         SUM(sfa.outstanding_balance) AS total_outstanding,
         -- Parent info for WhatsApp
         pu.id AS parent_id,
         pu.name AS parent_name,
         pu.mobile AS parent_mobile,
         pu.whatsapp_phone,
         pu.whatsapp_opt_in
       FROM student_fee_accounts sfa
       JOIN students s ON s.id = sfa.student_id AND s.is_active = true
       LEFT JOIN classes c ON c.id = s.class_id
       LEFT JOIN parent_student_links psl ON psl.student_id = s.id
       LEFT JOIN parent_users pu ON pu.id = psl.parent_id AND pu.is_active = true
       WHERE sfa.school_id = $1
         AND sfa.deleted_at IS NULL
         AND sfa.outstanding_balance > 0
         AND sfa.status != 'paid'${whereFilters}
       GROUP BY s.id, s.name, c.name, pu.id, pu.name, pu.mobile, pu.whatsapp_phone, pu.whatsapp_opt_in
       HAVING SUM(sfa.outstanding_balance) >= $2
       ORDER BY total_outstanding DESC`,
      params
    );

    const students = result.rows;

    if (students.length === 0) {
      return res.json({ success: true, reminders_sent: 0, whatsapp_sent: 0, message: 'No students found with outstanding fees' });
    }

    // Get school name for messages
    const schoolRow = await pool.query(`SELECT name FROM schools WHERE id = $1`, [schoolId]);
    const schoolName = schoolRow.rows[0]?.name || 'Your School';

    let pushSent = 0;
    let whatsappSent = 0;
    let whatsappFailed = 0;

    for (const student of students) {
      const outstanding = parseFloat(student.total_outstanding);
      const formattedAmt = `\u20B9${outstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

      // 1. Push notification to parent's device
      try {
        const pushResult = await sendPushToStudentParents(student.student_id, {
          title: `Fee Reminder — ${student.student_name}`,
          body: `Outstanding fee balance: ${formattedAmt} for ${student.student_name} (${student.class_name}). Please pay at the earliest.`,
          url: '/parent/fees',
          icon: '/school-logo.png',
        });
        pushSent += pushResult.sent;
      } catch { /* push best-effort */ }

      // 2. WhatsApp message to parent if opted in
      if (send_whatsapp && student.whatsapp_opt_in && student.parent_id) {
        const phone = normalisePhone(student.whatsapp_phone || student.parent_mobile || '');
        if (phone) {
          const msg = `Dear ${student.parent_name || 'Parent'},\n\nThis is a gentle reminder from ${schoolName}.\n\nYour child *${student.student_name}* (${student.class_name}) has an outstanding fee balance of *${formattedAmt}*.\n\nKindly visit the school or login to Oakit to clear the dues at the earliest.\n\nThank you,\n${schoolName}`;
          try {
            const waResult = await sendTextMessage(schoolId, phone, msg);
            if (waResult.success) whatsappSent++; else whatsappFailed++;
          } catch { whatsappFailed++; }
        }
      }
    }

    // Audit log
    pool.query(
      `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, after_data)
       VALUES ($1,$2,$3,'SEND_FEE_REMINDER','fees',$4)`,
      [schoolId, req.user!.id, req.user!.role,
       JSON.stringify({ reminders_sent: students.length, push_sent: pushSent, whatsapp_sent: whatsappSent })]
    ).catch(() => {});

    return res.json({
      success: true,
      reminders_sent: students.length,
      push_sent:      pushSent,
      whatsapp_sent:  whatsappSent,
      whatsapp_failed: whatsappFailed,
      message: `Reminders sent to ${students.length} student${students.length !== 1 ? 's' : ''}. Push: ${pushSent}, WhatsApp: ${whatsappSent}.`,
    });
  } catch (err) {
    console.error('[reminders POST /send]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
