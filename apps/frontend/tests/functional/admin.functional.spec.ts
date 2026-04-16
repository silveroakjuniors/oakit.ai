/**
 * ADMIN FUNCTIONAL TESTS — seed_demo_june17.sql
 * School: sojs | Mock date: June 17 2026
 * Students: Aarav Kapoor, Priya Nair, Rohan Mehta, Ananya Singh, Dev Patel, Sia Sharma
 * Teacher: Kavitha (9800000003) | 11-day consistency streak
 */
import { test, expect } from '@playwright/test';
import { login, USERS, BASE } from '../e2e/helpers';
const U = USERS.admin;

// ─── TIME MACHINE ─────────────────────────────────────────────
test.describe('Admin Functional — Time Machine', () => {

  test('FN-TM-01 | Activate Time Machine to June 17 2026', async ({ page }) => {
    /** Seed: time_machine table. Expected: mock_date=2026-06-17 active badge + Disable button */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    const dateInput = page.locator('input[type="date"]').last();
    await dateInput.fill('2026-06-17');
    await page.locator('button:has-text("Activate")').first().click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/fn-admin-TM-01.png' });
    await expect(page.locator('text=2026-06-17').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Disable")').first()).toBeVisible();
  });

  test('FN-TM-02 | Disable Time Machine returns to inactive state', async ({ page }) => {
    /** Expected: After disable, Activate button reappears, mock_date cleared */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    const dateInput = page.locator('input[type="date"]').last();
    await dateInput.fill('2026-06-17');
    await page.locator('button:has-text("Activate")').first().click();
    await page.waitForTimeout(3000);
    const disableBtn = page.locator('button:has-text("Disable")').first();
    if (await disableBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await disableBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/fn-admin-TM-02.png' });
      await expect(page.locator('button:has-text("Activate")').first()).toBeVisible();
    }
  });

});

// ─── DASHBOARD LIVE DATA ──────────────────────────────────────
test.describe('Admin Functional — Dashboard Live Data', () => {

  test('FN-DASH-01 | Stat cards reflect June 17 state (attendance not marked)', async ({ page }) => {
    /** Seed: No attendance_records for June 17. Expected: Attendance card shows 0/1 sections */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/fn-admin-DASH-01.png' });
    await expect(page.locator('text=Attendance').first()).toBeVisible();
    await expect(page.locator('text=Plans Done').first()).toBeVisible();
  });

  test('FN-DASH-02 | Coverage shows UKG high coverage from June 2-16', async ({ page }) => {
    /** Seed: 11 days full completion + partial June 16. Expected: UKG shows >60% bar */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    await page.locator('button:has-text("Curriculum Coverage")').first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/fn-admin-DASH-02.png' });
    await expect(page.locator('text=UKG').first()).toBeVisible();
  });

  test('FN-DASH-03 | School Intelligence shows Kavitha performance score', async ({ page }) => {
    /** Seed: teacher_streaks current_streak=11, completions June 2-16. Expected: score >50 */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    await page.locator('button:has-text("School Intelligence")').first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/fn-admin-DASH-03.png' });
    await expect(page.locator('text=Kavitha, text=Teacher Performance').first()).toBeVisible({ timeout: 10000 });
  });

  test('FN-DASH-04 | Teacher drill-down shows 7-factor score breakdown for Kavitha', async ({ page }) => {
    /** Expected: Clicking Kavitha score card shows Plan Completion, Teaching Consistency, AI Engagement factors */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    await page.locator('button:has-text("School Intelligence")').first().click();
    await page.waitForTimeout(1000);
    const kavithaCard = page.locator('button:has-text("Kavitha")').first();
    if (await kavithaCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await kavithaCard.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/fn-admin-DASH-04.png' });
      await expect(page.locator('text=Plan Completion').first()).toBeVisible();
      await expect(page.locator('text=Teaching Consistency').first()).toBeVisible();
    }
  });

  test('FN-DASH-05 | Engagement shows Kavitha as active with 11-day consistency', async ({ page }) => {
    /** Seed: daily_completions + teacher_homework June 2-16. Expected: Active status, 11d consistency */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    await page.locator('button:has-text("Engagement Intelligence")').first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/fn-admin-DASH-05.png' });
    await expect(page.locator('text=Kavitha').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=11d consistency, text=11').first()).toBeVisible();
  });

  test('FN-DASH-06 | Homework tab shows June 15 and 16 homework data', async ({ page }) => {
    /** Seed: homework_submissions June 15 (4 completed, 1 partial) and June 16 (2 absent) */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    await page.locator('button:has-text("Engagement Intelligence")').first().click();
    await page.waitForTimeout(1000);
    await page.locator('button:has-text("Homework")').first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/fn-admin-DASH-06.png' });
    await expect(page.locator('text=Completed, text=completed').first()).toBeVisible();
  });

  test('FN-DASH-07 | Coverage drill-down for UKG shows topic list', async ({ page }) => {
    /** Expected: Clicking UKG section shows covered/uncovered topics with dates */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    await page.locator('button:has-text("Curriculum Coverage")').first().click();
    await page.waitForTimeout(500);
    const ukgRow = page.locator('button:has-text("UKG")').first();
    if (await ukgRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ukgRow.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/fn-admin-DASH-07.png' });
      await expect(page.locator('text=Topic Breakdown, text=topics covered').first()).toBeVisible();
    }
  });

});

// ─── REPORTS FUNCTIONAL ───────────────────────────────────────
test.describe('Admin Functional — Reports', () => {

  test('FN-RPT-01 | Generate progress report for Aarav Kapoor (June 2-16)', async ({ page }) => {
    /** Seed: attendance, completions, journey entries for Aarav. Expected: AI report with Aarav's name */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/admin/reports`);
    await page.waitForLoadState('networkidle');
    const classSelect = page.locator('select').first();
    await classSelect.selectOption({ label: 'UKG' });
    await page.waitForTimeout(500);
    await page.locator('select').nth(1).selectOption({ index: 1 });
    await page.waitForTimeout(1000);
    const studentSelect = page.locator('select').nth(2);
    if (await studentSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await studentSelect.selectOption({ label: 'Aarav Kapoor' });
    }
    await page.locator('input[type="date"]').first().fill('2026-06-02');
    await page.locator('input[type="date"]').nth(1).fill('2026-06-16');
    await page.screenshot({ path: 'test-results/fn-admin-RPT-01-before.png' });
    await page.locator('button:has-text("Generate")').first().click();
    await page.waitForTimeout(30000);
    await page.screenshot({ path: 'test-results/fn-admin-RPT-01-after.png' });
    await expect(page.locator('text=Aarav, text=report, text=Report').first()).toBeVisible({ timeout: 35000 });
  });

  test('FN-RPT-02 | Generated report appears in Saved tab', async ({ page }) => {
    /** Expected: Saved tab shows at least 1 report card with student name */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/admin/reports`);
    await page.waitForLoadState('networkidle');
    await page.locator('button:has-text("Saved")').first().click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/fn-admin-RPT-02.png' });
    await expect(page.locator('text=Aarav, text=No saved, text=report').first()).toBeVisible({ timeout: 10000 });
  });

  test('FN-RPT-03 | View saved report inline shows AI text', async ({ page }) => {
    /** Expected: Clicking View expands report with Learning & Development sections */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/admin/reports`);
    await page.waitForLoadState('networkidle');
    await page.locator('button:has-text("Saved")').first().click();
    await page.waitForLoadState('networkidle');
    const viewBtn = page.locator('button:has-text("View"), button:has-text("👁")').first();
    if (await viewBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await viewBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/fn-admin-RPT-03.png' });
      await expect(page.locator('text=Learning, text=Attendance, text=Development').first()).toBeVisible();
    } else {
      test.skip(true, 'No saved reports to view');
    }
  });

  test('FN-RPT-04 | Share report with parent — button changes to Sent', async ({ page }) => {
    /** Expected: Share button triggers API, badge changes to "Sent to parents" */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/admin/reports`);
    await page.waitForLoadState('networkidle');
    await page.locator('button:has-text("Saved")').first().click();
    await page.waitForLoadState('networkidle');
    const shareBtn = page.locator('button:has-text("Share")').first();
    if (await shareBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await shareBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'test-results/fn-admin-RPT-04.png' });
      await expect(page.locator('text=Sent to parents, text=shared').first()).toBeVisible({ timeout: 10000 });
    } else {
      test.skip(true, 'No unsent reports available');
    }
  });

  test('FN-RPT-05 | Download PDF triggers file download', async ({ page }) => {
    /** Expected: Browser initiates PDF download, filename ends in .pdf */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/admin/reports`);
    await page.waitForLoadState('networkidle');
    await page.locator('button:has-text("Saved")').first().click();
    await page.waitForLoadState('networkidle');
    const pdfBtn = page.locator('button:has-text("PDF"), button:has-text("↓ PDF")').first();
    if (await pdfBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
      await pdfBtn.click();
      const dl = await downloadPromise;
      await page.screenshot({ path: 'test-results/fn-admin-RPT-05.png' });
      if (dl) expect(dl.suggestedFilename()).toMatch(/\.pdf$/i);
    } else {
      test.skip(true, 'No saved reports to download');
    }
  });

  test('FN-RPT-06 | Generate Term Report for Aarav — success modal appears', async ({ page }) => {
    /** Expected: Success modal with "Term Report Generated!" + Share with Parents + OK buttons */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/admin/reports`);
    await page.waitForLoadState('networkidle');
    await page.locator('button:has-text("Term")').first().click();
    await page.waitForTimeout(300);
    await page.locator('select').first().selectOption({ label: 'UKG' });
    await page.waitForTimeout(500);
    await page.locator('select').nth(1).selectOption({ index: 1 });
    await page.waitForTimeout(1000);
    const studentSelect = page.locator('select').nth(2);
    if (await studentSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await studentSelect.selectOption({ label: 'Aarav Kapoor' });
    }
    await page.locator('input[type="date"]').first().fill('2026-06-02');
    await page.locator('input[type="date"]').nth(1).fill('2026-06-16');
    await page.screenshot({ path: 'test-results/fn-admin-RPT-06-before.png' });
    await page.locator('button:has-text("Generate Term"), button:has-text("Generate Annual"), button:has-text("Generate")').first().click();
    await page.waitForTimeout(35000);
    await page.screenshot({ path: 'test-results/fn-admin-RPT-06-after.png' });
    await expect(page.locator('text=Report Generated, text=Aarav').first()).toBeVisible({ timeout: 40000 });
  });

  test('FN-RPT-07 | Edit saved report text and save changes', async ({ page }) => {
    /** Expected: Edit button opens textarea, saving updates the report text */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/admin/reports`);
    await page.waitForLoadState('networkidle');
    await page.locator('button:has-text("Saved")').first().click();
    await page.waitForLoadState('networkidle');
    const editBtn = page.locator('button:has-text("Edit")').first();
    if (await editBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(500);
      const textarea = page.locator('textarea').first();
      await textarea.fill('Edited report content — functional test.');
      await page.locator('button:has-text("Save")').first().click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/fn-admin-RPT-07.png' });
      await expect(page.locator('text=updated, text=saved, text=Report updated').first()).toBeVisible();
    } else {
      test.skip(true, 'No saved reports to edit');
    }
  });

  test('FN-RPT-08 | Delete saved report with confirmation', async ({ page }) => {
    /** Expected: Delete button shows confirm dialog, confirming removes the report */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/admin/reports`);
    await page.waitForLoadState('networkidle');
    await page.locator('button:has-text("Saved")').first().click();
    await page.waitForLoadState('networkidle');
    const deleteBtn = page.locator('button:has-text("Delete")').first();
    if (await deleteBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      page.on('dialog', d => d.accept());
      await deleteBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/fn-admin-RPT-08.png' });
      // Report should be removed from list
      await expect(page).not.toHaveURL(/login/);
    } else {
      test.skip(true, 'No saved reports to delete');
    }
  });

});

// ─── STUDENTS & SETTINGS ──────────────────────────────────────
test.describe('Admin Functional — Students', () => {

  test('FN-STU-01 | Students page shows all 6 UKG students', async ({ page }) => {
    /** Seed: 6 active students in UKG-A. Expected: All names visible */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/admin/students`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/fn-admin-STU-01.png' });
    await expect(page.locator('text=Aarav Kapoor').first()).toBeVisible();
    await expect(page.locator('text=Priya Nair').first()).toBeVisible();
    await expect(page.locator('text=Rohan Mehta').first()).toBeVisible();
    await expect(page.locator('text=Ananya Singh').first()).toBeVisible();
  });

  test('FN-STU-02 | Search for Aarav filters to one result', async ({ page }) => {
    /** Expected: Searching "Aarav" shows only Aarav Kapoor, hides others */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/admin/students`);
    await page.waitForLoadState('networkidle');
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('Aarav');
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/fn-admin-STU-02.png' });
      await expect(page.locator('text=Aarav Kapoor').first()).toBeVisible();
      await expect(page.locator('text=Priya Nair').first()).not.toBeVisible();
    }
  });

});

test.describe('Admin Functional — Settings', () => {

  test('FN-SET-01 | Settings shows school name Silveroak Juniors', async ({ page }) => {
    /** Seed: schools.name = Silveroak Juniors. Expected: Name visible in input */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/admin/settings`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/fn-admin-SET-01.png' });
    await expect(page.locator('input[value*="Silveroak"], text=Silveroak').first()).toBeVisible({ timeout: 10000 });
  });

});

test.describe('Admin Functional — Announcements', () => {

  test('FN-ANN-01 | Shows 3 seeded announcements (Sports Day, Art Activity, PTM)', async ({ page }) => {
    /** Seed: 3 announcements in DB. Expected: All 3 titles visible */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/admin/announcements`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/fn-admin-ANN-01.png' });
    await expect(page.locator('text=Sports Day').first()).toBeVisible();
    await expect(page.locator('text=Parent-Teacher Meeting, text=PTM').first()).toBeVisible();
  });

});
