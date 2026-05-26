/**
 * Generate Teacher Guide PDF from HTML template using Puppeteer
 * Run: node scripts/createteacherguide.js
 * Output: sojs_teacher_guide.pdf
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const TEMPLATE = path.join(__dirname, 'teacher-guide-template.html');
const OUTPUT = path.join(__dirname, '../sojs_teacher_guide.pdf');
const OAKIE = path.join(__dirname, '../apps/frontend/public/oakie.png');

async function main() {
  // Read template and replace image paths with base64
  let html = fs.readFileSync(TEMPLATE, 'utf-8');
  
  // Convert oakie image to base64 data URI
  if (fs.existsSync(OAKIE)) {
    const imgData = fs.readFileSync(OAKIE).toString('base64');
    html = html.replace(/OAKIE_PATH/g, `data:image/png;base64,${imgData}`);
  } else {
    html = html.replace(/OAKIE_PATH/g, '');
  }

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  
  await page.pdf({
    path: OUTPUT,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
  });

  await browser.close();
  console.log('Generated: ' + OUTPUT);
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
