/**
 * Shared spreadsheet import utility.
 * Parses .xlsx, .xls, and .csv files into typed row objects.
 * Used by holiday import, student import, and any future bulk imports.
 */

export interface ParsedRow {
  [key: string]: string;
}

export interface ImportResult {
  rows: ParsedRow[];
  headers: string[];
  error?: string;
}

/**
 * Parse a spreadsheet buffer into rows.
 * Returns headers (lowercased) and data rows as key→value maps.
 */
export function parseSpreadsheet(buffer: Buffer): ImportResult {
  const XLSX = require('xlsx');

  // OWASP A08: Validate file magic numbers — prevent disguised file uploads
  // xlsx/xls magic: PK\x03\x04 (zip) or \xD0\xCF\x11\xE0 (OLE2/xls)
  // csv: plain text (no magic bytes to check, but must not be binary)
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B;
  const isOLE = buffer[0] === 0xD0 && buffer[1] === 0xCF;
  const isProbablyText = buffer.slice(0, 3).every(b => b >= 0x09 && b <= 0x7E || b === 0x0A || b === 0x0D);

  if (!isZip && !isOLE && !isProbablyText) {
    return { rows: [], headers: [], error: 'Invalid file format. Only .xlsx, .xls, or .csv files are accepted.' };
  }

  // OWASP A08: Limit file size to prevent zip bomb / decompression attacks
  if (buffer.length > 5 * 1024 * 1024) { // 5MB max
    return { rows: [], headers: [], error: 'File too large. Maximum size is 5MB.' };
  }
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (!raw || raw.length < 1) {
    return { rows: [], headers: [], error: 'File is empty' };
  }

  // Normalise headers — trim whitespace, lowercase
  const headers: string[] = (raw[0] as any[]).map((h: any) =>
    String(h ?? '').trim().toLowerCase()
  );

  if (raw.length < 2) {
    return { rows: [], headers, error: 'File has no data rows (only a header row was found)' };
  }

  const rows: ParsedRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const cells = raw[i] as any[];
    // Skip completely empty rows
    if (cells.every(c => c === '' || c === null || c === undefined)) continue;
    const row: ParsedRow = {};
    headers.forEach((h, idx) => {
      const val = cells[idx];
      // Convert Date objects to ISO string
      if (val instanceof Date) {
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        row[h] = `${y}-${m}-${d}`;
      } else {
        row[h] = String(val ?? '').trim();
      }
    });
    rows.push(row);
  }

  return { rows, headers };
}

/**
 * Sanitize a string value from a spreadsheet cell.
 * - Strips leading/trailing whitespace
 * - Removes null bytes and control characters (XSS/injection prevention)
 * - Truncates to maxLen
 */
export function sanitizeCell(value: any, maxLen = 500): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')         // prevent HTML injection
    .slice(0, maxLen);
}

/**
 * Find a header in a list of candidates using exact then prefix matching.
 * Avoids false positives like 'date' matching inside 'description'.
 */
export function findHeader(headers: string[], candidates: string[]): string | null {
  // 1. Exact match
  for (const c of candidates) {
    if (headers.includes(c)) return c;
  }
  // 2. Starts-with match (e.g. 'event name' starts with 'event')
  for (const c of candidates) {
    const found = headers.find(h => h.startsWith(c) || c.startsWith(h));
    if (found) return found;
  }
  return null;
}

/**
 * Parse a date string in common Indian school formats.
 * Returns YYYY-MM-DD or null if unparseable.
 */
export function parseDate(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD-MM-YYYY or D-M-YYYY
  const m1 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`;

  // DD/MM/YYYY
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;

  // DD.MM.YYYY
  const m3 = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m3) return `${m3[3]}-${m3[2].padStart(2, '0')}-${m3[1].padStart(2, '0')}`;

  // Excel serial number (already converted to YYYY-MM-DD by cellDates:true, but just in case)
  const num = parseFloat(s);
  if (!isNaN(num) && num > 40000 && num < 60000) {
    const d = new Date(Math.round((num - 25569) * 86400 * 1000));
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dy = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${mo}-${dy}`;
  }

  return null;
}
