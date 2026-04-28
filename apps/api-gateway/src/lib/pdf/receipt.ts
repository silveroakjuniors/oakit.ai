/**
 * pdf/receipt.ts — Fee payment receipt PDF generator
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

export interface ReceiptData {
  receipt_number: string;
  student_name: string;
  class_name: string;
  fee_head_breakdown: { name: string; amount: number }[];
  amount_paid: number;
  payment_mode: string;
  payment_date: Date;
  school_name: string;
  outstanding_after_payment?: number;  // remaining balance after this payment
  instalment_context?: string;         // e.g. "Instalment 2 of 4 — Q2 Fee"
  reference_number?: string;
}

export async function generateReceiptPDF(
  data: ReceiptData,
  branding: BrandingContext,
  ctx: GeneratorContext,
): Promise<Buffer> {
  const doc = new PDFDocument({ margin: MARGIN, size: 'A4', bufferPages: true });
  const bufferPromise = collectBuffer(doc);

  registerFooter(doc, ctx);

  // If letterhead is provided, fetch and use it as the page background
  if (branding.letterhead_url) {
    try {
      const https = await import('https');
      const http = await import('http');
      const letterheadBuffer = await new Promise<Buffer>((resolve, reject) => {
        const protocol = branding.letterhead_url!.startsWith('https') ? https : http;
        protocol.get(branding.letterhead_url!, (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => resolve(Buffer.concat(chunks)));
          res.on('error', reject);
        }).on('error', reject);
      });
      // Draw letterhead as full-page background
      doc.image(letterheadBuffer, 0, 0, { width: 595.28, height: 841.89 });
      doc.y = 120; // start content below letterhead header area
    } catch {
      // Letterhead fetch failed — fall back to branded header
      addBrandedHeader(doc, branding, 'Fee Payment Receipt');
    }
  } else {
    addBrandedHeader(doc, branding, 'Fee Payment Receipt');
  }

  doc.moveDown(0.5);

  addKeyValue(doc, 'Receipt No.', data.receipt_number);
  doc.moveDown(0.3);
  addKeyValue(doc, 'Student Name', data.student_name);
  doc.moveDown(0.3);
  addKeyValue(doc, 'Class', data.class_name);
  doc.moveDown(0.3);
  addKeyValue(
    doc,
    'Payment Date',
    data.payment_date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
  );
  doc.moveDown(0.3);
  addKeyValue(doc, 'Payment Mode', data.payment_mode);
  if (data.reference_number) {
    doc.moveDown(0.3);
    addKeyValue(doc, 'Reference / UTR', data.reference_number);
  }
  if (data.instalment_context) {
    doc.moveDown(0.3);
    addKeyValue(doc, 'Instalment', data.instalment_context);
  }
  doc.moveDown(0.8);

  doc.font('Helvetica-Bold').fontSize(11).text('Fee Breakdown', MARGIN, doc.y);
  doc.moveDown(0.3);

  const breakdownRows = data.fee_head_breakdown.map((fh) => [
    fh.name,
    `₹ ${fh.amount.toFixed(2)}`,
  ]);
  addTable(doc, ['Fee Head', 'Amount'], breakdownRows, [CONTENT_WIDTH * 0.7, CONTENT_WIDTH * 0.3]);

  doc.moveDown(0.3);
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(`Total Amount Paid: ₹ ${data.amount_paid.toFixed(2)}`, MARGIN, doc.y, {
      align: 'right',
      width: CONTENT_WIDTH,
    });

  if (data.outstanding_after_payment !== undefined && data.outstanding_after_payment > 0) {
    doc.moveDown(0.3);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#cc6600')
      .text(`Outstanding Balance: ₹ ${data.outstanding_after_payment.toFixed(2)}`, MARGIN, doc.y, {
        align: 'right',
        width: CONTENT_WIDTH,
      });
    doc.fillColor('#000000');
  }

  doc.moveDown(1);

  doc
    .font('Helvetica-Oblique')
    .fontSize(9)
    .fillColor('#cc0000')
    .text(
      'Please note: Fees once paid cannot be refunded under any circumstances.',
      MARGIN,
      doc.y,
      { align: 'center', width: CONTENT_WIDTH },
    );

  doc.fillColor('#000000');
  doc.end();
  return bufferPromise;
}
