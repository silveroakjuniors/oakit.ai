/**
 * pdf/report.ts — Generic financial / tabular report PDF generator
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

export interface ReportData {
  title: string;
  date_range: string;
  headers: string[];
  rows: string[][];
  summary: Record<string, string>;
}

export async function generateReportPDF(
  data: ReportData,
  branding: BrandingContext,
  ctx: GeneratorContext,
): Promise<Buffer> {
  const doc = new PDFDocument({ margin: MARGIN, size: 'A4', bufferPages: true });
  const bufferPromise = collectBuffer(doc);

  registerFooter(doc, ctx);
  addBrandedHeader(doc, branding, data.title);

  doc.moveDown(0.3);

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#444444')
    .text(`Period: ${data.date_range}`, MARGIN, doc.y, { align: 'center', width: CONTENT_WIDTH });
  doc.fillColor('#000000');

  doc.moveDown(0.8);

  addTable(doc, data.headers, data.rows);

  doc.moveDown(0.8);

  if (Object.keys(data.summary).length > 0) {
    doc.font('Helvetica-Bold').fontSize(11).text('Summary', MARGIN, doc.y);
    doc.moveDown(0.3);

    Object.entries(data.summary).forEach(([key, value]) => {
      addKeyValue(doc, key, value);
      doc.moveDown(0.3);
    });
  }

  doc.end();
  return bufferPromise;
}
