/**
 * node scripts/createteacherguide.js
 * Output: sojs_teacher_guide.pdf
 */
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const OUTPUT = path.join(__dirname, '../sojs_teacher_guide.pdf');
const OAKIE = path.join(__dirname, '../apps/frontend/public/oakie.png');
const doc = new PDFDocument({ size: 'A4', margins: { top: 55, bottom: 45, left: 50, right: 50 } });
doc.pipe(fs.createWriteStream(OUTPUT));
const W = doc.page.width, H = doc.page.height, M = 50, CW = W - 100;
let pg = 0;

function hf() {
  pg++;
  doc.save();
  doc.rect(0, 0, W, 36).fill('#1B4332');
  doc.fillColor('#fff').fontSize(11).font('Helvetica-Bold').text('oakit', M, 10, {lineBreak:false,continued:true});
  doc.fillColor('#E8960C').text('.ai',{lineBreak:false});
  doc.fillColor('#86efac').fontSize(7).font('Helvetica').text("Silver Oak Junior\u2019s AI Mentor", M, 23, {lineBreak:false});
  try{if(fs.existsSync(OAKIE))doc.image(OAKIE,W-70,2,{height:32});}catch{}
  doc.rect(0, H-22, W, 22).fill('#1B4332');
  doc.fillColor('#fff').fontSize(7).font('Helvetica').text("oakit.ai | Silver Oak Junior\u2019s AI Mentor | Teacher Guide | Page "+pg, 0, H-15, {width:W,align:'center',lineBreak:false});
  doc.restore();
  doc.x = M; doc.y = 48;
}
function np() { doc.addPage(); hf(); }
function t(s){doc.moveDown(0.6);doc.fillColor('#1B4332').fontSize(14).font('Helvetica-Bold').text(s,M);doc.moveTo(M,doc.y+2).lineTo(M+45,doc.y+2).lineWidth(2).stroke('#E8960C');doc.moveDown(0.4);}
function s(s){doc.moveDown(0.2);doc.fillColor('#1B4332').fontSize(10.5).font('Helvetica-Bold').text(s,M,doc.y,{width:CW});doc.moveDown(0.15);}
function p(s){doc.fillColor('#111').fontSize(9).font('Helvetica').text(s,M,doc.y,{width:CW,lineGap:2});doc.moveDown(0.25);}
function b(s){doc.fillColor('#111').fontSize(8.5).font('Helvetica').text('\u2022 '+s,M+8,doc.y,{width:CW-12,lineGap:1});doc.moveDown(0.08);}
function st(n,tt,d){doc.fillColor('#1B4332').fontSize(9).font('Helvetica-Bold').text(n+'. '+tt,M+3,doc.y);if(d)doc.fillColor('#4b5563').fontSize(8).font('Helvetica').text('   '+d,M+3,doc.y,{width:CW-8});doc.moveDown(0.15);}

// ═══ COVER ═══
doc.rect(0,0,W,6).fill('#1B4332');
doc.y=110;
doc.fillColor('#1B4332').fontSize(32).font('Helvetica-Bold').text('oakit',0,doc.y,{width:W,align:'center',continued:true});
doc.fillColor('#E8960C').text('.ai');
doc.moveDown(0.3);
doc.fillColor('#6b7280').fontSize(11).font('Helvetica').text("Silver Oak Junior\u2019s AI Mentor",0,doc.y,{width:W,align:'center'});
doc.moveDown(2);
try{if(fs.existsSync(OAKIE))doc.image(OAKIE,(W-100)/2,doc.y,{width:100});}catch{}
doc.y+=115;
doc.moveDown(1.5);
doc.fillColor('#1B4332').fontSize(20).font('Helvetica-Bold').text('Teacher Guide',0,doc.y,{width:W,align:'center'});
doc.moveDown(0.4);
doc.fillColor('#6b7280').fontSize(9.5).font('Helvetica').text('Complete guide to using Oakit.ai in your classroom',0,doc.y,{width:W,align:'center'});
doc.moveDown(3);
doc.fillColor('#9ca3af').fontSize(8).font('Helvetica').text('Silver Oak Juniors | AI-Integrated Preschool\noakit.silveroakjuniors.in | School Code: soj',0,doc.y,{width:W,align:'center'});

// ═══ TOC ═══
np();
t('Table of Contents');
['1. App Overview & Daily Workflow','2. Getting Started','3. Daily Plan','4. Oakie AI Chat','5. Attendance','6. Homework & Notes','7. Child Journey','8. Reports & Calendar','9. Class Performance','10. Students, Feed, HR & Rules'].forEach(x=>{doc.fillColor('#111').fontSize(9.5).font('Helvetica-Bold').text(x,M+8,doc.y);doc.moveDown(0.4);});

// ═══ 1. OVERVIEW ═══
np();
t('1. App Overview');
p('Oakit is your AI-powered teaching platform. Here is what you can do:');
doc.moveDown(0.2);
s('Features');
b('View Daily Plans - AI-generated lesson plans for each day');
b('Ask Oakie (AI Chat) - Teaching tips, activity ideas, classroom help');
b('Mark Attendance - One-tap daily attendance');
b('Send Homework & Notes - Format and send to all parents');
b('Child Journey - Personalized daily notes per student');
b('Class Performance - Visual stats and insights');
b('Calendar - Holidays and special days');
b('Report Cards - Term progress reports');
b('Students & Milestones - Track development');
b('Class Feed - Post photos for parents');
b('My HR - Salary, leave, documents');
doc.moveDown(0.4);
t('Daily Workflow');
st(1,'Morning: Mark Attendance','Help > Attendance > Mark > Submit');
st(2,'View Plan','Plan tab > See topics and activities');
st(3,'Teach','Use Oakie chat for help anytime');
st(4,'Mark Completion','Tick topics > Mark as Done');
st(5,'Send Updates','Homework + Child Journey to parents');
doc.moveDown(0.3);
doc.fillColor('#065f46').fontSize(8).font('Helvetica-Bold').text('Tip: Complete all 5 steps daily to maintain your streak.',M+5,doc.y);
doc.moveDown(0.5);
t('Navigation (3 Tabs)');
s('Plan Tab');
b('Today\'s lesson plan with topic checkboxes');
b('Mark as Done when finished');
b('Raw Plan (full text) | Week Plan (PDF)');
doc.moveDown(0.2);
s('Oakie Tab (Chat)');
b('Ask any teaching question');
b('Activity ideas, classroom tips');
b('Mic button to speak');
doc.moveDown(0.2);
s('Help Tab (Quick Links)');
b('Attendance | Homework | Child Journey | Report Cards');
b('Calendar | Class Performance | Students | Feed | HR');

// ═══ 2. GETTING STARTED ═══
np();
t('2. Getting Started');
s('Login Steps');
st(1,'Open Chrome (Android) or Safari (iPhone)');
st(2,'Go to: oakit.silveroakjuniors.in');
st(3,'School Code: soj');
st(4,'Enter Mobile Number (10 digits)');
st(5,'Password (default = mobile number)');
st(6,'Tap Login');
doc.moveDown(0.3);
s('Save to Home Screen');
b('Android: 3-dot menu > Add to Home screen');
b('iPhone: Share > Add to Home Screen');
doc.moveDown(0.2);
s('Header Icons');
b('Calendar - Monthly holidays view');
b('Chart - Class Performance');
b('Flame - Teaching streak');

// ═══ 3. DAILY PLAN ═══
t('3. Daily Plan & Completion');
p('Oakie prepares daily plans from your curriculum.');
s('What You See');
b('Topics to cover with activity suggestions');
b('Checkboxes to mark covered');
b('Pending work from missed days');
s('How to Complete');
st(1,'Review topics');
st(2,'Teach class');
st(3,'Tick covered topics');
st(4,'Mark as Done');
doc.moveDown(0.2);
doc.fillColor('#92400e').fontSize(8).font('Helvetica-Bold').text('Note: Only today or past 7 days. Future dates blocked.',M+5,doc.y);

// ═══ 4. OAKIE ═══
np();
t('4. Oakie AI Chat');
p('Your AI teaching assistant. Ask anything about curriculum or classroom.');
s('Oakie Helps With');
b('Explain topics simply');
b('Suggest activities, games, songs');
b('Classroom management (crying, shy, misbehavior)');
b('Age-appropriate strategies');
b('Textbook content questions');
s('Example Questions');
b('"What activities for counting today?"');
b('"How to handle a crying child?"');
b('"Explain today\'s English topic"');
b('"Rhyme for letter B?"');
doc.moveDown(0.2);
doc.fillColor('#92400e').fontSize(8).font('Helvetica-Bold').text('Note: 5 question limit before completion. Mark done to unlock more.',M+5,doc.y);

// ═══ 5. ATTENDANCE ═══
doc.moveDown(0.5);
t('5. Attendance');
s('How to Mark');
st(1,'Help > Attendance');
st(2,'Tap Present/Absent per student');
st(3,'Submit');
s('Rules');
b('Mark within 30 min of school start');
b('Present cannot change to Absent');
b('No weekends/holidays');
b('Late marking warns principal');

// ═══ 6. HOMEWORK ═══
np();
t('6. Homework & Notes');
s('Send Homework');
st(1,'Help > Homework & Notes');
st(2,'Type or dictate');
st(3,'Ask Oakie to format');
st(4,'Send to Parents');
b('Sent to ALL parents | Cannot send weekends');
s('Tracking');
b('Tracking tab: Mark Done/Partial/Not Submitted per student');
s('Class Notes');
b('Class Notes tab: Subject + date + text/file');
b('Auto-deletes after 14 days');

// ═══ 7. CHILD JOURNEY ═══
t('7. Child Journey');
s('Individual Notes');
b('Help > Child Journey > Write per student');
b('Ask Oakie to beautify | Daily/Weekly/Highlight');
b('Save Only or Save & Send');
s('Generic Class Note');
b('One note for all students | Save & Send All');
s('History');
b('View/edit/delete past entries | Send unsent');

// ═══ 8. REPORTS + CALENDAR ═══
np();
t('8. Reports & Calendar');
s('Observations');
b('Child Journey > Report Readiness tab');
b('Categories: Cognitive, Language, Social, Emotional, Motor, Creativity, Participation, Peer, Behavior');
b('Used for term report cards');
s('Report Cards');
b('Help > Report Cards > Select student + dates');
s('Calendar');
b('Monthly view: Green=done, Amber=missed, Red=holiday, Blue=special');
b('Tap any day for details | Upcoming events below');

// ═══ 9. CLASS PERFORMANCE ═══
t('9. Class Performance');
b('Students, Attendance %, Coverage %, Plans Done');
b('Daily timing graph');
b('Parent engagement (active/inactive/never)');
b('School comparison | Low attendance | Birthdays');

// ═══ 10. REMAINING ═══
t('10. Students, Feed, HR & Rules');
s('Students & Milestones');
b('Help > Students: Profiles, contacts, milestones');
s('Class Feed');
b('Post photos from activities for parents');
s('My HR');
b('Salary slips | Leave requests | Documents');
doc.moveDown(0.3);
s("Do's");
b('Attendance before 10 AM | Complete plan daily');
b('Child journey weekly | Use Oakie | Change password');
s("Don'ts");
b('No homework weekends | No sharing login');
b('No future attendance | No negative notes | No skipping completion');
doc.moveDown(0.3);
doc.fillColor('#92400e').fontSize(8).font('Helvetica-Bold').text('Principal sees your timing, completion rate, and streak.',M+5,doc.y);

doc.end();
console.log('Generated: ' + OUTPUT);
console.log('Pages: ' + pg);
