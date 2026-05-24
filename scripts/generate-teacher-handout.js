/**
 * Generate Teacher Handout PDF
 * 
 * A colorful, visual guide for teachers on how to use Oakit.ai
 * Includes flow diagrams, step-by-step instructions, and branding.
 * 
 * Usage: node scripts/generate-teacher-handout.js
 * Output: teacher-handout.pdf
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUTPUT = path.join(__dirname, '../teacher-handout.pdf');
const LOGO_PATH = path.join(__dirname, '../apps/frontend/public/school-logo.png');
const OAKIE_PATH = path.join(__dirname, '../apps/frontend/public/oakie.png');

// Colors
const GREEN = '#1B4332';
const LIGHT_GREEN = '#D1FAE5';
const EMERALD = '#10b981';
const AMBER = '#E8960C';
const BLUE = '#3b82f6';
const VIOLET = '#8b5cf6';
const ROSE = '#f43f5e';
const GRAY = '#6b7280';
const LIGHT_GRAY = '#f9fafb';

const doc = new PDFDocument({ size: 'A4', margin: 40 });
doc.pipe(fs.createWriteStream(OUTPUT));

const W = doc.page.width;
const H = doc.page.height;
const M = 40; // margin
const CW = W - M * 2; // content width

// Helper functions
function drawHeader(title, subtitle) {
  doc.rect(0, 0, W, 80).fill(GREEN);
  // Logo
  try { if (fs.existsSync(LOGO_PATH)) doc.image(LOGO_PATH, M, 12, { height: 55 }); } catch {}
  // oakit.ai branding
  doc.fillColor('white').fontSize(18).font('Helvetica-Bold').text('oakit', W - 160, 20, { continued: true });
  doc.fillColor(AMBER).text('.ai');
  doc.fillColor('white').fontSize(9).font('Helvetica').text('Your School\'s AI Mentor', W - 160, 42);
  // Oakie mascot
  try { if (fs.existsSync(OAKIE_PATH)) doc.image(OAKIE_PATH, W - 75, 8, { height: 65 }); } catch {}
  doc.y = 95;
  // Title
  doc.fillColor(GREEN).fontSize(20).font('Helvetica-Bold').text(title, M, doc.y, { width: CW, align: 'center' });
  doc.moveDown(0.3);
  if (subtitle) {
    doc.fillColor(GRAY).fontSize(11).font('Helvetica').text(subtitle, M, doc.y, { width: CW, align: 'center' });
  }
  doc.moveDown(1);
}

function sectionTitle(text, color = GREEN) {
  doc.moveDown(0.5);
  doc.fillColor(color).fontSize(14).font('Helvetica-Bold').text(text, M);
  doc.moveDown(0.3);
  doc.moveTo(M, doc.y).lineTo(M + 80, doc.y).lineWidth(2).stroke(color);
  doc.moveDown(0.5);
}

function bullet(text, indent = 0) {
  const x = M + 15 + indent;
  doc.circle(x - 6, doc.y + 5, 2.5).fill(EMERALD);
  doc.fillColor('#1f2937').fontSize(10).font('Helvetica').text(text, x, doc.y, { width: CW - 30 - indent });
  doc.moveDown(0.2);
}

function numberedStep(num, title, desc, color = EMERALD) {
  const y = doc.y;
  // Number circle
  doc.circle(M + 12, y + 8, 10).fill(color);
  doc.fillColor('white').fontSize(9).font('Helvetica-Bold').text(String(num), M + 7, y + 4);
  // Title + desc
  doc.fillColor('#111827').fontSize(11).font('Helvetica-Bold').text(title, M + 30, y);
  doc.fillColor(GRAY).fontSize(9).font('Helvetica').text(desc, M + 30, doc.y, { width: CW - 50 });
  doc.moveDown(0.5);
}

function flowBox(x, y, w, h, text, color) {
  doc.roundedRect(x, y, w, h, 6).fill(color);
  doc.fillColor('white').fontSize(7).font('Helvetica-Bold').text(text, x + 4, y + h/2 - 5, { width: w - 8, align: 'center' });
}

function flowArrow(x1, y1, x2, y2) {
  doc.moveTo(x1, y1).lineTo(x2, y2).lineWidth(1.5).stroke('#9ca3af');
  // Arrow head
  doc.polygon([x2, y2], [x2 - 4, y2 - 4], [x2 + 4, y2 - 4]).fill('#9ca3af');
}

function checkPage(needed) {
  if (doc.y + needed > H - 60) {
    doc.addPage();
    doc.y = 40;
  }
}

function footer() {
  doc.fillColor('#d1d5db').fontSize(7).font('Helvetica')
    .text('Silver Oak Juniors | oakit.ai | Teacher Handout', M, H - 30, { width: CW, align: 'center' });
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 1: Cover + Introduction
// ═══════════════════════════════════════════════════════════════════════════
drawHeader('Teacher Handout', 'Your complete guide to using Oakit.ai in the classroom');

doc.fillColor('#374151').fontSize(10).font('Helvetica')
  .text('Welcome to Oakit.ai - the AI-powered platform that helps you plan lessons, track attendance, communicate with parents, and manage your classroom more effectively.', M, doc.y, { width: CW, align: 'center' });
doc.moveDown(1.5);

// What you can do - visual grid
sectionTitle('What You Can Do with Oakit');

const features = [
  { icon: 'Plan', label: 'View Daily Plans', color: EMERALD, desc: 'AI-generated lesson plans for each day' },
  { icon: 'Chat', label: 'Ask Oakie', color: BLUE, desc: 'Get teaching tips and activity ideas' },
  { icon: 'Mark', label: 'Mark Attendance', color: VIOLET, desc: 'One-tap attendance for your class' },
  { icon: 'Send', label: 'Send to Parents', color: AMBER, desc: 'Homework, notes, and daily updates' },
  { icon: 'Track', label: 'Track Progress', color: ROSE, desc: 'Child journey and observations' },
  { icon: 'View', label: 'Class Performance', color: GREEN, desc: 'Insights and analytics' },
];

const boxW = (CW - 20) / 3;
const boxH = 55;
features.forEach((f, i) => {
  const col = i % 3;
  const row = Math.floor(i / 3);
  const x = M + col * (boxW + 10);
  const y = doc.y + row * (boxH + 10);
  
  doc.roundedRect(x, y, boxW, boxH, 6).lineWidth(1).stroke(f.color);
  doc.circle(x + 15, y + 15, 8).fill(f.color);
  doc.fillColor('white').fontSize(6).font('Helvetica-Bold').text(f.icon, x + 9, y + 12);
  doc.fillColor('#111827').fontSize(9).font('Helvetica-Bold').text(f.label, x + 30, y + 8, { width: boxW - 35 });
  doc.fillColor(GRAY).fontSize(7).font('Helvetica').text(f.desc, x + 30, y + 20, { width: boxW - 35 });
});
doc.y += (boxH + 10) * 2 + 15;

// Daily workflow
checkPage(200);
sectionTitle('Your Daily Workflow');

const workflow = [
  { num: 1, title: 'Morning: Mark Attendance', desc: 'Open the app, go to Attendance, mark each student present/absent. Do this within 30 minutes of school start.', color: BLUE },
  { num: 2, title: 'View Today\'s Plan', desc: 'Check the Plan tab to see what topics are scheduled. Oakie has prepared everything based on your curriculum.', color: EMERALD },
  { num: 3, title: 'Teach & Record', desc: 'Teach your class. Use the Session Recorder if you want to log what was covered.', color: VIOLET },
  { num: 4, title: 'Mark Completion', desc: 'At the end of the day, tick the topics you covered and mark the day as complete.', color: AMBER },
  { num: 5, title: 'Send Updates', desc: 'Send homework and daily notes to parents. Use Child Journey for individual student highlights.', color: ROSE },
];

workflow.forEach(step => {
  checkPage(40);
  numberedStep(step.num, step.title, step.desc, step.color);
});

footer();

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 2: How to Login + Navigation
// ═══════════════════════════════════════════════════════════════════════════
doc.addPage();
drawHeader('Getting Started', 'How to login and navigate the app');

sectionTitle('How to Login', BLUE);

numberedStep(1, 'Open your browser', 'Use Chrome (Android/Desktop) or Safari (iPhone/iPad)', BLUE);
numberedStep(2, 'Go to oakit.silveroakjuniors.in', 'Type this URL in the address bar', BLUE);
numberedStep(3, 'Enter School Code: soj', 'This identifies your school', BLUE);
numberedStep(4, 'Enter your Mobile Number', 'The 10-digit number registered with the school', BLUE);
numberedStep(5, 'Enter Password & Login', 'Default password is your mobile number. Change it in Settings.', BLUE);

doc.moveDown(0.5);
doc.fillColor(GREEN).fontSize(9).font('Helvetica-Bold')
  .text('Save to Home Screen (works like an app!):', M);
doc.moveDown(0.3);
bullet('Android: Tap the 3-dot menu > "Add to Home screen"');
bullet('iPhone: Tap the Share button > "Add to Home Screen"');

checkPage(180);
sectionTitle('Navigation Guide', VIOLET);

doc.fillColor('#374151').fontSize(9).font('Helvetica')
  .text('The app has 3 main tabs at the bottom (mobile) or top (tablet):', M, doc.y, { width: CW });
doc.moveDown(0.5);

// Tab descriptions
const tabs = [
  { name: 'Plan', desc: 'Your daily lesson plan, topics to cover, and completion tracking', color: EMERALD },
  { name: 'Oakie (Chat)', desc: 'Ask Oakie anything - teaching tips, activity ideas, classroom management', color: BLUE },
  { name: 'Help', desc: 'Quick links to Attendance, Homework, Child Journey, Calendar, and more', color: VIOLET },
];

tabs.forEach(tab => {
  checkPage(30);
  doc.roundedRect(M, doc.y, CW, 28, 4).fill(tab.color + '15');
  doc.fillColor(tab.color).fontSize(10).font('Helvetica-Bold').text(tab.name, M + 10, doc.y + 5);
  doc.fillColor(GRAY).fontSize(8).font('Helvetica').text(tab.desc, M + 80, doc.y - 8, { width: CW - 90 });
  doc.y += 5;
  doc.moveDown(0.3);
});

checkPage(120);
sectionTitle('Header Icons', GREEN);
bullet('Calendar icon - View holidays and special days for the month');
bullet('Chart icon - Class Performance dashboard with stats');
bullet('Flame icon - Your teaching streak (consecutive days completed)');

footer();

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 3: Attendance + Homework
// ═══════════════════════════════════════════════════════════════════════════
doc.addPage();
drawHeader('Daily Tasks', 'Attendance, Homework & Notes');

sectionTitle('Marking Attendance', BLUE);

doc.fillColor('#374151').fontSize(9).font('Helvetica')
  .text('Attendance should be marked every morning within 30 minutes of school start time.', M, doc.y, { width: CW });
doc.moveDown(0.5);

numberedStep(1, 'Go to Help tab > Attendance', 'Or tap the attendance prompt if shown', BLUE);
numberedStep(2, 'Mark each student', 'Tap Present (green) or Absent (red) for each child', BLUE);
numberedStep(3, 'Submit', 'Tap "Submit Attendance" - parents are notified automatically', BLUE);

doc.moveDown(0.3);
doc.roundedRect(M, doc.y, CW, 30, 4).fill('#fef3c7');
doc.fillColor('#92400e').fontSize(8).font('Helvetica-Bold').text('Important:', M + 10, doc.y + 5);
doc.fillColor('#92400e').fontSize(8).font('Helvetica').text('Once a student is marked Present, they cannot be changed to Absent. Late arrivals can be marked separately.', M + 10, doc.y + 5, { width: CW - 20 });
doc.y += 10;
doc.moveDown(1);

checkPage(180);
sectionTitle('Sending Homework', AMBER);

numberedStep(1, 'Go to Help tab > Homework & Notes', 'Opens the homework page', AMBER);
numberedStep(2, 'Type or dictate homework', 'Use the mic button to speak instead of typing', AMBER);
numberedStep(3, 'Ask Oakie to format', 'Oakie makes it parent-friendly and clear', AMBER);
numberedStep(4, 'Send to Parents', 'All parents in your section receive it instantly', AMBER);

doc.moveDown(0.5);
doc.roundedRect(M, doc.y, CW, 25, 4).fill(LIGHT_GREEN);
doc.fillColor(GREEN).fontSize(8).font('Helvetica-Bold').text('Tip: ', M + 10, doc.y + 5, { continued: true });
doc.fillColor('#065f46').font('Helvetica').text('You can also send Class Notes with subject tags and file attachments (PDFs, worksheets).', { width: CW - 25 });
doc.y += 5;
doc.moveDown(1);

checkPage(150);
sectionTitle('Child Journey (Daily Notes)', EMERALD);

doc.fillColor('#374151').fontSize(9).font('Helvetica')
  .text('Send personalized daily updates about each child to their parents.', M, doc.y, { width: CW });
doc.moveDown(0.5);

bullet('Write individual notes for each student');
bullet('Use "Generic Class Note" to send the same note to all students');
bullet('Use "Save & Send All" to save and notify parents immediately');
bullet('Parents see these in their daily feed with the child\'s name');

footer();

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 4: Oakie AI + Tips
// ═══════════════════════════════════════════════════════════════════════════
doc.addPage();
drawHeader('Using Oakie', 'Your AI teaching assistant');

sectionTitle('What Can Oakie Help With?', BLUE);

const oakieHelps = [
  'Explain today\'s curriculum topics in simple terms',
  'Suggest activities and games for any subject',
  'Help with classroom management situations',
  'Format homework and notes for parents',
  'Answer questions about your textbook content',
  'Provide teaching tips for different age groups',
];

oakieHelps.forEach(h => { checkPage(15); bullet(h); });

doc.moveDown(0.5);
doc.roundedRect(M, doc.y, CW, 35, 4).fill('#eff6ff');
doc.fillColor('#1e40af').fontSize(8).font('Helvetica-Bold').text('How to ask Oakie:', M + 10, doc.y + 5);
doc.fillColor('#1e40af').fontSize(8).font('Helvetica')
  .text('Just type naturally! Examples: "What activities can I do for counting?" or "How to handle a crying child?" or "Explain today\'s English topic"', M + 10, doc.y + 5, { width: CW - 20 });
doc.y += 15;
doc.moveDown(1);

checkPage(200);
sectionTitle('Important Rules', ROSE);

const rules = [
  'Mark attendance EVERY day before 10:00 AM',
  'Complete the day\'s plan before leaving - this notifies parents',
  'Send homework ONLY on working days (not weekends/holidays)',
  'Child Journey notes should be positive and encouraging',
  'Never share your login credentials with anyone',
  'Change your password from the default (your mobile number)',
];

rules.forEach((r, i) => {
  checkPage(20);
  const y = doc.y;
  doc.circle(M + 12, y + 5, 8).fill(ROSE);
  doc.fillColor('white').fontSize(7).font('Helvetica-Bold').text(String(i + 1), M + 9, y + 2);
  doc.fillColor('#111827').fontSize(9).font('Helvetica').text(r, M + 28, y, { width: CW - 40 });
  doc.moveDown(0.4);
});

doc.moveDown(1);
checkPage(80);

// Contact info
doc.roundedRect(M, doc.y, CW, 50, 6).fill(GREEN);
doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
  .text('Need Help?', M + 15, doc.y + 10, { width: CW - 30 });
doc.fillColor('#86efac').fontSize(9).font('Helvetica')
  .text('Ask Oakie in the chat tab - available 24/7', M + 15, doc.y + 5, { width: CW - 30 });
doc.fillColor('#86efac').fontSize(9).font('Helvetica')
  .text('Or contact your school admin for account issues', M + 15, doc.y + 5, { width: CW - 30 });

footer();

// ═══════════════════════════════════════════════════════════════════════════
doc.end();
console.log(`Teacher handout generated: ${OUTPUT}`);
console.log('4 pages: Cover + Getting Started + Daily Tasks + Using Oakie');
