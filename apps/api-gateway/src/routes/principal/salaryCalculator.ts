import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard } from '../../middleware/auth';
import PDFDocument from 'pdfkit';

const router = Router();
router.use(jwtVerify, schoolScope, roleGuard('principal', 'admin'));

// GET /api/v1/principal/salary-calculator/staff — All staff with optional salary
router.get('/staff', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT u.id AS user_id, u.name AS staff_name, r.name AS role,
              ssc.gross_salary
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN LATERAL (
         SELECT gross_salary FROM staff_salary_config
         WHERE school_id = $1 AND user_id = u.id
         ORDER BY effective_from DESC LIMIT 1
       ) ssc ON true
       WHERE u.school_id = $1 AND u.is_active = true
         AND r.name NOT IN ('parent', 'student', 'super_admin', 'franchise_admin')
       ORDER BY u.name`,
      [school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[salary-calculator] GET /staff', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/principal/salary-calculator/save-configs — Save salary configs
router.post('/save-configs', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { configs } = req.body;
    if (!Array.isArray(configs) || configs.length === 0) {
      return res.status(400).json({ error: 'No configs to save' });
    }

    let saved = 0;
    for (const cfg of configs) {
      if (!cfg.user_id || !cfg.gross_salary) continue;
      await pool.query(
        `INSERT INTO staff_salary_config (school_id, user_id, gross_salary, components, effective_from)
         VALUES ($1, $2, $3, '[]'::jsonb, CURRENT_DATE)
         ON CONFLICT (school_id, user_id, effective_from) DO UPDATE SET gross_salary = $3`,
        [school_id, cfg.user_id, cfg.gross_salary]
      );
      saved++;
    }
    return res.json({ saved });
  } catch (err) {
    console.error('[salary-calculator] POST /save-configs', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/principal/salary-calculator/mark-paid — Record salary as expense
router.post('/mark-paid', async (req: Request, res: Response) => {
  try {
    const { school_id, user_id } = req.user!;
    const { month, year, working_days, rows } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No rows to process' });
    }

    const totalPayout = rows.reduce((s: number, r: any) => s + (Number(r.net_salary) || 0), 0);
    const monthName = ['January','February','March','April','May','June','July','August','September','October','November','December'][month - 1] || '';

    // Create a single expense entry for the total salary payout
    await pool.query(
      `INSERT INTO expenses (school_id, created_by, date, amount, category, notes)
       VALUES ($1, $2, CURRENT_DATE, $3, 'salary', $4)`,
      [school_id, user_id, totalPayout,
       `Salary payout — ${monthName} ${year} | ${rows.length} staff | Working days: ${working_days}`]
    );

    // Also create individual salary records for system users (non-manual)
    for (const row of rows) {
      if (!row.user_id) continue; // skip manual entries
      const perDayRate = working_days > 0 ? Number(row.gross_salary) / working_days : 0;
      const deductionAmount = (Number(row.deduction_days) || 0) * perDayRate;
      await pool.query(
        `INSERT INTO salary_records
           (school_id, user_id, year, month, gross_salary, present_days, absent_days,
            leave_days, working_days, per_day_rate, deduction_amount, net_salary,
            deduction_choice, status, payment_mode, payment_date, payslip_status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10, $11, 'deduct', 'paid', 'cash', CURRENT_DATE, 'draft', $12)
         ON CONFLICT (school_id, user_id, year, month) DO UPDATE SET
           gross_salary = $5, present_days = $6, absent_days = $7,
           working_days = $8, per_day_rate = $9, deduction_amount = $10,
           net_salary = $11, status = 'paid', payment_date = CURRENT_DATE`,
        [school_id, row.user_id, year, month, row.gross_salary,
         working_days - (Number(row.deduction_days) || 0),
         Number(row.deduction_days) || 0,
         working_days, perDayRate, deductionAmount, row.net_salary, user_id]
      );
    }

    return res.json({ success: true, total_payout: totalPayout, staff_count: rows.length });
  } catch (err) {
    console.error('[salary-calculator] POST /mark-paid', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/principal/salary-calculator/export-pdf
router.post('/export-pdf', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { working_days, month, year, rows } = req.body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No rows to export' });
    }

    const schoolResult = await pool.query('SELECT name FROM schools WHERE id = $1', [school_id]);
    const schoolName = schoolResult.rows[0]?.name || 'School';

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const pdfReady = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    // Header
    doc.font('Helvetica-Bold').fontSize(14).text(schoolName, { align: 'center' });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10).text(`Salary Statement — ${month || ''} ${year || ''}`, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#666666')
      .text(`Working Days: ${working_days} | Generated: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(1);

    // Table header
    const colX = [40, 200, 290, 350, 420, 490];
    const colW = [160, 90, 60, 70, 70, 60];
    const headers = ['Staff Name', 'Gross Salary', 'Deduct', 'Per Day', 'Net Salary', 'Role'];

    doc.font('Helvetica-Bold').fontSize(8);
    const headerY = doc.y;
    doc.rect(40, headerY - 2, 520, 16).fill('#f3f4f6');
    doc.fillColor('#000000');
    headers.forEach((h, i) => {
      doc.text(h, colX[i], headerY + 2, { width: colW[i], align: i >= 1 && i <= 4 ? 'right' : 'left' });
    });
    doc.y = headerY + 18;

    // Table rows
    doc.font('Helvetica').fontSize(8);
    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    rows.forEach((row: any, idx: number) => {
      if (doc.y > 750) doc.addPage();
      const rowY = doc.y;
      const gross = Number(row.gross_salary) || 0;
      const deductDays = Number(row.deduction_days) || 0;
      const perDay = working_days > 0 ? gross / working_days : 0;
      const deduction = deductDays * perDay;
      const net = Math.max(0, gross - deduction);

      totalGross += gross;
      totalDeductions += deduction;
      totalNet += net;

      if (idx % 2 === 0) {
        doc.rect(40, rowY - 1, 520, 14).fill('#fafafa');
        doc.fillColor('#000000');
      }

      doc.text(`${idx + 1}. ${row.name}`, colX[0], rowY + 1, { width: colW[0] });
      doc.text(gross.toLocaleString('en-IN'), colX[1], rowY + 1, { width: colW[1], align: 'right' });
      doc.text(`${deductDays}d`, colX[2], rowY + 1, { width: colW[2], align: 'right' });
      doc.text(Math.round(perDay).toLocaleString('en-IN'), colX[3], rowY + 1, { width: colW[3], align: 'right' });
      doc.text(Math.round(net).toLocaleString('en-IN'), colX[4], rowY + 1, { width: colW[4], align: 'right' });
      doc.text(row.role || '', colX[5], rowY + 1, { width: colW[5], align: 'left' });

      doc.y = rowY + 16;
    });

    // Totals
    doc.moveDown(0.5);
    const totY = doc.y;
    doc.rect(40, totY - 2, 520, 18).fill('#e8f5e9');
    doc.fillColor('#000000');
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('TOTAL', colX[0], totY + 2, { width: colW[0] });
    doc.text(totalGross.toLocaleString('en-IN'), colX[1], totY + 2, { width: colW[1], align: 'right' });
    doc.text(Math.round(totalDeductions).toLocaleString('en-IN'), colX[2] - 10, totY + 2, { width: colW[2] + colW[3] + 10, align: 'right' });
    doc.text(Math.round(totalNet).toLocaleString('en-IN'), colX[4], totY + 2, { width: colW[4], align: 'right' });

    doc.y = totY + 28;
    doc.moveDown(1);
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#888888')
      .text('This is a system-generated salary statement.', { align: 'center' });

    doc.end();
    const pdfBuffer = await pdfReady;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=salary-${month}-${year}.pdf`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('[salary-calculator] export-pdf', err);
    return res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

export default router;
