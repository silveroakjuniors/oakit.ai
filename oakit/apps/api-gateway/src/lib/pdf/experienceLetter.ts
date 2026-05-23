/**
 * pdf/experienceLetter.ts — Experience letter PDF generator
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
} from './base';

export interface ExperienceLetterData {
  staff_name: string;
  role: string;
  start_date: Date;
  end_date: Date;
  school_name: string;
}

export async function generateExperienceLetterPDF(
  data: ExperienceLetterData,
  branding: BrandingContext,
  ctx: GeneratorContext,
): Promise<Buffer> {
  const doc = new PDFDocument({ margin: MARGIN, size: 'A4', bufferPages: true });
  const bufferPromise = collectBuffer(doc);

  registerFooter(doc, ctx);
  addBrandedHeader(doc, branding, 'Experience Letter');

  doc.moveDown(0.8);

  const startDateStr = data.start_date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const endDateStr = data.end_date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const issueDateStr = ctx.generated_at.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#444444')
    .text(`Date: ${issueDateStr}`, MARGIN, doc.y, { align: 'right', width: CONTENT_WIDTH });
  doc.fillColor('#000000');

  doc.moveDown(0.5);

  doc.font('Helvetica').fontSize(11).text(`To Whom It May Concern,`, MARGIN, doc.y);

  doc.moveDown(0.5);

  doc.text(
    `This is to certify that ${data.staff_name} was employed with ${data.school_name} ` +
      `as ${data.role} from ${startDateStr} to ${endDateStr}.`,
    MARGIN,
    doc.y,
    { width: CONTENT_WIDTH },
  );

  doc.moveDown(0.5);

  doc.text(
    `During their tenure, ${data.staff_name} demonstrated professionalism and dedication. ` +
      `We wish them the very best in their future endeavours.`,
    MARGIN,
    doc.y,
    { width: CONTENT_WIDTH },
  );

  doc.moveDown(1.5);

  doc.font('Helvetica').fontSize(10).text('Authorised Signatory', MARGIN, doc.y);
  doc.text(data.school_name, MARGIN, doc.y + 2);

  doc.end();
  return bufferPromise;
}
