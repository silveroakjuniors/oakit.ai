import { Router, Request, Response } from 'express';
import axios from 'axios';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('teacher'));

const AI = () => process.env.AI_SERVICE_URL || 'http://localhost:8000';

// GET /api/v1/teacher/export/pdf?date=YYYY-MM-DD
// Always exports single day only
router.get('/pdf', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

    // Get teacher's section — check both class_teacher_id and teacher_sections
    const sectionRow = await pool.query(
      `SELECT s.id as section_id, s.label as section_label, u.name as teacher_name
       FROM sections s
       JOIN users u ON u.id = $1
       WHERE s.school_id = $2
         AND (s.class_teacher_id = $1 OR EXISTS (
           SELECT 1 FROM teacher_sections ts WHERE ts.section_id = s.id AND ts.teacher_id = $1
         ))
       LIMIT 1`,
      [user_id, school_id]
    );
    if (sectionRow.rows.length === 0) {
      return res.status(404).json({ error: 'No section assigned' });
    }
    const { section_id, section_label, teacher_name } = sectionRow.rows[0];

    // Check if it's a settling day — if so, pass the AI plan text for PDF
    const settlingText = req.query.settling_text as string | undefined;

    let pdfBuffer: Buffer;
    try {
      const aiResp = await axios.post(
        `${AI()}/internal/export-pdf`,
        { teacher_id: user_id, section_id, section_label, teacher_name, date, days: 1, settling_text: settlingText || null },
        { responseType: 'arraybuffer', timeout: 15000 }
      );
      pdfBuffer = Buffer.from(aiResp.data);
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        return res.status(404).json({ error: 'No day plan found for the requested date' });
      }
      throw err;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="day-plan-${date}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
