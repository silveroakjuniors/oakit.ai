/**
 * Generate Teacher Guide PDF from HTML template using Puppeteer
 *
 * Usage: node scripts/generate-teacher-guide.js
 * Output: teacher-guide.pdf (in oakit root)
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const TEMPLATE = path.join(__dirname, 'teacher-guide-template.html');
const OUTPUT = path.join(__dirname, '..', 'teacher-guide.pdf');
const OAKIE_IMG = path.join(__dirname, '..', 'apps', 'frontend', 'public', 'oakie.png');

async function generate() {
  // Read template
  let html = fs.readFileSync(TEMPLATE, 'utf-8');

  // Replace OAKIE_PATH with base64 data URI so it embeds in the PDF
  if (fs.existsSync(OAKIE_IMG)) {
    const imgBuffer = fs.readFileSync(OAKIE_IMG);
    const base64 = imgBuffer.toString('base64');
    const dataUri = `data:image/png;base64,${base64}`;
    html = html.replace(/OAKIE_PATH/g, dataUri);
  } else {
    console.warn('Warning: Oakie image not found at', OAKIE_IMG);
    html = html.replace(/OAKIE_PATH/g, '');
  }

  // Launch Puppeteer and generate PDF
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setContent(html, { waitUntil: 'domcontentloaded' });

  await page.pdf({
    path: OUTPUT,
    format: 'A4',
    printBackground: true,
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  await browser.close();

  console.log(`Generated: ${OUTPUT}`);
}

generate().catch((err) => {
  console.error('Error generating PDF:', err);
  process.exit(1);
});
