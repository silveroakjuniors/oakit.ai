/**
 * Generate Student Name Tags on A3 Sheet
 * 
 * Each tag has: School logo + Student Name + Class
 * Maximizes tags per A3 sheet with 3mm cutting gaps
 * 
 * Usage: node scripts/generate-name-tags.js
 * Output: name-tags.pdf
 */

const PDFDocument = require('pdfkit');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../apps/api-gateway/.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not set.');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const SCHOOL_CODE = 'soj';
const SCHOOL_NAME = 'Silver Oak Juniors';
const LOGO_PATH = path.join(__dirname, '../apps/frontend/public/school-logo.png');

// A3 Landscape: 420mm x 297mm = 1190.55pt x 841.89pt
const PAGE_W = 1190.55;
const PAGE_H = 841.89;

// 3mm gap = 8.5pt
const GAP = 8.5;

// Name tag size - compact to fit 50+ per page
// A3 landscape usable: ~380mm x ~253mm
// 5 cols x 10 rows = 50 tags per page
const TAG_H = 65;  // ~23mm tall

// Calculate grid: maximize tags
// Page margins (printer safe area): 10mm = 28pt each side
const PAGE_MARGIN = 28;
const USABLE_W = PAGE_W - PAGE_MARGIN * 2;
const USABLE_H = PAGE_H - PAGE_MARGIN * 2;

// Columns: fit 5 across
const TAG_W = 220;  // ~78mm wide

const COLS = Math.floor((USABLE_W + GAP) / (TAG_W + GAP));
const ROWS = Math.floor((USABLE_H + GAP) / (TAG_H + GAP));
const TAGS_PER_PAGE = COLS * ROWS;

// Center the grid
const GRID_W = COLS * TAG_W + (COLS - 1) * GAP;
const GRID_H = ROWS * TAG_H + (ROWS - 1) * GAP;
const OFFSET_X = PAGE_MARGIN + (USABLE_W - GRID_W) / 2;
const OFFSET_Y = PAGE_MARGIN + (USABLE_H - GRID_H) / 2;

async function main() {
  console.log('Connecting to database...');

  const result = await pool.query(`
    SELECT s.name AS student_name, c.name AS class_name, s.parent_contact
    FROM students s
    JOIN classes c ON c.id = s.class_id
    WHERE s.is_active = true
      AND s.school_id = (SELECT id FROM schools WHERE subdomain = $1 LIMIT 1)
    ORDER BY c.name, s.name
  `, [SCHOOL_CODE]);

  if (result.rows.length === 0) {
    console.error('No students found.');
    process.exit(1);
  }

  const students = result.rows;
  console.log(`Found ${students.length} students`);
  console.log(`Tag size: ${Math.round(TAG_W / 2.835)}mm x ${Math.round(TAG_H / 2.835)}mm`);
  console.log(`Grid: ${COLS} cols x ${ROWS} rows = ${TAGS_PER_PAGE} tags per page`);

  // Generate 3 sets: Day 1, Day 2, Day 3
  // Fill every page completely (no empty spots)
  const days = ['Day - 1', 'Day - 2', 'Day - 3'];
  const pagesPerSet = Math.ceil(students.length / TAGS_PER_PAGE);
  const totalTagsPerSet = pagesPerSet * TAGS_PER_PAGE; // fill entire pages
  console.log(`Tags per set: ${totalTagsPerSet} (${students.length} students + ${totalTagsPerSet - students.length} blank to fill pages)`);
  console.log(`Total pages: ${pagesPerSet * days.length} (3 sets)`);

  const doc = new PDFDocument({
    size: [PAGE_W, PAGE_H],
    margin: 0,
    autoFirstPage: false,
  });

  const outputPath = path.join(__dirname, '../name-tags.pdf');
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  for (const day of days) {
    for (let tagIdx = 0; tagIdx < totalTagsPerSet; tagIdx++) {
      if (tagIdx % TAGS_PER_PAGE === 0) {
        doc.addPage();
        drawCutLines(doc);
      }

      const pos = tagIdx % TAGS_PER_PAGE;
      const col = pos % COLS;
      const row = Math.floor(pos / COLS);
      const x = OFFSET_X + col * (TAG_W + GAP);
      const y = OFFSET_Y + row * (TAG_H + GAP);

      const student = tagIdx < students.length
        ? students[tagIdx]
        : { student_name: '', class_name: '', parent_contact: '' };

      drawTag(doc, x, y, student, day);
    }
  }

  doc.end();
  await new Promise(resolve => stream.on('finish', resolve));

  console.log(`\nDone! PDF saved to: ${outputPath}`);
  console.log(`Total tags: ${totalTagsPerSet * days.length}`);

  await pool.end();
}

function drawTag(doc, x, y, student, day) {
  // Tag border
  doc.roundedRect(x, y, TAG_W, TAG_H, 3).lineWidth(0.25).stroke('#d1d5db');

  // School logo (left, vertically centered)
  const logoSize = 32;
  const logoX = x + 5;
  const logoY = y + (TAG_H - logoSize) / 2;
  try {
    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, logoX, logoY, { width: logoSize, height: logoSize });
    }
  } catch { /* skip */ }

  // Day label (right side, top)
  const dayW = 48;
  const dayX = x + TAG_W - dayW - 4;
  doc.fillColor('#E8960C').fontSize(9).font('Helvetica-Bold')
    .text(day, dayX, y + 5, { width: dayW, align: 'center', height: 11, lineBreak: false });

  // "Welcome Back" (right side, below day, stylish dark green italic)
  doc.fillColor('#1B4332').fontSize(7).font('Helvetica-BoldOblique')
    .text('Welcome Back!', dayX, y + 18, { width: dayW, align: 'center', height: 9, lineBreak: false });

  // Center text area
  const textX = x + 5 + logoSize + 7;
  const textW = TAG_W - logoSize - dayW - 24;

  if (student.student_name) {
    // Student name (bold, single line)
    doc.fillColor('#1B4332').fontSize(11).font('Helvetica-Bold')
      .text(student.student_name, textX, y + 6, { width: textW, height: 14, lineBreak: false });

    // Class name (bold, visible)
    doc.fillColor('#374151').fontSize(9).font('Helvetica-Bold')
      .text(student.class_name, textX, y + 20, { width: textW, height: 11, lineBreak: false });

    // Contact number
    if (student.parent_contact) {
      doc.fillColor('#6b7280').fontSize(7).font('Helvetica')
        .text(student.parent_contact, textX, y + 33, { width: textW, height: 9, lineBreak: false });
    }
  }

  // School name (bottom left, bold)
  doc.fillColor('#1B4332').fontSize(6.5).font('Helvetica-Bold')
    .text(SCHOOL_NAME, textX, y + TAG_H - 14, { width: textW + dayW, height: 9, lineBreak: false });
}

function drawCutLines(doc) {
  // Light dashed lines at tag boundaries for cutting guidance
  doc.lineWidth(0.2).strokeColor('#cccccc');
  doc.dash(3, { space: 3 });

  // Vertical cut lines
  for (let col = 1; col < COLS; col++) {
    const cx = OFFSET_X + col * (TAG_W + GAP) - GAP / 2;
    doc.moveTo(cx, OFFSET_Y - 5).lineTo(cx, OFFSET_Y + GRID_H + 5).stroke();
  }

  // Horizontal cut lines
  for (let row = 1; row < ROWS; row++) {
    const cy = OFFSET_Y + row * (TAG_H + GAP) - GAP / 2;
    doc.moveTo(OFFSET_X - 5, cy).lineTo(OFFSET_X + GRID_W + 5, cy).stroke();
  }

  doc.undash();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
