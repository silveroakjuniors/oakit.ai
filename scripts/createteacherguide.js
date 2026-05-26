/**
 * Silver Oak Juniors - Teacher Guide PDF
 * Output: sojs_teacher_guide.pdf
 * Run: node scripts/createteacherguide.js
 */
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUTPUT = path.join(__dirname, '../sojs_teacher_guide.pdf');
const OAKIE = path.join(__dirname, '../apps/frontend/public/oakie.png');

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 55, bottom: 45, left: 50, right: 50 },
  bufferPages: true, // Buffer all pages so we can add headers/footers at the end
});
doc.pipe(fs.createWriteStream(OUTPUT));

const W = doc.page.width;
const H = doc.page.height;
const M = 50;
const CW = W - 100;
const GREEN = '#1B4332';
const YELLOW = '#E8960C';

// ── Helper functions (content only, no page management) ──
function title(t) {
  doc.moveDown(0.8);
  doc.fillColor(GREEN).fontSize(15).font('Helvetica-Bold').text(t, M);
  doc.moveTo(M, doc.y + 2).lineTo(M + 50, doc.y + 2).lineWidth(2).stroke(YELLOW);
  doc.moveDown(0.5);
}
function sub(t) { doc.moveDown(0.3); doc.fillColor(GREEN).fontSize(11).font('Helvetica-Bold').text(t, M, doc.y, { width: CW }); doc.moveDown(0.2); }
function p(t) { doc.fillColor('#111827').fontSize(9.5).font('Helvetica').text(t, M, doc.y, { width: CW, lineGap: 2 }); doc.moveDown(0.3); }
function b(t) { doc.fillColor('#111827').fontSize(9).font('Helvetica').text('  \u2022  ' + t, M + 5, doc.y, { width: CW - 10, lineGap: 1 }); doc.moveDown(0.1); }
function step(n, t, d) { doc.fillColor(GREEN).fontSize(9.5).font('Helvetica-Bold').text(`${n}. ${t}`, M + 5, doc.y); if (d) doc.fillColor('#4b5563').fontSize(8.5).font('Helvetica').text(`    ${d}`, M + 5, doc.y, { width: CW - 10 }); doc.moveDown(0.2); }
function tip(t) { doc.moveDown(0.2); doc.fillColor('#065f46').fontSize(8.5).font('Helvetica-Bold').text('Tip: ', M + 5, doc.y, { continued: true }); doc.font('Helvetica').text(t, { width: CW - 15 }); doc.moveDown(0.3); }
function warn(t) { doc.moveDown(0.2); doc.fillColor('#92400e').fontSize(8.5).font('Helvetica-Bold').text('Important: ', M + 5, doc.y, { continued: true }); doc.font('Helvetica').text(t, { width: CW - 15 }); doc.moveDown(0.3); }
function gap() { doc.moveDown(0.3); }
function pageBreak() { doc.addPage(); }

// ══════════════════════════════════════════════════════════════════════════
// COVER PAGE
// ══════════════════════════════════════════════════════════════════════════
doc.rect(0, 0, W, 6).fill(GREEN);
doc.y = 120;
doc.fillColor(GREEN).fontSize(34).font('Helvetica-Bold').text('oakit', 0, doc.y, { width: W, align: 'center', continued: true });
doc.fillColor(YELLOW).text('.ai');
doc.moveDown(0.4);
doc.fillColor('#6b7280').fontSize(12).font('Helvetica').text("Silver Oak Junior's AI Mentor", 0, doc.y, { width: W, align: 'center' });
doc.moveDown(2.5);
try { if (fs.existsSync(OAKIE)) doc.image(OAKIE, (W - 110) / 2, doc.y, { width: 110 }); } catch {}
doc.y += 120;
doc.moveDown(2);
doc.fillColor(GREEN).fontSize(22).font('Helvetica-Bold').text('Teacher Guide', 0, doc.y, { width: W, align: 'center' });
doc.moveDown(0.5);
doc.fillColor('#6b7280').fontSize(10).font('Helvetica').text('Complete guide to using Oakit.ai in your classroom', 0, doc.y, { width: W, align: 'center' });
doc.moveDown(4);
doc.fillColor('#9ca3af').fontSize(8).font('Helvetica').text('Silver Oak Juniors  |  AI-Integrated Preschool\noakit.silveroakjuniors.in  |  School Code: soj', 0, doc.y, { width: W, align: 'center' });

// ══════════════════════════════════════════════════════════════════════════
// TABLE OF CONTENTS
// ══════════════════════════════════════════════════════════════════════════
pageBreak();
title('Table of Contents');
gap();
const toc = ['1. App Overview & Daily Workflow', '2. Getting Started', '3. Daily Plan & Completion',
  '4. Oakie AI Chat', '5. Attendance', '6. Homework & Notes', '7. Child Journey',
  '8. Report Cards & Observations', '9. Calendar', '10. Class Performance',
  '11. Students & Milestones', '12. Class Feed & My HR', '13. Important Rules'];
toc.forEach(t => { doc.fillColor('#111827').fontSize(10).font('Helvetica-Bold').text(t, M + 10, doc.y); doc.moveDown(0.45); });

// ══════════════════════════════════════════════════════════════════════════
// 1. APP OVERVIEW
// ══════════════════════════════════════════════════════════════════════════
pageBreak();
title('1. App Overview');
p('Oakit helps you manage your entire teaching day:');
gap();
sub('What You Can Do');
b('View Daily Plans - AI-generated lesson plans for each day');
b('Ask Oakie (AI Chat) - Teaching tips, activity ideas, classroom help');
b('Mark Attendance - One-tap daily attendance');
b('Send Homework & Notes - Format and send to all parents');
b('Child Journey - Personalized daily notes per student');
b('Class Performance - Visual stats and insights dashboard');
b('Calendar - View holidays and special days');
b('Report Cards - Generate term progress reports');
b('Students & Milestones - Track developmental progress');
b('Class Feed - Post photos for parents');
gap();
title('Daily Workflow');
step(1, 'Morning: Mark Attendance', 'Open app > Help > Attendance > Mark > Submit');
step(2, 'View Today\'s Plan', 'Plan tab > See topics and activities');
step(3, 'Teach Your Class', 'Use Oakie chat for help anytime');
step(4, 'End of Day: Mark Completion', 'Tick covered topics > Mark as Done');
step(5, 'Send Updates', 'Homework + Child Journey notes to parents');
gap();
tip('Complete all 5 steps daily to maintain your teaching streak.');
gap();
title('Navigation');
p('3 tabs at the bottom of the screen:');
gap();
sub('Plan Tab');
b('Today\'s lesson plan with topics and checkboxes');
b('Mark topics as covered, then Mark as Done');
b('Raw Plan (full text) and Week Plan (PDF download)');
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

// ══════════════════════════════════════════════════════════════════════════
// 2. GETTING STARTED
// ══════════════════════════════════════════════════════════════════════════
pageBreak();
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
p('Save the app so it works like a native app:');
b('Android: Tap 3-dot menu > "Add to Home screen"');
b('iPhone: Tap Share button > "Add to Home Screen"');
gap();
tip('After saving, open Oakit directly from your home screen.');
gap();
sub('Header Icons (top-right)');
b('Calendar icon - Monthly calendar with holidays');
b('Chart icon - Class Performance dashboard');
b('Flame icon - Your teaching consistency streak');

// ══════════════════════════════════════════════════════════════════════════
// 3. DAILY PLAN
// ══════════════════════════════════════════════════════════════════════════
pageBreak();
title('3. Daily Plan & Completion');
p('Every day, Oakie prepares a lesson plan based on your curriculum.');
gap();
sub('What You See');
b('Today\'s date, day name, and planned topics');
b('Activity suggestions for each topic');
b('Checkboxes to mark topics as covered');
b('Pending work from previous days');
gap();
sub('Marking Completion');
step(1, 'Review topics listed for today');
step(2, 'Teach your class as planned');
step(3, 'Tick checkboxes for topics you covered');
step(4, 'Tap "Mark as Done" to complete the day');
gap();
warn('Can only mark today or past days (up to 7 days back). Future dates blocked.');
gap();
sub('Additional Features');
b('Raw Plan - Full AI-generated plan text');
b('Week Plan - See entire week, download as PDF');
b('Record Session - Log what was actually covered');
gap();
tip('Missed days show as "Pending Work" next day. Complete within 7 days.');

// ══════════════════════════════════════════════════════════════════════════
// 4. OAKIE AI CHAT
// ══════════════════════════════════════════════════════════════════════════
pageBreak();
title('4. Oakie AI Chat');
p('Your AI teaching assistant. Ask anything about curriculum, classroom management, or teaching.');
gap();
sub('What Oakie Helps With');
b('Explain curriculum topics in simple terms');
b('Suggest activities, games, songs for any subject');
b('Classroom management (crying, misbehavior, shy students)');
b('Age-appropriate teaching strategies');
b('Textbook content questions');
b('Tips for circle time, English, math, art, etc.');
gap();
sub('Example Questions');
b('"What activities can I do for counting today?"');
b('"How to handle a child who won\'t stop crying?"');
b('"Explain today\'s English topic simply"');
b('"Give me a rhyme for the letter B"');
gap();
warn('Limit: 5 questions before marking completion. Complete the day to unlock more.');

// ══════════════════════════════════════════════════════════════════════════
// 5. ATTENDANCE
// ══════════════════════════════════════════════════════════════════════════
pageBreak();
title('5. Attendance');
p('Mark attendance every morning. Parents notified automatically.');
gap();
sub('How to Mark');
step(1, 'Help tab > Attendance');
step(2, 'All students listed');
step(3, 'Tap Present (green) or Absent (red)');
step(4, 'Tap "Submit Attendance"');
gap();
sub('Rules');
b('Mark within 30 min of school start');
b('Present cannot be changed to Absent');
b('Late arrivals: mark absent, update when they arrive');
b('Blocked on weekends and holidays');
b('Late marking (>90 min) shows warning to principal');
gap();
tip('Principal sees your attendance timing. Mark early for consistency.');

// ══════════════════════════════════════════════════════════════════════════
// 6. HOMEWORK & NOTES
// ══════════════════════════════════════════════════════════════════════════
title('6. Homework & Notes');
sub('Sending Homework');
step(1, 'Help > Homework & Notes');
step(2, 'Type or dictate homework');
step(3, '"Ask Oakie to format" for parent-friendly version');
step(4, '"Send Homework to Parents"');
gap();
b('Sent to ALL parents in your section');
b('Cannot send on weekends or holidays');
gap();
sub('Tracking');
b('"Tracking" tab - mark each student: Done / Partial / Not Submitted');
gap();
sub('Class Notes');
b('"Class Notes" tab - select subject, type note or attach file');
b('Notes auto-delete after 14 days');
gap();
tip('Use mic button to dictate quickly.');

// ══════════════════════════════════════════════════════════════════════════
// 7. CHILD JOURNEY
// ══════════════════════════════════════════════════════════════════════════
pageBreak();
title('7. Child Journey');
p('Personalized daily updates per child to parents.');
gap();
sub('Individual Notes');
b('Help > Child Journey > Write note per student');
b('"Ask Oakie" to beautify text');
b('Type: Daily / Weekly / Highlight');
b('Save Only or Save & Send');
gap();
sub('Generic Class Note');
b('One note for whole class, saved per student');
b('"Save & Send All" notifies all parents');
gap();
sub('History');
b('View past entries by date, filter by student');
b('Edit, delete, or send unsent entries');
gap();
tip('Parents love daily updates. Even "Had a great day!" helps.');

// ══════════════════════════════════════════════════════════════════════════
// 8-9. REPORTS + CALENDAR
// ══════════════════════════════════════════════════════════════════════════
title('8. Report Cards & Observations');
sub('Observations');
b('Child Journey > Report Readiness tab');
b('Categories: Cognitive, Language, Social, Emotional, Motor, Creativity, Participation, Peer, Behavior');
b('Used to generate term report cards');
gap();
sub('Report Cards');
b('Help > Report Cards > Select student + date range');
b('Auto-generated from observations');
gap();
title('9. Calendar');
b('Monthly view with color-coded days');
b('Green=completed, Amber=missed, Red=holiday, Blue=special');
b('Tap any day for details');
b('Upcoming events listed below');

// ══════════════════════════════════════════════════════════════════════════
// 10-13. REMAINING
// ══════════════════════════════════════════════════════════════════════════
pageBreak();
title('10. Class Performance');
b('Stats: Students, Attendance %, Coverage %, Plans Done');
b('Daily timing graph (attendance + completion times)');
b('Parent engagement (active/inactive/never logged in)');
b('School comparison (your class vs others)');
b('Low attendance students, missing journals, birthdays');
gap();
title('11. Students & Milestones');
b('Help > Students - View profiles, parent contacts');
b('Track milestones: Physical, Cognitive, Language, Social, Self-help');
gap();
title('12. Class Feed & My HR');
b('Class Feed: Post photos, parents see in their feed');
b('My HR: Salary slips, leave requests, offer letters');
gap();
title('13. Important Rules');
gap();
sub("Do's");
b('Mark attendance before 10:00 AM daily');
b('Complete plan before leaving school');
b('Send child journey notes weekly per student');
b('Use Oakie for help - it knows your curriculum');
b('Change password from default');
gap();
sub("Don'ts");
b('No homework on weekends/holidays');
b('Never share login credentials');
b('No future date attendance');
b('No negative language in child notes');
b('Never skip marking completion');
gap();
warn('Principal sees your timing, completion rate, and streak. Consistency is tracked.');

// ══════════════════════════════════════════════════════════════════════════
// ADD HEADERS AND FOOTERS TO ALL PAGES (using buffered pages)
// ══════════════════════════════════════════════════════════════════════════
const pages = doc.bufferedPageRange();
for (let i = 0; i < pages.count; i++) {
  doc.switchToPage(i);
  
  // Skip cover page (page 0)
  if (i > 0) {
    // Header
    doc.save();
    doc.rect(0, 0, W, 36).fill(GREEN);
    doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold').text('oakit', M, 10, { continued: true });
    doc.fillColor(YELLOW).text('.ai');
    doc.fillColor('#86efac').fontSize(7).font('Helvetica').text("Silver Oak Junior's AI Mentor", M, 23);
    try { if (fs.existsSync(OAKIE)) doc.image(OAKIE, W - 70, 2, { height: 32 }); } catch {}
    doc.restore();
  }
  
  // Footer on all pages
  doc.save();
  doc.rect(0, H - 22, W, 22).fill(GREEN);
  doc.fillColor('#ffffff').fontSize(7).font('Helvetica')
    .text(`oakit.ai  |  Silver Oak Junior's AI Mentor  |  Teacher Guide  |  Page ${i + 1}`, 0, H - 15, { width: W, align: 'center' });
  doc.restore();
}

doc.end();
console.log(`Generated: ${OUTPUT}`);
console.log(`Pages: ${pages.count}`);
