/**
 * pdf/offerLetter.ts — Offer letter PDF generators
 *
 * Two variants:
 *  - generateOfferLetterPDF        — PDFKit-based, plain formatting
 *  - generateOfferLetterPDFWithBranding — Puppeteer-based, preserves Tiptap rich text,
 *                                         letterhead background, and principal signature
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
  addTable,
} from './base';

export interface OfferLetterData {
  staff_name: string;
  role: string;
  start_date: Date;
  salary_breakdown: { component: string; amount: number }[];
  employment_terms: string;
  school_name: string;
  signature?: {
    type: 'typed' | 'drawn';
    value: string; // typed name string OR base64 PNG data URL
    signed_at: Date;
    signer_name: string;
  };
}

// ---------------------------------------------------------------------------
// PDFKit variant — plain formatting
// ---------------------------------------------------------------------------

export async function generateOfferLetterPDF(
  data: OfferLetterData,
  branding: BrandingContext,
  ctx: GeneratorContext,
): Promise<Buffer> {
  const doc = new PDFDocument({ margin: MARGIN, size: 'A4', bufferPages: true });
  const bufferPromise = collectBuffer(doc);

  registerFooter(doc, ctx);
  addBrandedHeader(doc, branding, 'Offer Letter');

  doc.moveDown(0.8);

  const startDateStr = data.start_date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  doc.font('Helvetica').fontSize(11).text(`Dear ${data.staff_name},`, MARGIN, doc.y);
  doc.moveDown(0.5);

  doc.text(
    `We are pleased to offer you the position of ${data.role} at ${data.school_name}, ` +
      `effective from ${startDateStr}. Please find the details of your offer below.`,
    MARGIN,
    doc.y,
    { width: CONTENT_WIDTH },
  );

  doc.moveDown(0.8);

  doc.font('Helvetica-Bold').fontSize(11).text('Compensation Breakdown', MARGIN, doc.y);
  doc.moveDown(0.3);

  const salaryRows = data.salary_breakdown.map((s) => [s.component, `₹ ${s.amount.toFixed(2)}`]);
  addTable(doc, ['Component', 'Amount (per month)'], salaryRows, [
    CONTENT_WIDTH * 0.65,
    CONTENT_WIDTH * 0.35,
  ]);

  doc.moveDown(0.8);

  doc.font('Helvetica-Bold').fontSize(11).text('Terms and Conditions', MARGIN, doc.y);
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(10).text(data.employment_terms, MARGIN, doc.y, { width: CONTENT_WIDTH });

  doc.moveDown(1.5);

  doc.font('Helvetica').fontSize(10).text('Authorised Signatory', MARGIN, doc.y);
  doc.text(data.school_name, MARGIN, doc.y + 2);

  doc.end();
  return bufferPromise;
}

// ---------------------------------------------------------------------------
// Puppeteer variant — preserves Tiptap rich text + letterhead + signature
// ---------------------------------------------------------------------------

export async function generateOfferLetterPDFWithBranding(
  data: OfferLetterData,
  branding: BrandingContext,
): Promise<Buffer> {
  // Fetch letterhead as base64
  let letterheadBase64: string | null = null;
  let letterheadMime = 'image/png';
  if (branding.letterhead_url?.startsWith('http')) {
    try {
      const r = await fetch(branding.letterhead_url);
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        letterheadMime = r.headers.get('content-type') || 'image/png';
        letterheadBase64 = buf.toString('base64');
      }
    } catch (e) {
      console.warn('[pdf/offerLetter] letterhead fetch failed:', (e as Error).message);
    }
  }

  // Fetch principal signature as base64
  let sigBase64: string | null = null;
  let sigMime = 'image/png';
  if (branding.principal_signature_url?.startsWith('http')) {
    try {
      const r = await fetch(branding.principal_signature_url);
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        sigMime = r.headers.get('content-type') || 'image/png';
        sigBase64 = buf.toString('base64');
      }
    } catch { /* silent */ }
  }

  const letterheadStyle = letterheadBase64
    ? `background-image: url('data:${letterheadMime};base64,${letterheadBase64}');
       background-size: 100% 100%;
       background-repeat: no-repeat;`
    : '';

  const marginTop    = letterheadBase64 ? '46mm' : '15mm';
  const marginBottom = letterheadBase64 ? '25mm' : '15mm';
  const marginSide   = '15mm';

  const signatureHtml = sigBase64
    ? `<div class="sig-block">
         <img src="data:${sigMime};base64,${sigBase64}" style="height:50px;object-fit:contain;" />
       </div>`
    : `<div class="sig-block">
         <p style="margin:0 0 40px 0;font-size:10pt;">Authorised Signatory</p>
         <p style="margin:0;font-size:9pt;color:#555;">(${branding.school_name})</p>
       </div>`;

  let staffSigHtml = '';
  if (data.signature) {
    const signedAt = data.signature.signed_at.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    if (data.signature.type === 'typed') {
      staffSigHtml = `<div style="margin-top:24pt;">
        <p style="font-size:13pt;font-weight:bold;margin:0;">${data.signature.value}</p>
        <p style="font-size:8pt;color:#555;margin:2px 0 0 0;">Signed on: ${signedAt}</p>
      </div>`;
    } else {
      staffSigHtml = `<div style="margin-top:24pt;">
        <img src="${data.signature.value}" style="height:60px;object-fit:contain;" />
        <p style="font-size:8pt;color:#555;margin:2px 0 0 0;">Signed on: ${signedAt}</p>
      </div>`;
    }
  }

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    font-family: Arial, sans-serif;
    font-size: 10.5pt;
    color: #000;
    ${letterheadStyle}
  }
  .content {
    padding: ${marginTop} ${marginSide} ${marginBottom} ${marginSide};
  }
  .template-body { line-height: 1.5; }
  .template-body p { margin: 0 0 6pt 0; }
  .template-body strong, .template-body b { font-weight: bold; }
  .template-body em, .template-body i { font-style: italic; }
  .template-body u { text-decoration: underline; }
  .template-body h1, .template-body h2, .template-body h3 { margin: 8pt 0 4pt 0; }
  .template-body ul, .template-body ol { margin: 4pt 0; padding-left: 20pt; }
  .template-body li { margin-bottom: 2pt; }
  .sig-block { margin-top: 24pt; text-align: right; }
</style>
</head>
<body>
<div class="content">
  <div class="template-body">${data.employment_terms}</div>
  ${signatureHtml}
  ${staffSigHtml}
</div>
</body>
</html>`;

  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
