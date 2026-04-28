/**
 * pdfService.ts — Re-export shim (kept for backwards compatibility)
 *
 * All PDF logic has been moved to lib/pdf/:
 *   lib/pdf/base.ts            — shared primitives & interfaces
 *   lib/pdf/receipt.ts         — fee payment receipt
 *   lib/pdf/payslip.ts         — salary payslip
 *   lib/pdf/report.ts          — financial / tabular report
 *   lib/pdf/offerLetter.ts     — offer letter (PDFKit + Puppeteer variants)
 *   lib/pdf/experienceLetter.ts — experience letter
 *
 * New code should import directly from './pdf' or the specific sub-module.
 * Existing imports from './pdfService' continue to work unchanged.
 */

export type {
  BrandingContext,
  GeneratorContext,
  ReceiptData,
  PayslipData,
  ReportData,
  OfferLetterData,
  ExperienceLetterData,
} from './pdf';

export {
  generateReceiptPDF,
  generatePayslipPDF,
  generateReportPDF,
  generateOfferLetterPDF,
  generateOfferLetterPDFWithBranding,
  generateExperienceLetterPDF,
} from './pdf';
