/**
 * Silver Oak Juniors - Teacher Guide PDF Generator
 * Output: sojs_teacher_guide.pdf
 * Usage: node scripts/createteacherguide.js
 */
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUTPUT = path.join(__dirname, '../sojs_teacher_guide.pdf');
const OAKIE = path.join(__dirname, '../apps/frontend/public/oakie.png');

const C = { pri: '#1B4332', acc: '#E8960C', blue: '#1e40af', vio: '#5b21b6', gray: '#4b5563', muted: '#6b7280', text: '#111827', light: '#f3f4f6' };
const doc = new PDFDocument({ size: 'A4', margins: { top: 60, bottom: 60, left: 50, right: 50 } });
doc.pipe(fs.createWriteStream(OUTPUT));
const W = doc.page.width, H = doc.page.height, M = 50, CW = W - 100;
let pg = 0;

function pageHeader() {
  doc.rect(0, 0, W, 36).fill(C.pri);
  doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold').text('oakit', M, 10, { continued: true });
  doc.fillColor(C.acc).text('.ai');
  doc.fillColor('#86efac').fontSize(7).font('Helvetica').text("Silver Oak Junior's AI Mentor", M, 22);
  try { if (fs.existsSync(OAKIE)) doc.image(OAKIE, W - 70, 2, { height: 32 }); } catch {}
}

function pageFooter() {
  doc.rect(0, H - 22, W, 22).fill(C.pri);
  doc.fillColor('#ffffff').fontSize(7).font('Helvetica')
    .text(`oakit.ai  |  Silver Oak Junior's AI Mentor  |  Teacher Guide  |  Page ${pg}`, 0, H - 16, { width: W, align: 'center' });
}

function startPage() {
  if (pg > 0) { pageFooter(); doc.addPage(); }
  pg++;
  pageHeader();
  doc.y = 48;
}

function need(h) {
  if (doc.y + h > H - 70) { startPage(); }
}

function title(t) { need(30); doc.fillColor(C.pri).fontSize(15).font('Helvetica-Bold').text(t, M); doc.moveTo(M, doc.y + 2).lineTo(M + 50, doc.y + 2).lineWidth(2).stroke(C.acc); doc.y += 8; }
function sub(t) { need(20); doc.fillColor(C.pri).fontSize(11).font('Helvetica-Bold').text(t, M, doc.y, { width: CW }); doc.moveDown(0.2); }
function p(t) { need(15); doc.fillColor(C.text).fontSize(9).font('Helvetica').text(t, M, doc.y, { width: CW, lineGap: 2 }); doc.moveDown(0.3); }
function b(t) { need(12); doc.fillColor(C.text).fontSize(9).font('Helvetica').text('\u2022  ' + t, M + 10, doc.y, { width: CW - 15, lineGap: 1 }); doc.moveDown(0.1); }
function step(n, t, d) { need(22); doc.fillColor(C.pri).fontSize(9.5).font('Helvetica-Bold').text(`${n}. ${t}`, M + 5, doc.y); if (d) { doc.fillColor(C.gray).fontSize(8).font('Helvetica').text(`   ${d}`, M + 5, doc.y, { width: CW - 10 }); } doc.moveDown(0.2); }
function tip(t) { need(20); const y = doc.y; doc.roundedRect(M, y, CW, 18, 3).fill('#ecfdf5'); doc.fillColor('#065f46').fontSize(8).font('Helvetica-Bold').text('Tip: ', M + 8, y + 4, { continued: true }); doc.font('Helvetica').text(t, { width: CW - 20 }); doc.y = y + 22; }
function warn(t) { need(20); const y = doc.y; doc.roundedRect(M, y, CW, 18, 3).fill('#fffbeb'); doc.fillColor('#92400e').fontSize(8).font('Helvetica-Bold').text('Note: ', M + 8, y + 4, { continued: true }); doc.font('Helvetica').text(t, { width: CW - 20 }); doc.y = y + 22; }
function gap() { doc.moveDown(0.4); }

// ══════════════════════════════════════════════════════════════════════════
// COVER
// ══════════════════════════════════════════════════════════════════════════
pg = 1;
doc.rect(0, 0, W, 6).fill(C.pri);
doc.y = 100;
doc.fillColor(C.pri).fontSize(32).font('Helvetica-Bold').text('oakit', M, doc.y, { width: CW, align: 'center', continued: true });
doc.fillColor(C.acc).text('.ai');
doc.moveDown(0.3);
doc.fillColor(C.muted).fontSize(11).font('Helvetica').text("Silver Oak Junior's AI Mentor", M, doc.y, { width: CW, align: 'center' });
doc.moveDown(2);
try { if (fs.existsSync(OAKIE)) doc.image(OAKIE, (W - 100) / 2, doc.y, { width: 100 }); } catch {}
doc.y += 110;
doc.moveDown(1.5);
doc.fillColor(C.pri).fontSize(20).font('Helvetica-Bold').text('Teacher Guide', M, doc.y, { width: CW, align: 'center' });
doc.moveDown(0.4);
doc.fillColor(C.muted).fontSize(10).font('Helvetica').text('Complete guide to using Oakit.ai in your classroom', M, doc.y, { width: CW, align: 'center' });
doc.moveDown(3);
doc.fillColor(C.muted).fontSize(8).font('Helvetica').text('Silver Oak Juniors  |  AI-Integrated Preschool\noakit.silveroakjuniors.in  |  School Code: soj', M, doc.y, { width: CW, align: 'center' });
pageFooter();

// ══════════════════════════════════════════════════════════════════════════
// TOC
// ══════════════════════════════════════════════════════════════════════════
startPage();
title('Table of Contents');
gap();
['1. App Overview & Daily Workflow', '2. Getting Started (Login & Navigation)', '3. Daily Plan & Completion',
 '4. Oakie AI Chat', '5. Attendance', '6. Homework & Notes', '7. Child Journey',
 '8. Report Cards & Observations', '9. Calendar', '10. Class Performance',
 '11. Students & Milestones', '12. Class Feed', '13. My HR', '14. Important Rules'].forEach(t => {
  doc.fillColor(C.text).fontSize(9.5).font('Helvetica-Bold').text(t, M + 10, doc.y); doc.moveDown(0.4);
});
pageFooter();

// ══════════════════════════════════════════════════════════════════════════
// 1. APP OVERVIEW
// ══════════════════════════════════════════════════════════════════════════
startPage();
title('1. App Overview');
p('Oakit helps you manage your entire teaching day from one app:');
gap();
[['View Daily Plans', 'AI-generated lesson plans for each day'],
 ['Ask Oakie (AI Chat)', 'Get teaching tips, activity ideas, classroom help'],
 ['Mark Attendance', 'One-tap daily attendance for your class'],
 ['Send Homework & Notes', 'Format and send updates to all parents'],
 ['Child Journey', 'Personalized daily notes for each student'],
 ['Class Performance', 'Visual dashboard with stats and insights']].forEach(([t, d]) => {
  need(16);
  doc.fillColor(C.pri).fontSize(9).font('Helvetica-Bold').text(t, M + 10, doc.y, { continued: true });
  doc.fillColor(C.muted).font('Helvetica').text(' - ' + d);
  doc.moveDown(0.2);
});

gap(); gap();
title('Your Daily Workflow');
step(1, 'Morning: Mark Attendance', 'Open app > Attendance > Mark each student > Submit');
step(2, 'View Today\'s Plan', 'Plan tab > See topics and activities for today');
step(3, 'Teach Your Class', 'Use Oakie chat for help anytime during class');
step(4, 'End of Day: Mark Completion', 'Tick covered topics > Mark as Done');
step(5, 'Send Updates to Parents', 'Homework + Child Journey notes > Send');
gap();
tip('Complete all 5 steps daily to maintain your teaching streak.');

gap(); gap();
title('Navigation Structure');
p('3 main tabs at the bottom of the screen:');
gap();
sub('Plan Tab');
b('Today\'s lesson plan with topics and checkboxes');
b('Mark topics as covered, then Mark as Done');
b('View Raw Plan (full text) or Week Plan (PDF download)');
gap();
sub('Oakie Tab (Chat)');
b('Ask any teaching question in natural language');
b('Get activity ideas, classroom tips, curriculum help');
b('Use mic button to speak instead of typing');
gap();
sub('Help Tab (Quick Links)');
b('Attendance - Mark daily attendance');
b('Homework & Notes - Send homework, class notes, attachments');
b('Child Journey - Daily highlights per student');
b('Report Cards - Generate term progress reports');
b('Calendar - View holidays and special days');
b('Class Performance - Stats dashboard');
b('Students - Profiles and milestones');
b('Class Feed - Post photos for parents');
b('My HR - Salary, leave, documents');
pageFooter();

// ══════════════════════════════════════════════════════════════════════════
// 2. GETTING STARTED
// ══════════════════════════════════════════════════════════════════════════
startPage();
title('2. Getting Started');
sub('How to Login');
step(1, 'Open Chrome (Android) or Safari (iPhone)');
step(2, 'Go to: oakit.silveroakjuniors.in');
step(3, 'Enter School Code: soj');
step(4, 'Enter your Mobile Number (10 digits)');
step(5, 'Enter Password (default = your mobile number)');
step(6, 'Tap Login');
gap();
sub('Save to Home Screen');
p('Save the app to your phone so it works like a native app:');
b('Android: Tap 3-dot menu (top-right) > "Add to Home screen"');
b('iPhone: Tap Share button (bottom) > "Add to Home Screen"');
gap();
tip('After saving, open Oakit directly from your home screen like any other app.');
gap();
sub('Header Icons');
b('Calendar icon - Monthly calendar with holidays and special days');
b('Chart icon - Class Performance dashboard');
b('Flame icon - Your teaching consistency streak');
pageFooter();

// ══════════════════════════════════════════════════════════════════════════
// 3. DAILY PLAN
// ══════════════════════════════════════════════════════════════════════════
startPage();
title('3. Daily Plan & Completion');
p('Every day, Oakie prepares a lesson plan based on your curriculum.');
gap();
sub('What You See');
b('Today\'s date, day name, and planned topics');
b('Activity suggestions for each topic');
b('Checkboxes to mark topics as covered');
b('Pending work from previous days (if any)');
gap();
sub('Marking Completion');
step(1, 'Review topics listed for today');
step(2, 'Teach your class as planned');
step(3, 'Tick checkboxes for topics you covered');
step(4, 'Tap "Mark as Done" to complete the day');
gap();
warn('You can only mark today or past days (up to 7 days back). Future dates cannot be marked.');
gap();
sub('Additional Features');
b('Raw Plan - Full AI-generated plan text with all details');
b('Week Plan - See entire week, download as PDF');
b('Record Session - Log what was actually covered');
gap();
tip('Missed days show as "Pending Work" the next day. Complete within 7 days.');
pageFooter();

// ══════════════════════════════════════════════════════════════════════════
// 4. OAKIE AI CHAT
// ══════════════════════════════════════════════════════════════════════════
startPage();
title('4. Oakie AI Chat');
p('Oakie is your AI teaching assistant. Ask anything about curriculum, classroom management, or teaching strategies.');
gap();
sub('What Oakie Can Help With');
b('Explain today\'s curriculum topics in simple terms');
b('Suggest activities, games, and songs for any subject');
b('Help with classroom management (crying child, misbehavior, shy students)');
b('Provide age-appropriate teaching strategies');
b('Answer questions about your textbook content');
b('Give tips for circle time, English speaking, math, art, etc.');
gap();
sub('Example Questions');
b('"What activities can I do for counting today?"');
b('"How to handle a child who won\'t stop crying?"');
b('"Explain today\'s English topic in simple words"');
b('"Give me a rhyme for the letter B"');
b('"What should I do if a child finishes early?"');
gap();
warn('Oakie has a limit of 5 questions before you mark completion. Complete the day to unlock more.');
pageFooter();

// ══════════════════════════════════════════════════════════════════════════
// 5. ATTENDANCE
// ══════════════════════════════════════════════════════════════════════════
startPage();
title('5. Attendance');
p('Mark attendance every morning. Parents are notified automatically.');
gap();
sub('How to Mark');
step(1, 'Go to Help tab > Attendance');
step(2, 'All students in your section are listed');
step(3, 'Tap Present (green) or Absent (red) for each');
step(4, 'Tap "Submit Attendance"');
gap();
sub('Rules');
b('Mark within 30 minutes of school start time');
b('Once marked Present, cannot be changed to Absent');
b('Late arrivals: mark absent first, update to present when they arrive');
b('Cannot mark on weekends or holidays');
b('Late marking (>90 min) shows a warning to principal');
gap();
tip('The principal sees what time you marked attendance. Mark early to show consistency.');
pageFooter();

// ══════════════════════════════════════════════════════════════════════════
// 6. HOMEWORK & NOTES
// ══════════════════════════════════════════════════════════════════════════
startPage();
title('6. Homework & Notes');
sub('Sending Homework');
step(1, 'Go to Help > Homework & Notes');
step(2, 'Type homework (or use mic to dictate)');
step(3, 'Tap "Ask Oakie to format" for parent-friendly version');
step(4, 'Tap "Send Homework to Parents"');
gap();
b('Sent to ALL parents in your section');
b('Can update and resend if needed');
b('Cannot send on weekends or holidays');
gap();
sub('Tracking Homework');
b('Switch to "Tracking" tab');
b('Mark each student: Completed / Partial / Not Submitted');
gap();
sub('Class Notes');
b('Switch to "Class Notes" tab');
b('Select subject and date');
b('Type note or attach file (PDF, worksheet)');
b('Notes auto-delete after 14 days');
gap();
tip('Use the mic button to dictate notes quickly instead of typing.');
pageFooter();

// ══════════════════════════════════════════════════════════════════════════
// 7. CHILD JOURNEY
// ══════════════════════════════════════════════════════════════════════════
startPage();
title('7. Child Journey');
p('Send personalized daily updates about each child to their parents.');
gap();
sub('Individual Notes');
b('Go to Help > Child Journey');
b('Write a note for each student');
b('Use "Ask Oakie" to beautify the text');
b('Choose type: Daily / Weekly / Highlight');
b('Save Only (history) or Save & Send (notifies parents)');
gap();
sub('Generic Class Note');
b('Write one note for the whole class');
b('Saved for every student individually');
b('"Save & Send All" notifies all parents at once');
gap();
sub('History Tab');
b('View past entries grouped by date');
b('Filter by date or student');
b('Edit, delete, or send unsent entries');
gap();
tip('Parents love daily updates. Even "Had a great day!" makes a difference.');
pageFooter();

// ══════════════════════════════════════════════════════════════════════════
// 8-9. REPORTS + CALENDAR
// ══════════════════════════════════════════════════════════════════════════
startPage();
title('8. Report Cards & Observations');
sub('Observations');
b('Go to Child Journey > Report Readiness tab');
b('Add observations per student across categories:');
b('  Cognitive, Language, Social, Emotional, Motor Skills, Creativity, Participation, Peer, Behavior');
b('Used to generate term report cards');
b('System alerts if students are missing observations');
gap();
sub('Report Cards');
b('Go to Help > Report Cards');
b('Select student and date range');
b('System generates progress report from observations');
gap(); gap();
title('9. Calendar');
p('View your school\'s academic calendar with holidays and special days.');
b('Monthly view with color-coded days');
b('Green = completed, Amber = missed, Red = holiday, Blue = special day');
b('Tap any day for details');
b('Upcoming events listed below the calendar');
pageFooter();

// ══════════════════════════════════════════════════════════════════════════
// 10-14. REMAINING SECTIONS
// ══════════════════════════════════════════════════════════════════════════
startPage();
title('10. Class Performance');
b('Visual dashboard showing class stats');
b('Student count, Attendance %, Curriculum Coverage %, Plans Completed');
b('Daily timing graph (attendance + completion times)');
b('Parent engagement (active, inactive, never logged in)');
b('School comparison (your class vs others)');
b('Low attendance students, missing journal entries, birthdays');
gap(); gap();
title('11. Class Feed');
b('Post photos and updates from class activities');
b('Parents see these in their daily feed');
b('Great for art work, group activities, celebrations');
gap(); gap();
title('12. My HR');
b('View salary slips');
b('Apply for leave');
b('View offer letter and HR documents');
gap(); gap();
title('13. Important Rules');
gap();
sub("Do's");
b('Mark attendance every day before 10:00 AM');
b('Complete the day\'s plan before leaving school');
b('Send at least one child journey note per week per student');
b('Use Oakie for teaching help - it knows your curriculum');
b('Keep your password secure, change from default');
b('Check calendar for upcoming holidays');
gap();
sub("Don'ts");
b('Do not send homework on weekends or holidays');
b('Do not share your login with anyone');
b('Do not mark attendance for future dates');
b('Do not use negative language in child journey notes');
b('Do not skip marking completion - affects your streak');
gap();
warn('Your principal sees your attendance timing, completion rate, and streak. Consistency is tracked.');
pageFooter();

// ══════════════════════════════════════════════════════════════════════════
doc.end();
console.log(`Generated: ${OUTPUT}`);
console.log(`Pages: ${pg}`);
