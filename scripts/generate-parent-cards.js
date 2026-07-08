/**
 * Generate Parent Login Cards (Visiting Card Size on A3 Landscape)
 * 
 * Layout: A3 Landscape, 5 columns x 5 rows = 25 cards per sheet
 * Card size: 84mm x 54mm (standard visiting card)
 * Page order: Front page, then Back page (for double-sided printing)
 * Cut marks between cards for easy cutting
 * 
 * Usage:
 *   node scripts/generate-parent-cards.js
 * 
 * Output:
 *   parent-login-cards.pdf
 */

const PDFDocument = require('pdfkit');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load env
require('dotenv').config({ path: path.join(__dirname, '../apps/api-gateway/.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not set. Create apps/api-gateway/.env with DATABASE_URL=...');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const SCHOOL_CODE = 'soj';
const APP_URL = 'oakit.silveroakjuniors.in';
const SCHOOL_NAME = 'Silver Oak Juniors';
const LOGO_PATH = path.join(__dirname, '../apps/frontend/public/school-logo.png');
const OAKIE_PATH = path.join(__dirname, '../apps/frontend/public/oakie.png');

// A3 Landscape: 420mm x 297mm = 1190.55pt x 841.89pt
// Grid: 4 columns x 5 rows = 20 cards per sheet
// Cards sized to fill the sheet with minimal waste
// Card: ~98mm x 55mm (slightly wider than standard visiting card for better use of paper)
const COLS = 4;
const ROWS = 5;
const CARDS_PER_PAGE = COLS * ROWS; // 20

// A3 landscape dimensions in points
const PAGE_W = 1190.55;
const PAGE_H = 841.89;

// Page margins (for printer safe area)
const PAGE_MARGIN_X = 20; // ~7mm each side
const PAGE_MARGIN_Y = 16; // ~5.6mm top/bottom

// Gaps between cards for cutting
const GAP_X = 8;  // ~2.8mm between columns
const GAP_Y = 6;  // ~2.1mm between rows

// Calculate card size to fill available space
const CARD_W = Math.floor((PAGE_W - PAGE_MARGIN_X * 2 - (COLS - 1) * GAP_X) / COLS);  // ~278pt = ~98mm
const CARD_H = Math.floor((PAGE_H - PAGE_MARGIN_Y * 2 - (ROWS - 1) * GAP_Y) / ROWS);  // ~158pt = ~56mm

// Recalculate actual margins to center the grid
const GRID_W = COLS * CARD_W + (COLS - 1) * GAP_X;
const GRID_H = ROWS * CARD_H + (ROWS - 1) * GAP_Y;
const MARGIN_X = (PAGE_W - GRID_W) / 2;
const MARGIN_Y = (PAGE_H - GRID_H) / 2;
const M = 9; // inner card margin

async function main() {
  console.log('Connecting to database...');
  
  const result = await pool.query(`
    SELECT 
      s.name AS student_name,
      c.name AS class_name,
      sec.label AS section_label,
      s.father_name,
      s.mother_name,
      pu.mobile AS parent_mobile,
      pu.name AS parent_name
    FROM students s
    JOIN sections sec ON sec.id = s.section_id
    JOIN classes c ON c.id = sec.class_id
    JOIN parent_student_links psl ON psl.student_id = s.id
    JOIN parent_users pu ON pu.id = psl.parent_id
    WHERE s.is_active = true AND pu.is_active = true
      AND s.school_id = (SELECT id FROM schools WHERE subdomain = $1 LIMIT 1)
    ORDER BY c.name, sec.label, s.name, pu.name
  `, [SCHOOL_CODE]);

  if (result.rows.length === 0) {
    console.error('No activated parent logins found for school code:', SCHOOL_CODE);
    process.exit(1);
  }

  console.log(`Found ${result.rows.length} parent-student links`);

  // Group by student
  const studentMap = new Map();
  for (const row of result.rows) {
    const key = row.student_name + '|' + row.class_name + '|' + row.section_label;
    if (!studentMap.has(key)) {
      studentMap.set(key, {
        student_name: row.student_name,
        class_name: row.class_name,
        section_label: row.section_label,
        father_name: row.father_name,
        mother_name: row.mother_name,
        parents: [],
      });
    }
    studentMap.get(key).parents.push({
      name: row.parent_name,
      mobile: row.parent_mobile,
    });
  }

  const students = Array.from(studentMap.values());
  console.log(`Generating cards for ${students.length} students...`);
  console.log(`Cards per sheet: ${CARDS_PER_PAGE} (${COLS}x${ROWS})`);
  console.log(`Sheets needed: ${Math.ceil(students.length / CARDS_PER_PAGE)}`);

  // Create PDF - A3 Landscape
  const doc = new PDFDocument({
    size: [PAGE_W, PAGE_H],
    margin: 0,
    autoFirstPage: false,
  });
  const outputPath = path.join(__dirname, '../parent-login-cards.pdf');
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  // Process in batches of 25 (one sheet)
  const totalSheets = Math.ceil(students.length / CARDS_PER_PAGE);

  for (let sheet = 0; sheet < totalSheets; sheet++) {
    const startIdx = sheet * CARDS_PER_PAGE;
    const endIdx = Math.min(startIdx + CARDS_PER_PAGE, students.length);
    const batch = students.slice(startIdx, endIdx);

    // --- FRONT PAGE ---
    doc.addPage();
    drawCutMarks(doc);
    for (let i = 0; i < batch.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = MARGIN_X + col * (CARD_W + GAP_X);
      const y = MARGIN_Y + row * (CARD_H + GAP_Y);
      drawFrontCard(doc, x, y, batch[i]);
    }

    // --- BACK PAGE (immediately after front for double-sided printing) ---
    doc.addPage();
    drawCutMarks(doc);
    for (let i = 0; i < CARDS_PER_PAGE; i++) {
      // Mirror columns for back side (flip horizontally for double-sided)
      const col = (COLS - 1) - (i % COLS);
      const row = Math.floor(i / COLS);
      const x = MARGIN_X + col * (CARD_W + GAP_X);
      const y = MARGIN_Y + row * (CARD_H + GAP_Y);
      drawBackCard(doc, x, y);
    }
  }

  doc.end();
  await new Promise(resolve => stream.on('finish', resolve));
  
  console.log(`\nDone! PDF saved to: ${outputPath}`);
  console.log(`Total cards: ${students.length}`);
  console.log(`Total pages: ${totalSheets * 2} (alternating front/back)`);
  console.log(`Page size: A3 Landscape`);
  console.log('\nPrint double-sided (flip on short edge), cut along marks.');
  
  await pool.end();
}

function drawCutMarks(doc) {
  const markLen = 8;
  doc.lineWidth(0.25).strokeColor('#999999');

  // Draw cut marks at each card intersection
  for (let col = 0; col <= COLS; col++) {
    const cx = MARGIN_X + col * (CARD_W + GAP_X) - GAP_X / 2;
    // Top edge marks
    doc.moveTo(cx, MARGIN_Y - markLen - 2).lineTo(cx, MARGIN_Y - 2).stroke();
    // Bottom edge marks
    doc.moveTo(cx, MARGIN_Y + GRID_H + 2).lineTo(cx, MARGIN_Y + GRID_H + markLen + 2).stroke();
  }
  for (let row = 0; row <= ROWS; row++) {
    const cy = MARGIN_Y + row * (CARD_H + GAP_Y) - GAP_Y / 2;
    // Left edge marks
    doc.moveTo(MARGIN_X - markLen - 2, cy).lineTo(MARGIN_X - 2, cy).stroke();
    // Right edge marks
    doc.moveTo(MARGIN_X + GRID_W + 2, cy).lineTo(MARGIN_X + GRID_W + markLen + 2, cy).stroke();
  }
}

function drawFrontCard(doc, x, y, student) {
  // Card border
  doc.roundedRect(x, y, CARD_W, CARD_H, 4).lineWidth(0.3).stroke('#d1d5db');

  // Header bar
  doc.save();
  doc.roundedRect(x, y, CARD_W, 22, 4).clip();
  doc.rect(x, y, CARD_W, 22).fill('#1B4332');
  doc.restore();

  doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
    .text('oakit', x + M, y + 5, { continued: true });
  doc.fillColor('#E8960C').text('.ai');
  doc.fillColor('#86efac').fontSize(5).font('Helvetica')
    .text(SCHOOL_NAME, x + M, y + 14);
  doc.fillColor('#86efac').fontSize(5).font('Helvetica-Bold')
    .text('Oakie - Your AI Mentor', x + CARD_W - 85, y + 8, { width: 76, align: 'right' });

  // Student name - centered
  let ty = y + 28;
  doc.fillColor('#1B4332').fontSize(11).font('Helvetica-Bold')
    .text(student.student_name, x + M, ty, { width: CARD_W - M * 2, align: 'center' });
  ty += 14;
  doc.fillColor('#6b7280').fontSize(7).font('Helvetica')
    .text(`${student.class_name} - Section ${student.section_label}`, x + M, ty, { width: CARD_W - M * 2, align: 'center' });
  ty += 11;

  // Divider
  doc.moveTo(x + M, ty).lineTo(x + CARD_W - M, ty).lineWidth(0.3).stroke('#e5e7eb');
  ty += 5;

  // LEFT: Oakie mascot
  try {
    if (fs.existsSync(OAKIE_PATH)) {
      doc.image(OAKIE_PATH, x + 6, ty, { width: 68, height: 68 });
    }
  } catch { /* skip */ }

  // RIGHT: Parent login details
  const rightX = x + 80;
  const rightW = CARD_W - 80 - M;

  doc.fillColor('#374151').fontSize(6).font('Helvetica-Bold').text('PARENT LOGIN', rightX, ty + 2);
  let loginY = ty + 13;

  for (const parent of student.parents) {
    doc.fillColor('#111827').fontSize(7).font('Helvetica-Bold')
      .text(parent.name, rightX, loginY, { width: rightW });
    loginY += 10;
    doc.fillColor('#1B4332').fontSize(6).font('Helvetica')
      .text(`${parent.mobile} | Pass: ${parent.mobile}`, rightX, loginY, { width: rightW });
    loginY += 11;
  }

  // Footer
  doc.save();
  doc.roundedRect(x, y + CARD_H - 14, CARD_W, 14, 4).clip();
  doc.rect(x, y + CARD_H - 14, CARD_W, 14).fill('#f0fdf4');
  doc.restore();

  doc.fillColor('#1B4332').fontSize(6).font('Helvetica-Bold')
    .text(APP_URL, x + M, y + CARD_H - 11);
  doc.fillColor('#6b7280').fontSize(5).font('Helvetica')
    .text(`Code: ${SCHOOL_CODE}`, x + CARD_W - M - 50, y + CARD_H - 11, { width: 50, align: 'right' });
}

function drawBackCard(doc, x, y) {
  // Card border
  doc.roundedRect(x, y, CARD_W, CARD_H, 4).lineWidth(0.3).stroke('#d1d5db');

  let ty = y + M + 2;

  // School logo
  try {
    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, x + (CARD_W - 40) / 2, ty, { width: 40, height: 40 });
      ty += 44;
    }
  } catch { ty += 5; }

  // School name
  doc.fillColor('#1B4332').fontSize(9).font('Helvetica-Bold')
    .text('Silver Oak Juniors', x + M, ty, { width: CARD_W - M * 2, align: 'center' });
  ty += 11;
  doc.fillColor('#6b7280').fontSize(6).font('Helvetica')
    .text('AI-Integrated Preschool', x + M, ty, { width: CARD_W - M * 2, align: 'center' });
  ty += 10;

  // Divider
  doc.moveTo(x + M + 30, ty).lineTo(x + CARD_W - M - 30, ty).lineWidth(0.3).stroke('#e5e7eb');
  ty += 6;

  // Quick start
  doc.fillColor('#1B4332').fontSize(6).font('Helvetica-Bold')
    .text('Quick Start', x + M, ty);
  ty += 9;

  const steps = [
    `1. Open Chrome/Safari > ${APP_URL}`,
    `2. School Code: ${SCHOOL_CODE}`,
    '3. Enter Mobile & Password > Login',
  ];

  doc.fillColor('#374151').fontSize(5.5).font('Helvetica');
  for (const step of steps) {
    doc.text(step, x + M, ty, { width: CARD_W - M * 2 });
    ty += 7;
  }

  ty += 3;
  doc.fillColor('#374151').fontSize(5).font('Helvetica');
  doc.text('Android: Menu > Add to Home screen', x + M, ty); ty += 6;
  doc.text('iPhone: Share > Add to Home Screen', x + M, ty);

  // Footer
  doc.save();
  doc.roundedRect(x, y + CARD_H - 12, CARD_W, 12, 4).clip();
  doc.rect(x, y + CARD_H - 12, CARD_W, 12).fill('#1B4332');
  doc.restore();

  doc.fillColor('#86efac').fontSize(4.5).font('Helvetica-Bold')
    .text('Powered by oakit.ai - Where AI meets Early Education', x + M, y + CARD_H - 9, { width: CARD_W - M * 2, align: 'center' });
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
