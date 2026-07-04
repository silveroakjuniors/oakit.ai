import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard } from '../../middleware/auth';
import PDFDocument from 'pdfkit';

const router = Router();
router.use(jwtVerify, schoolScope, roleGuard('principal', 'admin'));

// POST /api/v1/principal/salary-calculator/export-pdf
router.post('/export-pdf', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { working_days, rows } = req.body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No rows to export' });
    }

    // Get school name
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
    doc.font('Helvetica').fontSize(10).text('Monthly Salary Calculator', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#666666')
      .text(`Generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} | Working Days: ${working_days}`, { align: 'center' });
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
      const y = doc.y;
      if (y > 750) {
        doc.addPage();
      }
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
    doc.text(Math.round(totalDeductions).toLocaleString('en-IN') + ' ded', colX[2] - 10, totY + 2, { width: colW[2] + colW[3] + 10, align: 'right' });
    doc.text(Math.round(totalNet).toLocaleString('en-IN'), colX[4], totY + 2, { width: colW[4], align: 'right' });

    doc.y = totY + 28;
    doc.moveDown(1);
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#888888')
      .text('This is a calculator estimate. Actual salary processing should be done from Finance > Salary.', { align: 'center' });

    doc.end();

    const pdfBuffer = await pdfReady;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=salary-calculator.pdf');
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('[salary-calculator] export-pdf', err);
    return res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

export default router;
