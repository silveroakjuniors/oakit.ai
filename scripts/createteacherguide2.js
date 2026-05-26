/**
 * OAKIT.ai - Teacher Guide PDF Generator
 * Production Ready Version
 *
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
  margins: {
    top: 60,
    bottom: 50,
    left: 50,
    right: 50,
  },
  bufferPages: true,
  autoFirstPage: true,
});

doc.pipe(fs.createWriteStream(OUTPUT));

const W = doc.page.width;
const H = doc.page.height;
const M = 50;
const CW = W - 100;

const GREEN = '#1B4332';
const YELLOW = '#E8960C';
const DARK = '#111827';
const GRAY = '#6b7280';

// ═══════════════════════════════════════════
// SAFE PAGE FLOW
// ═══════════════════════════════════════════

function ensureSpace(height = 100) {
  const limit = H - 90;

  if (doc.y + height > limit) {
    doc.addPage();
  }
}

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

function title(text) {
  ensureSpace(80);

  doc.moveDown(1);

  doc
    .fillColor(GREEN)
    .font('Helvetica-Bold')
    .fontSize(16)
    .text(text, M);

  doc
    .moveTo(M, doc.y + 4)
    .lineTo(M + 60, doc.y + 4)
    .lineWidth(2)
    .stroke(YELLOW);

  doc.moveDown(0.8);
}

function sub(text) {
  ensureSpace(40);

  doc
    .fillColor(GREEN)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(text, M);

  doc.moveDown(0.4);
}

function para(text) {
  ensureSpace(60);

  doc
    .fillColor(DARK)
    .font('Helvetica')
    .fontSize(9.5)
    .text(text, M, doc.y, {
      width: CW,
      lineGap: 3,
    });

  doc.moveDown(0.5);
}

function bullet(text) {
  ensureSpace(30);

  doc
    .fillColor(DARK)
    .font('Helvetica')
    .fontSize(9.5)
    .text('• ' + text, M + 8, doc.y, {
      width: CW - 10,
      lineGap: 2,
    });

  doc.moveDown(0.25);
}

function step(number, title, desc) {
  ensureSpace(45);

  doc
    .fillColor(GREEN)
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .text(`${number}. ${title}`, M + 5, doc.y);

  if (desc) {
    doc
      .fillColor(GRAY)
      .font('Helvetica')
      .fontSize(8.5)
      .text(desc, M + 18, doc.y, {
        width: CW - 20,
        lineGap: 2,
      });
  }

  doc.moveDown(0.4);
}

function tip(text) {
  ensureSpace(40);

  doc
    .fillColor('#065f46')
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .text('TIP: ', M + 5, doc.y, {
      continued: true,
    });

  doc
    .font('Helvetica')
    .text(text, {
      width: CW - 20,
    });

  doc.moveDown(0.5);
}

function important(text) {
  ensureSpace(40);

  doc
    .fillColor('#92400e')
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .text('IMPORTANT: ', M + 5, doc.y, {
      continued: true,
    });

  doc
    .font('Helvetica')
    .text(text, {
      width: CW - 20,
    });

  doc.moveDown(0.5);
}

function flow(titleText, steps) {
  ensureSpace(140);

  doc.moveDown(0.5);

  doc
    .roundedRect(M, doc.y, CW, 85, 8)
    .fillAndStroke('#f8fafc', '#d1d5db');

  const startY = doc.y + 10;

  doc
    .fillColor(GREEN)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(titleText, M + 15, startY);

  let currentX = M + 20;
  const flowY = startY + 28;

  steps.forEach((s, index) => {
    doc
      .roundedRect(currentX, flowY, 90, 24, 5)
      .fillAndStroke('#dcfce7', '#86efac');

    doc
      .fillColor(GREEN)
      .font('Helvetica-Bold')
      .fontSize(7)
      .text(s, currentX, flowY + 8, {
        width: 90,
        align: 'center',
      });

    if (index < steps.length - 1) {
      doc
        .moveTo(currentX + 90, flowY + 12)
        .lineTo(currentX + 105, flowY + 12)
        .stroke('#9ca3af');

      currentX += 105;
    }
  });

  doc.y += 95;
}

function featureCard(icon, titleText, desc) {
  ensureSpace(70);

  const y = doc.y;

  doc
    .roundedRect(M, y, CW, 55, 8)
    .fillAndStroke('#ffffff', '#e5e7eb');

  doc
    .fontSize(20)
    .fillColor(GREEN)
    .text(icon, M + 15, y + 12);

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(GREEN)
    .text(titleText, M + 55, y + 12);

  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor(DARK)
    .text(desc, M + 55, y + 28, {
      width: CW - 70,
    });

  doc.y += 70;
}

// ═══════════════════════════════════════════
// COVER PAGE
// ═══════════════════════════════════════════

doc.rect(0, 0, W, 8).fill(GREEN);

doc.y = 120;

doc
  .fillColor(GREEN)
  .font('Helvetica-Bold')
  .fontSize(36)
  .text('OAKIT', 0, doc.y, {
    width: W,
    align: 'center',
    continued: true,
  });

doc.fillColor(YELLOW).text('.ai');

doc.moveDown(0.5);

doc
  .fillColor(GRAY)
  .font('Helvetica')
  .fontSize(13)
  .text('Powered by Oakie AI Mentor', {
    align: 'center',
  });

try {
  if (fs.existsSync(OAKIE)) {
    doc.image(OAKIE, (W - 120) / 2, doc.y + 25, {
      width: 120,
    });
  }
} catch (e) {}

doc.y += 190;

doc
  .fillColor(GREEN)
  .font('Helvetica-Bold')
  .fontSize(24)
  .text('Teacher Guide', {
    align: 'center',
  });

doc.moveDown(0.5);

doc
  .fillColor(GRAY)
  .font('Helvetica')
  .fontSize(10)
  .text('Complete onboarding guide for teachers using OAKIT.ai', {
    align: 'center',
  });

// ═══════════════════════════════════════════
// PAGE 2
// ═══════════════════════════════════════════

doc.addPage();

title('Welcome to OAKIT.ai');

para('OAKIT.ai is designed to simplify classroom operations, help teachers save time, improve parent communication, and support better student learning experiences.');

flow('Daily Teacher Workflow', [
  'Attendance',
  'Lesson Plan',
  'Teaching',
  'Updates',
]);

featureCard('📅', 'Daily Plan', 'AI-powered lesson planning and activity guidance for teachers.');

featureCard('🤖', 'Ask Oakie', 'Get instant teaching support, ideas, songs, rhymes, and activity suggestions.');

featureCard('👨‍👩‍👧', 'Parent Communication', 'Send homework, notes, and updates professionally.');

// ═══════════════════════════════════════════
// LOGIN SECTION
// ═══════════════════════════════════════════

title('Getting Started');

sub('Login Process');

step(1, 'Open Browser', 'Use Chrome or Safari');
step(2, 'Visit Platform', 'Open oakit.silveroakjuniors.in');
step(3, 'Enter Mobile Number', 'Use your registered number');
step(4, 'Enter Temporary Password', 'Temporary password is your mobile number');
step(5, 'Create New Password', 'Required during first login');

important('On your first login, you will be required to create a new secure password.');

flow('First Login Flow', [
  'Login',
  'Verify',
  'New Password',
  'Dashboard',
]);

// ═══════════════════════════════════════════
// DAILY PLAN
// ═══════════════════════════════════════════

title('Daily Plan');

para('Every day, OAKIT.ai prepares structured lesson plans aligned with your curriculum and classroom schedule.');

featureCard('📖', 'AI Lesson Plan', 'View activities, topics, and classroom guidance generated automatically.');

sub('Daily Flow');

step(1, 'Open Plan Tab');
step(2, 'Review Activities');
step(3, 'Teach the Session');
step(4, 'Mark Completion');

flow('Daily Plan Flow', [
  'Open Plan',
  'Teach',
  'Complete',
  'Submit',
]);

// ═══════════════════════════════════════════
// OAKIE CHAT
// ═══════════════════════════════════════════

title('Ask Oakie');

para('Oakie is your AI mentor designed to help teachers with classroom activities, child engagement, communication, and lesson execution.');

featureCard('💡', 'Teaching Support', 'Ask for games, rhymes, explanations, sensory activities, and teaching ideas.');

bullet('Activity ideas');
bullet('Songs and rhymes');
bullet('Classroom management');
bullet('Child engagement support');

flow('Using Oakie', [
  'Ask',
  'AI Response',
  'Use in Class',
]);

// ═══════════════════════════════════════════
// ATTENDANCE
// ═══════════════════════════════════════════

title('Attendance');

para('Attendance helps schools maintain daily records and automatically notify parents.');

featureCard('✅', 'Attendance Tracking', 'Mark student attendance quickly and accurately.');

step(1, 'Open Attendance');
step(2, 'Mark Present/Absent');
step(3, 'Submit Attendance');

flow('Attendance Flow', [
  'Open',
  'Mark',
  'Submit',
  'Notify Parents',
]);

// ═══════════════════════════════════════════
// HOMEWORK
// ═══════════════════════════════════════════

title('Homework & Notes');

featureCard('📝', 'Homework System', 'Create and send structured homework updates to parents.');

bullet('Voice typing support');
bullet('AI formatting');
bullet('Parent-friendly communication');
bullet('Homework tracking');

flow('Homework Flow', [
  'Create',
  'Format',
  'Send',
]);

// ═══════════════════════════════════════════
// CHILD JOURNEY
// ═══════════════════════════════════════════

title('Child Journey');

para('Child Journey helps teachers document and share student growth with parents.');

featureCard('🌱', 'Growth Tracking', 'Capture student milestones, highlights, and observations.');

bullet('Daily highlights');
bullet('Milestone tracking');
bullet('Positive communication');
bullet('Parent engagement');

flow('Child Journey Flow', [
  'Observe',
  'Record',
  'Send',
]);

// ═══════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════

title('Reports & Observations');

featureCard('📊', 'Student Reports', 'Generate report cards and developmental observations.');

bullet('Language development');
bullet('Motor skills');
bullet('Social skills');
bullet('Participation');

// ═══════════════════════════════════════════
// PERFORMANCE
// ═══════════════════════════════════════════

title('Class Performance');

featureCard('📈', 'Performance Dashboard', 'Track attendance, completion, and engagement insights.');

para('Your consistency helps maintain smooth classroom operations and student progress.');

// ═══════════════════════════════════════════
// GOLDEN RULES
// ═══════════════════════════════════════════

title('Golden Rules for Great Teaching');

bullet('Every child learns differently');
bullet('Consistency builds confidence');
bullet('Learning should feel joyful');
bullet('Parent communication builds trust');
bullet('Small daily efforts create big growth');
bullet('Oakie supports teachers, not replaces them');

para('Thank you for being part of the OAKIT.ai journey and helping create meaningful learning experiences every day.');

// ═══════════════════════════════════════════
// HEADERS & FOOTERS
// ═══════════════════════════════════════════

const pages = doc.bufferedPageRange();

for (let i = 0; i < pages.count; i++) {
  doc.switchToPage(i);

  // HEADER
  if (i > 0) {
    doc.rect(0, 0, W, 36).fill(GREEN);

    doc
      .fillColor('white')
      .font('Helvetica-Bold')
      .fontSize(11)
      .text('OAKIT', M, 10, {
        continued: true,
        lineBreak: false,
      });

    doc.fillColor(YELLOW).text('.ai');

    doc
      .fillColor('#86efac')
      .font('Helvetica')
      .fontSize(7)
      .text('Oakie AI Mentor', M, 23);

    try {
      if (fs.existsSync(OAKIE)) {
        doc.image(OAKIE, W - 70, 2, {
          height: 30,
        });
      }
    } catch (e) {}
  }

  // FOOTER
  doc.rect(0, H - 22, W, 22).fill(GREEN);

  doc
    .fillColor('white')
    .font('Helvetica')
    .fontSize(7)
    .text(
      `OAKIT.ai | Oakie AI Mentor | Teacher Guide | Page ${i + 1}`,
      0,
      H - 15,
      {
        width: W,
        align: 'center',
      }
    );
}

// ═══════════════════════════════════════════
// FINALIZE
// ═══════════════════════════════════════════

doc.end();

console.log(`Generated: ${OUTPUT}`);
console.log(`Pages: ${pages.count}`);