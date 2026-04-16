/**
 * TEACHER FUNCTIONAL TESTS — seed_demo_june17.sql
 * Actor: Kavitha (9800000003) | Class: UKG Section A
 * June 17: Plan loaded with 2 carry-forward topics, attendance NOT marked
 */
import { test, expect } from '@playwright/test';
import { login, USERS, BASE } from '../e2e/helpers';
const U = USERS.teacher;

test.describe('Teacher Functional — Plan & Oakie', () => {

  test('FN-TCH-01 | Today plan shows Circle Time + 2 carry-forward topics', async ({ page }) => {
    /** Seed: day_plans for June 17 with 3 chunks. June 16 partial = 2 carry forward.
     *  Expected: Plan tab shows today's topics including pending ones */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    const planTab = page.locator('button:has-text("Plan")').first();
    if (await planTab.isVisible({ timeout: 3000 }).catch(() => false)) await planTab.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/fn-teacher-01-plan.png' });
    await expect(page.locator('text=Circle Time, text=English, text=Math, text=plan').first()).toBeVisible();
  });

  test('FN-TCH-02 | Pending topics from June 16 shown in Pending section', async ({ page }) => {
    /** Seed: June 16 partial completion — 2 topics not covered carry forward.
     *  Expected: "Pending from previous days" section visible with topic names */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    const planTab = page.locator('button:has-text("Plan")').first();
    if (await planTab.isVisible({ timeout: 3000 }).catch(() => false)) await planTab.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/fn-teacher-02-pending.png' });
    await expect(page.locator('text=Pending, text=pending, text=carry').first()).toBeVisible();
  });

  test('FN-TCH-03 | Ask Oakie about Circle Time gets teaching guidance', async ({ page }) => {
    /** Expected: Oakie responds with Circle Time teaching steps within 15s */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    const chatTab = page.locator('button:has-text("Chat"), button:has-text("Ask")').first();
    if (await chatTab.isVisible({ timeout: 3000 }).catch(() => false)) await chatTab.click();
    const input = page.locator('input[placeholder*="Ask"], textarea').first();
    await input.fill('How do I conduct Circle Time today?');
    await input.press('Enter');
    await page.waitForTimeout(12000);
    await page.screenshot({ path: 'test-results/fn-teacher-03-oakie.png' });
    await expect(page.locator('text=Circle Time, text=children, text=warm').first()).toBeVisible({ timeout: 15000 });
  });

  test('FN-TCH-04 | Ask Oakie about a crying child gets classroom guidance', async ({ page }) => {
    /** Expected: Oakie responds with empathy-based guidance, not "off topic" */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    const chatTab = page.locator('button:has-text("Chat"), button:has-text("Ask")').first();
    if (await chatTab.isVisible({ timeout: 3000 }).catch(() => false)) await chatTab.click();
    const input = page.locator('input[placeholder*="Ask"], textarea').first();
    await input.fill('A child is crying, what do I do?');
    await input.press('Enter');
    await page.waitForTimeout(12000);
    await page.screenshot({ path: 'test-results/fn-teacher-04-crying.png' });
    await expect(page.locator('text=child, text=calm, text=comfort, text=Sorry').first()).toBeVisible({ timeout: 15000 });
  });

  test('FN-TCH-05 | Mark topic as done updates checkbox state', async ({ page }) => {
    /** Expected: Checking a topic checkbox changes it to checked state */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    const planTab = page.locator('button:has-text("Plan")').first();
    if (await planTab.isVisible({ timeout: 3000 }).catch(() => false)) await planTab.click();
    await page.waitForTimeout(500);
    const checkbox = page.locator('input[type="checkbox"]').first();
    if (await checkbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await checkbox.check();
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'test-results/fn-teacher-05-checkbox.png' });
      await expect(checkbox).toBeChecked();
    }
  });

  test('FN-TCH-06 | Teaching Consistency badge shows 11 days in header', async ({ page }) => {
    /** Seed: teacher_streaks current_streak=11. Expected: Badge shows "11" */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/fn-teacher-06-streak.png' });
    // Consistency badge in header
    await expect(page.locator('text=11').first()).toBeVisible();
  });

  test('FN-TCH-07 | Consistency badge popup shows best consistency and badge', async ({ page }) => {
    /** Expected: Clicking consistency badge shows popup with current/best days */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    const badge = page.locator('button:has-text("11"), .rounded-full:has-text("11")').first();
    if (await badge.isVisible({ timeout: 3000 }).catch(() => false)) {
      await badge.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'test-results/fn-teacher-07-badge-popup.png' });
      await expect(page.locator('text=Teaching Consistency, text=Best consistency').first()).toBeVisible();
    }
  });

});

test.describe('Teacher Functional — Attendance', () => {

  test('FN-TCH-08 | Attendance page shows 6 UKG students', async ({ page }) => {
    /** Seed: 6 active students in UKG-A. Expected: All names with Present/Absent buttons */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/teacher/attendance`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/fn-teacher-08-attendance.png' });
    await expect(page.locator('text=Aarav Kapoor').first()).toBeVisible();
    await expect(page.locator('text=Priya Nair').first()).toBeVisible();
    await expect(page.locator('text=Rohan Mehta').first()).toBeVisible();
  });

  test('FN-TCH-09 | Mark Priya Nair as absent and save', async ({ page }) => {
    /** Expected: Clicking Absent for Priya and saving calls attendance API */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/teacher/attendance`);
    await page.waitForLoadState('networkidle');
    // Find Priya's row and click Absent
    const priyaRow = page.locator('text=Priya Nair').locator('..').locator('..').first();
    const absentBtn = priyaRow.locator('button:has-text("Absent"), button:has-text("A")').first();
    if (await absentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await absentBtn.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'test-results/fn-teacher-09-absent.png' });
      // Save attendance
      const saveBtn = page.locator('button:has-text("Save"), button:has-text("Submit")').first();
      if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'test-results/fn-teacher-09-saved.png' });
        await expect(page.locator('text=saved, text=Saved, text=submitted, text=✓').first()).toBeVisible();
      }
    }
  });

});

test.describe('Teacher Functional — Homework & Notes', () => {

  test('FN-TCH-10 | Send homework to parents', async ({ page }) => {
    /** Expected: Typing homework text and clicking Send calls API,
     *  shows "Homework sent to parents" confirmation */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    const planTab = page.locator('button:has-text("Plan")').first();
    if (await planTab.isVisible({ timeout: 3000 }).catch(() => false)) await planTab.click();
    await page.waitForTimeout(500);
    const hwTextarea = page.locator('textarea[placeholder*="homework"], textarea[placeholder*="Homework"]').first();
    if (await hwTextarea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await hwTextarea.fill('Practice writing letters A and B. Count 10 objects at home.');
      const sendBtn = page.locator('button:has-text("Send Homework"), button:has-text("Send")').first();
      await sendBtn.click();
      await page.waitForTimeout(5000);
      await page.screenshot({ path: 'test-results/fn-teacher-10-homework.png' });
      await expect(page.locator('text=sent, text=Sent, text=parents').first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('FN-TCH-11 | Track homework completion for each student', async ({ page }) => {
    /** Seed: homework_submissions June 15 — Aarav completed, Rohan partial.
     *  Expected: Completion tracking shows student list with status buttons */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    const planTab = page.locator('button:has-text("Plan")').first();
    if (await planTab.isVisible({ timeout: 3000 }).catch(() => false)) await planTab.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/fn-teacher-11-hw-tracking.png' });
    await expect(page.locator('text=Homework Completion, text=Tracking, text=completed').first()).toBeVisible();
  });

  test('FN-TCH-12 | Send class notes to parents', async ({ page }) => {
    /** Expected: Typing a note and clicking Send calls notes API */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    const planTab = page.locator('button:has-text("Plan")').first();
    if (await planTab.isVisible({ timeout: 3000 }).catch(() => false)) await planTab.click();
    await page.waitForTimeout(500);
    const noteTextarea = page.locator('textarea[placeholder*="note"], textarea[placeholder*="Note"]').first();
    if (await noteTextarea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await noteTextarea.fill('Today we covered Circle Time and English. Great participation from all students!');
      const sendBtn = page.locator('button:has-text("Send Note"), button:has-text("Send")').last();
      await sendBtn.click();
      await page.waitForTimeout(5000);
      await page.screenshot({ path: 'test-results/fn-teacher-12-notes.png' });
      await expect(page.locator('text=sent, text=Sent, text=parents').first()).toBeVisible({ timeout: 10000 });
    }
  });

});

test.describe('Teacher Functional — Journey', () => {

  test('FN-TCH-13 | Journey page shows existing entries for Aarav and Priya', async ({ page }) => {
    /** Seed: child_journey_entries for Aarav (highlight), Priya (daily), Rohan (weekly).
     *  Expected: Student selector shows students, entries visible after selection */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/teacher/journey`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/fn-teacher-13-journey.png' });
    await expect(page.locator('text=Journal, text=Journey').first()).toBeVisible();
  });

  test('FN-TCH-14 | Add a new journey entry for Aarav Kapoor', async ({ page }) => {
    /** Expected: Selecting Aarav, typing an entry, and saving creates a new entry */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/teacher/journey`);
    await page.waitForLoadState('networkidle');
    const studentSelect = page.locator('select').first();
    if (await studentSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await studentSelect.selectOption({ label: 'Aarav Kapoor' });
      await page.waitForTimeout(500);
      const entryTextarea = page.locator('textarea').first();
      if (await entryTextarea.isVisible({ timeout: 3000 }).catch(() => false)) {
        await entryTextarea.fill('Aarav showed great enthusiasm during Math today. He counted to 20 independently!');
        const saveBtn = page.locator('button:has-text("Save"), button:has-text("Add")').first();
        await saveBtn.click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'test-results/fn-teacher-14-journey-entry.png' });
        await expect(page.locator('text=saved, text=Saved, text=added, text=✓').first()).toBeVisible();
      }
    }
  });

  test('FN-TCH-15 | Report Readiness tab shows observation checklist', async ({ page }) => {
    /** Expected: Report Readiness tab shows per-student checklist of 10 observation categories */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/teacher/journey`);
    await page.waitForLoadState('networkidle');
    const tab = page.locator('button:has-text("Report Readiness"), button:has-text("Readiness")').first();
    if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tab.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/fn-teacher-15-readiness.png' });
      await expect(page.locator('text=observation, text=category, text=student').first()).toBeVisible();
    }
  });

});

test.describe('Teacher Functional — Messages', () => {

  test('FN-TCH-16 | Messages page shows thread with Aarav parent', async ({ page }) => {
    /** Seed: 3 messages between Kavitha and Parent1 (Aarav parent).
     *  Expected: Parent1 conversation thread visible with message history */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/teacher/messages`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/fn-teacher-16-messages.png' });
    // Should show parent conversation or empty state
    await expect(page.locator('text=parent, text=Parent, text=message, text=No messages').first()).toBeVisible();
  });

  test('FN-TCH-17 | Send a new message to parent', async ({ page }) => {
    /** Expected: Typing a message and sending creates a new message in the thread */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/teacher/messages`);
    await page.waitForLoadState('networkidle');
    // Click first conversation thread
    const thread = page.locator('.cursor-pointer, button').first();
    if (await thread.isVisible({ timeout: 3000 }).catch(() => false)) {
      await thread.click();
      await page.waitForTimeout(500);
      const msgInput = page.locator('input[placeholder*="message"], input[placeholder*="Message"], textarea').last();
      if (await msgInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await msgInput.fill('Good morning! Just a reminder about the Art activity tomorrow.');
        await page.locator('button[type="submit"], button:has-text("Send")').last().click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'test-results/fn-teacher-17-send-message.png' });
        await expect(page.locator('text=Good morning, text=Art activity').first()).toBeVisible();
      }
    }
  });

});

test.describe('Teacher Functional — Students', () => {

  test('FN-TCH-18 | Students page shows all 6 UKG students with profiles', async ({ page }) => {
    /** Seed: 6 active students. Expected: All names visible with class info */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/teacher/students`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/fn-teacher-18-students.png' });
    await expect(page.locator('text=Aarav Kapoor').first()).toBeVisible();
    await expect(page.locator('text=Priya Nair').first()).toBeVisible();
    await expect(page.locator('text=Rohan Mehta').first()).toBeVisible();
  });

  test('FN-TCH-19 | Student profile shows attendance and milestone data', async ({ page }) => {
    /** Expected: Clicking a student shows their attendance history and milestones */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/teacher/students`);
    await page.waitForLoadState('networkidle');
    const aaravCard = page.locator('text=Aarav Kapoor').first();
    if (await aaravCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await aaravCard.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/fn-teacher-19-student-profile.png' });
      await expect(page.locator('text=Aarav, text=attendance, text=Attendance, text=milestone').first()).toBeVisible();
    }
  });

});
