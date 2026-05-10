/**
 * pdf/index.ts — Barrel export for all PDF generators
 *
 * Import from here instead of individual files:
 *   import { generateReceiptPDF, BrandingContext } from '../lib/pdf';
 */

export type { BrandingContext, GeneratorContext } from './base';

export type { ReceiptData } from './receipt';
export { generateReceiptPDF } from './receipt';

export type { PayslipData } from './payslip';
export { generatePayslipPDF } from './payslip';

export type { ReportData } from './report';
export { generateReportPDF } from './report';

export type { OfferLetterData } from './offerLetter';
export { generateOfferLetterPDF, generateOfferLetterPDFWithBranding } from './offerLetter';

export type { ExperienceLetterData } from './experienceLetter';
export { generateExperienceLetterPDF } from './experienceLetter';
