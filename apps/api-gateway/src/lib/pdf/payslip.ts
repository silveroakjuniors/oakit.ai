/**
 * pdf/payslip.ts — Staff salary payslip PDF generator
 */

import PDFDocument from 'pdfkit';
import {
  BrandingContext,
  GeneratorContext,
  MARGIN,
  CONTENT_WIDTH,
  collectBuffer,
  addBrandedHeader,
  registerFooter,
  addKeyValue,
  addTable,
} from './base';

export interface PayslipData {
  staff_name: string;
  role: string;
  employee_id: string;
  month_year: string;
  working_days: number;
  present_days: number;
  absent_days: number;
  leave_days: number;
  gross_salary: number;
  per_day_rate: number;
  components: { name: string; amount: number }[];
  deductions: { name: string; amount: number }[];
  net_salary: number;
  payment_mode: string;
  payment_date: Date;
}

export async function generatePayslipPDF(
  data: PayslipData,
  branding: BrandingContext,
  ctx: GeneratorContext,
): Promise<Buffer> {
  const doc = new PDFDocument({ margin: MARGIN, size: 'A4', bufferPages: true });
  const bufferPromise = collectBuffer(doc);

  registerFooter(doc, ctx);
  addBrandedHeader(doc, branding, 'Salary Payslip');

  doc.moveDown(0.5);

  doc.font('Helvetica-Bold').fontSize(11).text('Staff Details', MARGIN, doc.y);
  doc.moveDown(0.3);
  addTable(
    doc,
    ['Name', 'Role', 'Employee ID', 'Month / Year'],
    [[data.staff_name, data.role, data.employee_id, data.month_year]],
    [CONTENT_WIDTH * 0.3, CONTENT_WIDTH * 0.2, CONTENT_WIDTH * 0.2, CONTENT_WIDTH * 0.3],
  );

  doc.moveDown(0.5);

  doc.font('Helvetica-Bold').fontSize(11).text('Attendance Summary', MARGIN, doc.y);
  doc.moveDown(0.3);
  addTable(
    doc,
    ['Working Days', 'Present', 'Absent', 'Leaves'],
    [[String(data.working_days), String(data.present_days), String(data.absent_days), String(data.leave_days)]],
    [CONTENT_WIDTH * 0.25, CONTENT_WIDTH * 0.25, CONTENT_WIDTH * 0.25, CONTENT_WIDTH * 0.25],
  );

  doc.moveDown(0.5);

  doc.font('Helvetica-Bold').fontSize(11).text('Earnings', MARGIN, doc.y);
  doc.moveDown(0.3);
  const earningsRows = data.components.map((c) => [c.name, `₹ ${c.amount.toFixed(2)}`]);
  earningsRows.push(['Gross Total', `₹ ${data.gross_salary.toFixed(2)}`]);
  addTable(doc, ['Component', 'Amount'], earningsRows, [CONTENT_WIDTH * 0.7, CONTENT_WIDTH * 0.3]);

  doc.moveDown(0.5);

  doc.font('Helvetica-Bold').fontSize(11).text('Deductions', MARGIN, doc.y);
  doc.moveDown(0.3);
  const totalDeductions = data.deductions.reduce((sum, d) => sum + d.amount, 0);
  const deductionRows = data.deductions.map((d) => [d.name, `₹ ${d.amount.toFixed(2)}`]);
  deductionRows.push(['Total Deductions', `₹ ${totalDeductions.toFixed(2)}`]);
  addTable(doc, ['Deduction', 'Amount'], deductionRows, [CONTENT_WIDTH * 0.7, CONTENT_WIDTH * 0.3]);

  doc.moveDown(0.5);

  // Net salary — highlighted box
  const netY = doc.y;
  doc.rect(MARGIN, netY, CONTENT_WIDTH, 28).fill('#e8f5e9');
  doc.fillColor('#000000');
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .text(`Net Salary: ₹ ${data.net_salary.toFixed(2)}`, MARGIN + 8, netY + 7, {
      width: CONTENT_WIDTH - 16,
      align: 'right',
    });

  doc.y = netY + 36;
  doc.moveDown(0.5);

  doc.font('Helvetica-Bold').fontSize(11).text('Payment Details', MARGIN, doc.y);
  doc.moveDown(0.3);
  addKeyValue(doc, 'Payment Mode', data.payment_mode);
  doc.moveDown(0.3);
  addKeyValue(
    doc,
    'Payment Date',
    data.payment_date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
  );

  doc.moveDown(1);

  doc
    .font('Helvetica-Oblique')
    .fontSize(9)
    .fillColor('#555555')
    .text('This is a system-generated salary slip.', MARGIN, doc.y, {
      align: 'center',
      width: CONTENT_WIDTH,
    });

  doc.fillColor('#000000');
  doc.end();
  return bufferPromise;
}
