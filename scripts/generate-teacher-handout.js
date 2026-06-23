/**
 * Generate Teacher Handout PDF - Complete User Guide
 * 
 * Usage: node scripts/generate-teacher-handout.js
 * Output: teacher-handout.pdf
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUTPUT = path.join(__dirname, '../teacher-handout1.pdf');
const OAKIE_PATH = path.join(__dirname, '../apps/frontend/public/oakie.png');

// Professional color palette
const C = {
  primary: '#1B4332',
  primaryLight: '#2d6a4f',
  accent: '#E8960C',
  blue: '#1e40af',
  blueLight: '#eff6ff',
  emerald: '#065f46',
  emeraldLight: '#ecfdf5',
  amber: '#92400e',
  amberLight: '#fffbeb',
  rose: '#9f1239',
  roseLight: '#fff1f2',
  violet: '#5b21b6',
  violetLight: '#f5f3ff',
  gray: '#4b5563',
  grayLight: '#f3f4f6',
  text: '#111827',
  muted: '#6b7280',
  white: '#ffffff',
};

const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } });
doc.pipe(fs.createWriteStream(OUTPUT));

const W = doc.page.width;
const H = doc.page.height;
const M = 50;
const CW = W - M * 2;

let pageNum = 0;

function newPage() {
  if (pageNum > 0) {
    drawPageFooter();
    doc.addPage();
  }
  pageNum++;
  doc.y = 50;
}

function drawPageHeader() {
  doc.rect(0, 0, W, 40).fill(C.primary);
  doc.fillColor(C.white).fontSize(12).font('Helvetica-Bold').text('oakit', M, 12, { continued: true });
  doc.fillColor(C.accent).text('.ai');
  doc.fillColor('#86efac').fontSize(7).font('Helvetica').text("Silver Oak Junior's AI Mentor", M, 26);
  try { if (fs.existsSync(OAKIE_PATH)) doc.image(OAKIE_PATH, W - 75, 3, { height: 34 }); } catch {}
  doc.y = 55;
}

function drawPageFooter() {
  doc.fillColor(C.muted).fontSize(7).font('Helvetica')
    .text(`oakit.ai  |  Silver Oak Junior's AI Mentor  |  Teacher Guide  |  Page ${pageNum}`, M, H - 35, { width: CW, align: 'center' });
}

function header(text) {
  checkSpace(40);
  doc.fillColor(C.primary).fontSize(16).font('Helvetica-Bold').text(text, M, doc.y, { width: CW });
  doc.moveDown(0.2);
  doc.moveTo(M, doc.y).lineTo(M + 60, doc.y).lineWidth(2).stroke(C.accent);
  doc.moveDown(0.6);
}

function subheader(text) {
  doc.fillColor(C.primaryLight).fontSize(12).font('Helvetica-Bold').text(text, M, doc.y, { width: CW });
  doc.moveDown(0.3);
}

function para(text) {
  doc.fillColor(C.text).fontSize(9.5).font('Helvetica').text(text, M, doc.y, { width: CW, lineGap: 2 });
  doc.moveDown(0.4);
}

function bullet(text, indent = 0) {
  const x = M + 12 + indent;
  doc.fillColor(C.primary).fontSize(9.5).font('Helvetica').text('\u2022  ' + text, x, doc.y, { width: CW - 20 - indent, lineGap: 1 });
  doc.moveDown(0.15);
}

function step(num, title, desc) {
  doc.fillColor(C.primary).fontSize(10).font('Helvetica-Bold').text(`${num}. ${title}`, M + 5, doc.y, { width: CW - 10 });
  if (desc) {
    doc.fillColor(C.gray).fontSize(9).font('Helvetica').text(`   ${desc}`, M + 5, doc.y, { width: CW - 15, lineGap: 1 });
  }
  doc.moveDown(0.3);
}

function tipBox(text) {
  const y = doc.y;
  const h = doc.heightOfString(text, { width: CW - 30 }) + 14;
  doc.roundedRect(M, y, CW, h, 4).fill(C.emeraldLight);
  doc.fillColor(C.emerald).fontSize(8).font('Helvetica-Bold').text('Tip: ', M + 10, y + 7, { continued: true });
  doc.font('Helvetica').text(text, { width: CW - 30 });
  doc.y = y + h + 5;
  doc.moveDown(0.3);
}

function warnBox(text) {
  const y = doc.y;
  const h = doc.heightOfString(text, { width: CW - 30 }) + 14;
  doc.roundedRect(M, y, CW, h, 4).fill(C.amberLight);
  doc.fillColor(C.amber).fontSize(8).font('Helvetica-Bold').text('Important: ', M + 10, y + 7, { continued: true });
  doc.font('Helvetica').text(text, { width: CW - 30 });
  doc.y = y + h + 5;
  doc.moveDown(0.3);
}

function checkSpace(needed) {
  if (doc.y + needed > H - 60) {
    drawPageFooter();
    doc.addPage();
    pageNum++;
    doc.y = 50;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COVER PAGE
// ═══════════════════════════════════════════════════════════════════════════
pageNum = 1;

// Top bar
doc.rect(0, 0, W, 6).fill(C.primary);

doc.y = 120;

// oakit.ai logo text
doc.fillColor(C.primary).fontSize(36).font('Helvetica-Bold').text('oakit', M, doc.y, { continued: true, width: CW, align: 'center' });
doc.fillColor(C.accent).text('.ai', { width: CW });
doc.moveDown(0.5);
doc.fillColor(C.muted).fontSize(12).font('Helvetica').text("Silver Oak Junior's AI Mentor", M, doc.y, { width: CW, align: 'center' });

doc.moveDown(3);

// Oakie mascot
try { if (fs.existsSync(OAKIE_PATH)) doc.image(OAKIE_PATH, (W - 120) / 2, doc.y, { width: 120 }); } catch {}
doc.y += 130;

doc.moveDown(2);
doc.fillColor(C.primary).fontSize(22).font('Helvetica-Bold').text('Teacher User Guide', M, doc.y, { width: CW, align: 'center' });
doc.moveDown(0.5);
doc.fillColor(C.muted).fontSize(11).font('Helvetica').text('Complete guide to using Oakit.ai in your classroom', M, doc.y, { width: CW, align: 'center' });

doc.moveDown(4);
doc.fillColor(C.muted).fontSize(9).font('Helvetica').text('Silver Oak Juniors  |  AI-Integrated Preschool', M, doc.y, { width: CW, align: 'center' });
doc.moveDown(0.3);
doc.fillColor(C.muted).fontSize(8).font('Helvetica').text('oakit.silveroakjuniors.in  |  School Code: soj', M, doc.y, { width: CW, align: 'center' });

drawPageFooter();

// ═══════════════════════════════════════════════════════════════════════════
// TABLE OF CONTENTS
// ═══════════════════════════════════════════════════════════════════════════
newPage();

header('Table of Contents');
doc.moveDown(0.5);

const toc = [
  { title: '1. Getting Started', sub: 'Login, Save to Home Screen, Navigation' },
  { title: '2. Daily Plan', sub: 'View plan, Topics, Raw Plan, Week Plan' },
  { title: '3. Oakie AI Chat', sub: 'Ask questions, Get activity ideas, Teaching tips' },
  { title: '4. Attendance', sub: 'Mark attendance, Late arrivals, Rules' },
  { title: '5. Homework & Notes', sub: 'Send homework, Class notes, File attachments' },
  { title: '6. Child Journey', sub: 'Daily highlights, Generic notes, Send to parents' },
  { title: '7. Report Cards & Observations', sub: 'Term reports, Category observations' },
  { title: '8. Calendar', sub: 'Holidays, Special days, Monthly view' },
  { title: '9. Class Performance', sub: 'Stats, Parent engagement, School comparison' },
  { title: '10. Students & Milestones', sub: 'Student profiles, Milestone tracking' },
  { title: '11. Class Feed', sub: 'Post photos and updates for parents' },
  { title: '12. My HR', sub: 'Salary, Leave requests, Offer letters' },
  { title: '13. Important Rules', sub: 'Do\'s and Don\'ts for teachers' },
];

toc.forEach(item => {
  doc.fillColor(C.text).fontSize(10).font('Helvetica-Bold').text(item.title, M + 10, doc.y);
  doc.fillColor(C.muted).fontSize(8).font('Helvetica').text(item.sub, M + 25, doc.y, { width: CW - 30 });
  doc.moveDown(0.5);
});

drawPageFooter();

// ═══════════════════════════════════════════════════════════════════════════
// APP OVERVIEW - Flow Diagrams
// ═══════════════════════════════════════════════════════════════════════════
newPage();
header('What You Can Do with Oakit');

para('Oakit helps you manage your entire teaching day from one app:');
doc.moveDown(0.3);

// Flow boxes - 2 columns x 3 rows
const capabilities = [
  { title: 'View Daily Plans', desc: 'AI-generated lesson plans', color: C.primary },
  { title: 'Ask Oakie (AI Chat)', desc: 'Teaching tips & activity ideas', color: C.blue },
  { title: 'Mark Attendance', desc: 'One-tap daily attendance', color: C.violet },
  { title: 'Send Homework', desc: 'Format & send to parents', color: C.accent },
  { title: 'Child Journey', desc: 'Daily notes per student', color: '#059669' },
  { title: 'Class Performance', desc: 'Stats & insights dashboard', color: '#dc2626' },
];

const bw = (CW - 15) / 2;
const bh = 32;
capabilities.forEach((cap, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const bx = M + col * (bw + 15);
  const by = doc.y + row * (bh + 8);
  doc.roundedRect(bx, by, bw, bh, 4).lineWidth(1).stroke(cap.color);
  doc.fillColor(cap.color).fontSize(9).font('Helvetica-Bold').text(cap.title, bx + 8, by + 6, { width: bw - 16 });
  doc.fillColor(C.muted).fontSize(7.5).font('Helvetica').text(cap.desc, bx + 8, by + 18, { width: bw - 16 });
});
doc.y += (bh + 8) * 3 + 10;

doc.moveDown(1);
header('Your Daily Workflow');

// Vertical flow with arrows
const workflow = [
  { step: 'Morning', action: 'Mark Attendance', detail: 'Within 30 min of school start' },
  { step: 'Plan', action: 'View Today\'s Plan', detail: 'Check topics and activities' },
  { step: 'Teach', action: 'Conduct Class', detail: 'Use Oakie for help anytime' },
  { step: 'End of Day', action: 'Mark Completion', detail: 'Tick covered topics' },
  { step: 'Communicate', action: 'Send Updates', detail: 'Homework + Child Journey notes' },
];

workflow.forEach((w, i) => {
  checkSpace(30);
  const wy = doc.y;
  // Step circle
  doc.circle(M + 12, wy + 8, 8).fill(C.primary);
  doc.fillColor(C.white).fontSize(7).font('Helvetica-Bold').text(String(i + 1), M + 9, wy + 5);
  // Content
  doc.fillColor(C.text).fontSize(10).font('Helvetica-Bold').text(`${w.step}: ${w.action}`, M + 28, wy);
  doc.fillColor(C.muted).fontSize(8).font('Helvetica').text(w.detail, M + 28, wy + 12);
  // Arrow line (except last)
  if (i < workflow.length - 1) {
    doc.moveTo(M + 12, wy + 18).lineTo(M + 12, wy + 28).lineWidth(1).stroke('#d1d5db');
  }
  doc.y = wy + 28;
});

doc.moveDown(1.5);
checkSpace(200);
header('Navigation Structure');

para('The app has 3 main tabs. Each tab contains specific features:');
doc.moveDown(0.3);

// Navigation tree
const navTree = [
  { tab: 'Plan', color: C.primary, features: ['Today\'s lesson plan', 'Topic checkboxes', 'Mark as Done', 'Raw Plan view', 'Week Plan download', 'Session Recorder'] },
  { tab: 'Oakie (Chat)', color: C.blue, features: ['Ask curriculum questions', 'Get activity ideas', 'Classroom management tips', 'Voice input (mic button)', 'AI-formatted responses'] },
  { tab: 'Help (Quick Links)', color: C.violet, features: ['Attendance', 'Homework & Notes', 'Child Journey', 'Report Cards', 'Class Feed', 'Students & Milestones', 'Calendar', 'Class Performance', 'My HR'] },
];

navTree.forEach(nav => {
  checkSpace(80);
  const ny = doc.y;
  // Tab header
  doc.roundedRect(M, ny, CW, 18, 3).fill(nav.color);
  doc.fillColor(C.white).fontSize(9).font('Helvetica-Bold').text(nav.tab, M + 10, ny + 4);
  doc.y = ny + 22;
  // Features
  nav.features.forEach(f => {
    doc.fillColor(C.gray).fontSize(8).font('Helvetica').text('  - ' + f, M + 15, doc.y);
    doc.moveDown(0.1);
  });
  doc.moveDown(0.4);
});

drawPageFooter();

// ═══════════════════════════════════════════════════════════════════════════
// 1. GETTING STARTED
// ═══════════════════════════════════════════════════════════════════════════
newPage();
header('1. Getting Started');

subheader('How to Login');
step(1, 'Open Chrome (Android) or Safari (iPhone)');
step(2, 'Type: oakit.silveroakjuniors.in');
step(3, 'Enter School Code: soj');
step(4, 'Enter your Mobile Number (10 digits)');
step(5, 'Enter Password (default = your mobile number)');
step(6, 'Tap Login');

doc.moveDown(0.3);
subheader('Save as App (Add to Home Screen)');
para('Once logged in, save the app to your home screen so it works like a native app:');
bullet('Android: Tap 3-dot menu (top-right) > "Add to Home screen" > "Add"');
bullet('iPhone/iPad: Tap Share button (bottom) > "Add to Home Screen" > "Add"');
doc.moveDown(0.3);
tipBox('After saving to home screen, you can open Oakit directly from your phone like any other app.');

checkSpace(100);
subheader('App Navigation');
para('The app has 3 main sections accessible from the bottom navigation bar:');
bullet('Plan - Your daily lesson plan with topics and completion tracking');
bullet('Oakie - AI chat assistant for teaching help and questions');
bullet('Help - Quick links to all features (Attendance, Homework, Journey, Calendar, etc.)');
doc.moveDown(0.3);
para('Header icons (top-right):');
bullet('Calendar icon - View monthly calendar with holidays');
bullet('Chart icon - Class Performance dashboard');
bullet('Streak flame - Your teaching consistency streak');

drawPageFooter();

// ═══════════════════════════════════════════════════════════════════════════
// 2. DAILY PLAN
// ═══════════════════════════════════════════════════════════════════════════
newPage();
header('2. Daily Plan');

para('Every day, Oakie prepares a lesson plan based on your curriculum. The Plan tab shows what to teach today.');

subheader('What You See');
bullet('Today\'s date and day name');
bullet('Topics to cover (from your textbook curriculum)');
bullet('Activity suggestions for each topic');
bullet('Checkboxes to mark topics as covered');
bullet('Pending work from previous days (if any)');

doc.moveDown(0.3);
subheader('Marking Completion');
step(1, 'Review the topics listed for today');
step(2, 'Teach your class as planned');
step(3, 'Tick the checkboxes for topics you covered');
step(4, 'Tap "Mark as Done" to complete the day');
doc.moveDown(0.3);
warnBox('You can only mark completion for today or past days (up to 7 days back). Future dates cannot be marked.');

checkSpace(80);
subheader('Raw Plan & Week Plan');
bullet('Raw Plan - View the full AI-generated plan text with all details');
bullet('Week Plan - See the entire week at a glance, download as PDF');
bullet('Record Session - Log what was actually covered during class');

tipBox('If you miss a day, it shows as "Pending Work" the next day. You can complete it within 7 days.');

drawPageFooter();

// ═══════════════════════════════════════════════════════════════════════════
// 3. OAKIE AI CHAT
// ═══════════════════════════════════════════════════════════════════════════
newPage();
header('3. Oakie AI Chat');

para('Oakie is your AI teaching assistant. Ask anything about your curriculum, classroom management, or teaching strategies.');

subheader('What Oakie Can Help With');
bullet('Explain today\'s curriculum topics in simple terms');
bullet('Suggest activities, games, and songs for any subject');
bullet('Help with classroom management (crying child, misbehavior, shy students)');
bullet('Provide age-appropriate teaching strategies');
bullet('Answer questions about your textbook content');
bullet('Give tips for circle time, English speaking, math, art, etc.');

doc.moveDown(0.3);
subheader('How to Ask');
para('Type naturally in the chat box or use the mic button to speak:');
bullet('"What activities can I do for counting today?"');
bullet('"How to handle a child who won\'t stop crying?"');
bullet('"Explain today\'s English topic in simple words"');
bullet('"Give me a rhyme for the letter B"');
bullet('"What should I do if a child finishes early?"');

doc.moveDown(0.3);
warnBox('Oakie answers based on your curriculum. Complete the day\'s plan to unlock more questions (limit: 5 before completion).');

drawPageFooter();

// ═══════════════════════════════════════════════════════════════════════════
// 4. ATTENDANCE
// ═══════════════════════════════════════════════════════════════════════════
newPage();
header('4. Attendance');

para('Mark attendance every morning. Parents are notified automatically.');

subheader('How to Mark');
step(1, 'Go to Help tab > Attendance (or tap the attendance prompt)');
step(2, 'You see all students in your section listed');
step(3, 'Tap Present (green) or Absent (red) for each student');
step(4, 'Tap "Submit Attendance"');

doc.moveDown(0.3);
subheader('Rules');
bullet('Mark within 30 minutes of school start time');
bullet('Once marked Present, cannot be changed to Absent');
bullet('Late arrivals: mark absent first, then update to present when they arrive');
bullet('Cannot mark attendance on weekends or holidays');
bullet('If you mark late (>90 min after school start), a warning is shown');

doc.moveDown(0.3);
tipBox('The principal can see what time you marked attendance. Mark it early to show consistency.');

drawPageFooter();

// ═══════════════════════════════════════════════════════════════════════════
// 5. HOMEWORK & NOTES
// ═══════════════════════════════════════════════════════════════════════════
newPage();
header('5. Homework & Notes');

subheader('Sending Homework');
step(1, 'Go to Help > Homework & Notes');
step(2, 'Type homework in the text box (or use mic to dictate)');
step(3, 'Tap "Ask Oakie to format" for a parent-friendly version');
step(4, 'Tap "Send Homework to Parents"');
doc.moveDown(0.3);
bullet('Homework is sent to ALL parents in your section');
bullet('You can update and resend if needed');
bullet('Cannot send on weekends or holidays');

checkSpace(100);
subheader('Tracking Homework Completion');
bullet('Switch to the "Tracking" tab');
bullet('Mark each student as: Completed / Partial / Not Submitted');
bullet('This helps you follow up with parents');

checkSpace(100);
subheader('Class Notes');
bullet('Switch to the "Class Notes" tab');
bullet('Select a subject and date');
bullet('Type your note or attach a file (PDF, worksheet)');
bullet('Notes are sent to all parents and auto-delete after 14 days');

tipBox('Use the mic button to dictate notes quickly instead of typing.');

drawPageFooter();

// ═══════════════════════════════════════════════════════════════════════════
// 6. CHILD JOURNEY
// ═══════════════════════════════════════════════════════════════════════════
newPage();
header('6. Child Journey');

para('Send personalized daily updates about each child to their parents.');

subheader('Individual Notes');
bullet('Go to Help > Child Journey');
bullet('Write a note for each student in the text box');
bullet('Use "Ask Oakie" to beautify the text');
bullet('Choose entry type: Daily / Weekly / Highlight');
bullet('Save Only (visible in history) or Save & Send (notifies parents)');

doc.moveDown(0.3);
subheader('Generic Class Note');
bullet('Write one note that applies to the whole class');
bullet('It gets saved for every student individually');
bullet('Use "Save & Send All" to notify all parents at once');

checkSpace(80);
subheader('History Tab');
bullet('View all past entries grouped by date');
bullet('Filter by date or student');
bullet('Edit or delete entries');
bullet('Send unsent entries to parents individually or all at once');

tipBox('Parents love receiving daily updates. Even a short "Had a great day!" makes a difference.');

drawPageFooter();

// ═══════════════════════════════════════════════════════════════════════════
// 7-8. REPORTS + CALENDAR
// ═══════════════════════════════════════════════════════════════════════════
newPage();
header('7. Report Cards & Observations');

subheader('Observations (Report Readiness)');
bullet('Go to Help > Child Journey > Report Readiness tab');
bullet('Add observations for each student across categories:');
bullet('Cognitive, Language, Social, Emotional, Motor Skills, Creativity, Participation, Peer, Behavior', 15);
bullet('These observations are used to generate term report cards');
bullet('The system alerts you if students are missing observations');

doc.moveDown(0.3);
subheader('Report Cards');
bullet('Go to Help > Report Cards');
bullet('Select a student and date range');
bullet('The system generates a progress report based on observations');
bullet('Reports can be shared with parents');

checkSpace(150);
header('8. Calendar');

para('View your school\'s academic calendar with holidays and special days.');

subheader('What You See');
bullet('Monthly calendar view with color-coded days');
bullet('Green = completed, Amber = missed, Red = holiday, Blue = special day');
bullet('Tap any day to see details (holiday name, plan status, topics)');

doc.moveDown(0.3);
subheader('Upcoming Events');
bullet('Below the calendar, see upcoming holidays and special days');
bullet('Plan ahead for settling periods and special activities');

drawPageFooter();

// ═══════════════════════════════════════════════════════════════════════════
// 9-10. CLASS PERFORMANCE + STUDENTS
// ═══════════════════════════════════════════════════════════════════════════
newPage();
header('9. Class Performance');

para('Visual dashboard showing how your class is doing.');

subheader('What You See');
bullet('Student count, Attendance %, Curriculum Coverage %, Plans Completed');
bullet('Daily timing graph (when you mark attendance and complete plans)');
bullet('Parent engagement (active, inactive, never logged in)');
bullet('Comments sent to parents in the last 30 days');
bullet('School comparison (your class vs other sections)');
bullet('Low attendance students (below 70%)');
bullet('Students without journal entries in 14 days');
bullet('Upcoming birthdays');

checkSpace(150);
header('10. Students & Milestones');

subheader('Student Profiles');
bullet('Go to Help > Students');
bullet('View all students in your section');
bullet('See parent contact details');
bullet('Track individual milestones');

doc.moveDown(0.3);
subheader('Milestones');
bullet('Record developmental milestones for each child');
bullet('Categories: Physical, Cognitive, Language, Social, Self-help');
bullet('Parents can view milestones in their portal');

drawPageFooter();

// ═══════════════════════════════════════════════════════════════════════════
// 11-13. FEED + HR + RULES
// ═══════════════════════════════════════════════════════════════════════════
newPage();
header('11. Class Feed');

bullet('Go to Help > Class Feed');
bullet('Post photos and updates from class activities');
bullet('Parents see these in their daily feed');
bullet('Great for sharing art work, group activities, celebrations');

checkSpace(100);
header('12. My HR');

bullet('Go to Help > My HR');
bullet('View your salary slips');
bullet('Apply for leave');
bullet('View offer letter and other HR documents');

checkSpace(200);
header('13. Important Rules');

doc.moveDown(0.3);
subheader('Do\'s');
bullet('Mark attendance every day before 10:00 AM');
bullet('Complete the day\'s plan before leaving school');
bullet('Send at least one child journey note per week per student');
bullet('Use Oakie for teaching help - it learns your curriculum');
bullet('Keep your password secure and change it from the default');
bullet('Check the calendar for upcoming holidays and plan accordingly');

doc.moveDown(0.5);
subheader('Don\'ts');
bullet('Do not send homework on weekends or holidays');
bullet('Do not share your login with anyone');
bullet('Do not mark attendance for future dates');
bullet('Do not use negative language in child journey notes');
bullet('Do not skip marking completion - it affects your streak and reports');

doc.moveDown(0.5);
warnBox('Your principal can see your attendance timing, plan completion rate, and teaching streak. Consistency is tracked and visible.');

drawPageFooter();

// ═══════════════════════════════════════════════════════════════════════════
doc.end();
console.log(`Teacher handout generated: ${OUTPUT}`);
console.log(`Pages: ${pageNum}`);
