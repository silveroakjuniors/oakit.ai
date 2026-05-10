/**
 * pdf/receipt.ts — Fee payment receipt PDF generator
 */

import PDFDocument from 'pdfkit';
import {
  BrandingContext,
  GeneratorContext,
  MARGIN,
  PAGE_WIDTH,
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
  father_name?: string;
  mother_name?: string;
  parent_contact?: string;
  fee_head_breakdown: { name: string; amount: number }[];
  amount_paid: number;
  payment_mode: string;
  payment_date: Date;
  school_name: string;
  outstanding_after_payment?: number;
  instalment_context?: string;
  reference_number?: string;
}

/** Format a currency amount as "Rs. 1,23,456.00" — avoids ₹ glyph missing in built-in fonts */
function fmtRs(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function generateReceiptPDF(
  data: ReceiptData,
  branding: BrandingContext,
  ctx: GeneratorContext,
): Promise<Buffer> {
  const doc = new PDFDocument({ margin: MARGIN, size: 'A4', bufferPages: true });
  const bufferPromise = collectBuffer(doc);

  registerFooter(doc, ctx);

  // ── Header ────────────────────────────────────────────────────────────────
  let letterheadApplied = false;

  if (branding.letterhead_url) {
    try {
      console.log('[pdf/receipt] fetching letterhead:', branding.letterhead_url);

      // Use https/http module — more reliable than global fetch in Node.js
      const https = await import('https');
      const http = await import('http');
      const { letterheadBuffer, contentType } = await new Promise<{ letterheadBuffer: Buffer; contentType: string }>((resolve, reject) => {
        const protocol = branding.letterhead_url!.startsWith('https') ? https : http;
        protocol.get(branding.letterhead_url!, (res) => {
          const ct = res.headers['content-type'] || '';
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}`));
            res.resume();
            return;
          }
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => resolve({ letterheadBuffer: Buffer.concat(chunks), contentType: ct }));
          res.on('error', reject);
        }).on('error', reject);
      });

      console.log(`[pdf/receipt] letterhead fetched: ${letterheadBuffer.length} bytes, type: ${contentType}`);

      // PDFKit only supports JPEG and PNG — skip PDF letterheads
      if (contentType.includes('pdf')) {
        console.warn('[pdf/receipt] letterhead is a PDF — PDFKit cannot embed PDFs as images, using template header');
      } else {
        // Draw letterhead as full-page background
        doc.image(letterheadBuffer, 0, 0, { width: PAGE_WIDTH, height: 841.89 });

        // Title sits below the letterhead's top header band (~130pt)
        doc.y = 130;
        doc
          .font('Helvetica-Bold')
          .fontSize(13)
          .fillColor('#000000')
          .text('Fee Payment Receipt', MARGIN, doc.y, { align: 'center', width: CONTENT_WIDTH });
        const ruleY = doc.y + 6;
        doc.moveTo(MARGIN, ruleY).lineTo(PAGE_WIDTH - MARGIN, ruleY)
          .strokeColor('#cccccc').lineWidth(1).stroke();
        doc.strokeColor('#000000').lineWidth(1);
        doc.y = ruleY + 10;
        letterheadApplied = true;
      }
    } catch (err) {
      console.warn('[pdf/receipt] letterhead fetch failed, using template header:', (err as Error).message);
    }
  }

  if (!letterheadApplied) {
    addBrandedHeader(doc, branding, 'Fee Payment Receipt');
  }

  doc.moveDown(0.5);

  // ── Student details ───────────────────────────────────────────────────────
  addKeyValue(doc, 'Receipt No.', data.receipt_number);
  doc.moveDown(0.3);
  addKeyValue(doc, 'Student Name', data.student_name);
  doc.moveDown(0.3);
  addKeyValue(doc, 'Class', data.class_name);
  if (data.father_name) {
    doc.moveDown(0.3);
    addKeyValue(doc, "Father's Name", data.father_name);
  }
  if (data.mother_name) {
    doc.moveDown(0.3);
    addKeyValue(doc, "Mother's Name", data.mother_name);
  }
  if (data.parent_contact) {
    doc.moveDown(0.3);
    addKeyValue(doc, 'Contact', data.parent_contact);
  }
  doc.moveDown(0.3);
  addKeyValue(
    doc,
    'Payment Date',
    data.payment_date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
  );
  doc.moveDown(0.3);
  addKeyValue(doc, 'Payment Mode', data.payment_mode.toUpperCase());
  if (data.reference_number) {
    doc.moveDown(0.3);
    addKeyValue(doc, 'Reference / UTR', data.reference_number);
  }
  if (data.instalment_context) {
    doc.moveDown(0.3);
    addKeyValue(doc, 'Instalment', data.instalment_context);
  }
  doc.moveDown(0.8);

  // ── Fee breakdown table ───────────────────────────────────────────────────
  doc.font('Helvetica-Bold').fontSize(11).text('Fee Breakdown', MARGIN, doc.y);
  doc.moveDown(0.3);

  const breakdownRows = data.fee_head_breakdown.map((fh) => [
    fh.name,
    fmtRs(fh.amount),
  ]);
  addTable(doc, ['Fee Head', 'Amount'], breakdownRows, [CONTENT_WIDTH * 0.7, CONTENT_WIDTH * 0.3]);

  doc.moveDown(0.3);
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(`Total Amount Paid: ${fmtRs(data.amount_paid)}`, MARGIN, doc.y, {
      align: 'right',
      width: CONTENT_WIDTH,
    });

  if (data.outstanding_after_payment !== undefined && data.outstanding_after_payment > 0) {
    doc.moveDown(0.3);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#cc6600')
      .text(`Outstanding Balance: ${fmtRs(data.outstanding_after_payment)}`, MARGIN, doc.y, {
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
