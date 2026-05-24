/**
 * Generate Parent Login Cards (Visiting Card Size)
 * 
 * Reads all students and their linked parents from the database,
 * generates a PDF with visiting-card-sized cards (85mm x 55mm)
 * containing login details and setup instructions.
 * 
 * Usage:
 *   node scripts/generate-parent-cards.js
 * 
 * Requires:
 *   - DATABASE_URL env var (or .env file in apps/api-gateway)
 *   - npm install pdfkit pg dotenv
 * 
 * Output:
 *   parent-login-cards.pdf (in current directory)
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

// Visiting card dimensions: 85mm x 55mm = 241pt x 156pt
const CARD_W = 241;
const CARD_H = 156;
const MARGIN = 8;
const CARDS_PER_ROW = 2;
const CARDS_PER_COL = 4;
const PAGE_MARGIN = 30;

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
    console.error('No students/parents found for school code:', SCHOOL_CODE);
    process.exit(1);
  }

  console.log(`Found ${result.rows.length} parent-student links`);

  // Group by student (one card per student, may have multiple parents)
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

  // Create PDF - A4 landscape for cutting
  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
  const outputPath = path.join(__dirname, '../parent-login-cards.pdf');
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  let cardIdx = 0;
  const cardsPerPage = CARDS_PER_ROW * CARDS_PER_COL;

  for (const student of students) {
    // Check if we need a new page
    if (cardIdx > 0 && cardIdx % cardsPerPage === 0) {
      doc.addPage();
    }

    const posOnPage = cardIdx % cardsPerPage;
    const col = posOnPage % CARDS_PER_ROW;
    const row = Math.floor(posOnPage / CARDS_PER_ROW);
    const x = PAGE_MARGIN + col * (CARD_W + 10);
    const y = PAGE_MARGIN + row * (CARD_H + 10);

    drawFrontCard(doc, x, y, student);
    cardIdx++;
  }

  // New pages for back side (instructions)
  const totalPages = Math.ceil(students.length / cardsPerPage);
  for (let p = 0; p < totalPages; p++) {
    doc.addPage();
    for (let i = 0; i < cardsPerPage; i++) {
      const col = i % CARDS_PER_ROW;
      // Mirror columns for back side (when printed double-sided)
      const mirrorCol = CARDS_PER_ROW - 1 - col;
      const row = Math.floor(i / CARDS_PER_ROW);
      const x = PAGE_MARGIN + mirrorCol * (CARD_W + 10);
      const y = PAGE_MARGIN + row * (CARD_H + 10);
      drawBackCard(doc, x, y);
    }
  }

  doc.end();
  await new Promise(resolve => stream.on('finish', resolve));
  
  console.log(`\nDone! PDF saved to: ${outputPath}`);
  console.log(`Total cards: ${students.length}`);
  console.log(`Total pages: ${totalPages * 2} (${totalPages} front + ${totalPages} back)`);
  console.log('\nPrint double-sided, cut along card borders.');
  
  await pool.end();
}

function drawFrontCard(doc, x, y, student) {
  // Card border with subtle shadow effect
  doc.roundedRect(x, y, CARD_W, CARD_H, 6).lineWidth(0.5).stroke('#d1d5db');

  // Header bar with logo area
  doc.rect(x, y, CARD_W, 24).fill('#1B4332');
  
  // Logo text (top-left)
  doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
    .text('oakit.ai', x + MARGIN, y + 5);
  doc.fillColor('#86efac').fontSize(5.5).font('Helvetica')
    .text(SCHOOL_NAME, x + MARGIN, y + 15);

  // "Your AI Mentor" badge (top-right)
  doc.fillColor('#86efac').fontSize(5).font('Helvetica-Bold')
    .text('Oakie - Your AI Mentor', x + CARD_W - 85, y + 9, { width: 77, align: 'right' });

  // Student name - CENTERED and prominent
  let ty = y + 32;
  doc.fillColor('#1B4332').fontSize(11).font('Helvetica-Bold')
    .text(student.student_name, x + MARGIN, ty, { width: CARD_W - MARGIN * 2, align: 'center' });
  ty += 14;
  doc.fillColor('#6b7280').fontSize(7).font('Helvetica')
    .text(`${student.class_name} - Section ${student.section_label}`, x + MARGIN, ty, { width: CARD_W - MARGIN * 2, align: 'center' });
  ty += 14;

  // Divider
  doc.moveTo(x + MARGIN + 20, ty).lineTo(x + CARD_W - MARGIN - 20, ty).lineWidth(0.3).stroke('#e5e7eb');
  ty += 8;

  // Login details - left side
  doc.fillColor('#374151').fontSize(6).font('Helvetica-Bold').text('PARENT LOGIN', x + MARGIN, ty);
  ty += 10;

  for (const parent of student.parents) {
    doc.fillColor('#111827').fontSize(7).font('Helvetica-Bold')
      .text(parent.name, x + MARGIN, ty);
    ty += 9;
    doc.fillColor('#1B4332').fontSize(7).font('Helvetica')
      .text(`Mobile: ${parent.mobile}  |  Password: ${parent.mobile}`, x + MARGIN, ty);
    ty += 11;
  }

  // Footer with URL
  doc.rect(x, y + CARD_H - 16, CARD_W, 16).fill('#f0fdf4');
  doc.fillColor('#1B4332').fontSize(6.5).font('Helvetica-Bold')
    .text(APP_URL, x + MARGIN, y + CARD_H - 12, { width: (CARD_W - MARGIN * 2) / 2 });
  doc.fillColor('#6b7280').fontSize(5.5).font('Helvetica')
    .text(`Code: ${SCHOOL_CODE}`, x + CARD_W - 60, y + CARD_H - 12, { width: 52, align: 'right' });

  // Oakie mascot (bottom-right corner, above footer)
  try {
    if (fs.existsSync(OAKIE_PATH)) {
      doc.image(OAKIE_PATH, x + CARD_W - 45, y + CARD_H - 58, { width: 35, height: 35 });
    }
  } catch { /* skip if not found */ }
}

function drawBackCard(doc, x, y) {
  // Card border
  doc.roundedRect(x, y, CARD_W, CARD_H, 6).lineWidth(0.5).stroke('#d1d5db');

  // School logo (centered at top)
  let ty = y + MARGIN;
  try {
    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, x + (CARD_W - 40) / 2, ty, { width: 40, height: 40 });
      ty += 44;
    }
  } catch { /* skip logo if not found */ }

  // School name
  doc.fillColor('#1B4332').fontSize(9).font('Helvetica-Bold')
    .text('Silver Oak Juniors', x + MARGIN, ty, { width: CARD_W - MARGIN * 2, align: 'center' });
  ty += 11;
  doc.fillColor('#6b7280').fontSize(6).font('Helvetica')
    .text('AI-Integrated Preschool', x + MARGIN, ty, { width: CARD_W - MARGIN * 2, align: 'center' });
  ty += 10;

  // Divider
  doc.moveTo(x + MARGIN + 30, ty).lineTo(x + CARD_W - MARGIN - 30, ty).lineWidth(0.3).stroke('#e5e7eb');
  ty += 6;

  // Quick start - compact
  doc.fillColor('#1B4332').fontSize(6).font('Helvetica-Bold')
    .text('Quick Start', x + MARGIN, ty);
  ty += 9;

  const steps = [
    `1. Open Chrome/Safari > ${APP_URL}`,
    `2. School Code: ${SCHOOL_CODE}`,
    '3. Enter Mobile & Password > Login',
  ];

  doc.fillColor('#374151').fontSize(5.5).font('Helvetica');
  for (const step of steps) {
    doc.text(step, x + MARGIN, ty, { width: CARD_W - MARGIN * 2 });
    ty += 7;
  }

  ty += 3;
  doc.fillColor('#374151').fontSize(5).font('Helvetica');
  doc.text('Android: Menu > Add to Home screen', x + MARGIN, ty); ty += 6;
  doc.text('iPhone: Share > Add to Home Screen', x + MARGIN, ty); ty += 6;

  // Footer
  doc.rect(x, y + CARD_H - 12, CARD_W, 12).fill('#1B4332');
  doc.fillColor('#86efac').fontSize(4.5).font('Helvetica-Bold')
    .text('Powered by oakit.ai - Where AI meets Early Education', x + MARGIN, y + CARD_H - 9, { width: CARD_W - MARGIN * 2, align: 'center' });
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
