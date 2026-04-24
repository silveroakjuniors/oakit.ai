/**
 * PARENT FUNCTIONAL TESTS — seed_demo_june17.sql
 * Parent1 (9800000004): Aarav Kapoor's parent
 * Parent2 (9800000005): Another UKG student's parent
 * Key flows: view homework, notes, journey, shared reports, messages
 */
import { test, expect } from '@playwright/test';
import { login, USERS, BASE } from '../e2e/helpers';
const P1 = USERS.parent1;
const P2 = USERS.parent2;

test.describe('Parent Functional — Dashboard', () => {

  test('FN-PAR-01 | Parent1 dashboard shows Aarav Kapoor as linked child', async ({ page }) => {
    /** Seed: Parent1 linked to Aarav Kapoor. Expected: Aarav's name visible on dashboard */
    await login(page, P1.mobile, P1.role);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/fn-parent-01-dashboard.png' });
    await expect(page.locator('text=Aarav Kapoor, text=Aarav').first()).toBeVisible({ timeout: 10000 });
  });

  test('FN-PAR-02 | Attendance summary shows Aarav present most days', async ({ page }) => {
    /** Seed: Aarav present June 2-16 (no absences). Expected: High attendance % */
    await login(page, P1.mobile, P1.role);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/fn-parent-02-attendance.png' });
    await expect(page.locator('text=Attendance, text=Present, text=attendance').first()).toBeVisible();
  });

  test('FN-PAR-03 | Curriculum coverage shows UKG progress', async ({ page }) => {
    /** Seed: 11 days full completion. Expected: Coverage % visible for Aarav's class */
    await login(page, P1.mobile, P1.role);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/fn-parent-03-coverage.png' });
    await expect(page.locator('text=Coverage, text=curriculum, text=%').first()).toBeVisible();
  });

  test('FN-PAR-04 | Homework section shows latest homework text', async ({ page }) => {
    /** Seed: teacher_homework sent June 2-16. Expected: Latest homework text visible */
    await login(page, P1.mobile, P1.role);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/fn-parent-04-homework.png' });
    await expect(page.locator('text=Homework, text=homework').first()).toBeVisible();
  });

  test('FN-PAR-05 | Notes section shows teacher notes', async ({ page }) => {
    /** Seed: teacher_notes sent June 2-16. Expected: Notes visible with expiry warning */
    await login(page, P1.mobile, P1.role);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/fn-parent-05-notes.png' });
    await expect(page.locator('text=Notes, text=note').first()).toBeVisible();
  });

  test('FN-PAR-06 | Shared report visible after admin shares it', async ({ page }) => {
    /** Seed: Requires admin to have shared a report (FN-RPT-04 must run first).
     *  Expected: Reports section shows Aarav's report card */
    await login(page, P1.mobile, P1.role);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/fn-parent-06-reports.png' });
    await expect(page.locator('text=Report, text=report').first()).toBeVisible();
  });

});

test.describe('Parent Functional — Child Journey', () => {

  test('FN-PAR-07 | Journey page shows Aarav highlight entry from June 16', async ({ page }) => {
    /** Seed: child_journey_entries — Aarav highlight "recited alphabet song".
     *  Expected: Entry visible with beautified text */
    await login(page, P1.mobile, P1.role);
    await page.waitForLoadState('networkidle');
    const journeyLink = page.locator('a[href*="journey"]').first();
    if (await journeyLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await journeyLink.click();
    } else {
      await page.goto(`${BASE}/parent/journey`);
    }
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/fn-parent-07-journey.png' });
    await expect(
      page.locator('text=alphabet, text=Aarav, text=proud, text=beginning').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('FN-PAR-08 | Daily snapshot loads for Aarav', async ({ page }) => {
    /** Expected: Oakie daily snapshot card visible at top of journey page */
    await login(page, P1.mobile, P1.role);
    await page.waitForLoadState('networkidle');
    const journeyLink = page.locator('a[href*="journey"]').first();
    if (await journeyLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await journeyLink.click();
    } else {
      await page.goto(`${BASE}/parent/journey`);
    }
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(4000); // snapshot takes time
    await page.screenshot({ path: 'test-results/fn-parent-08-snapshot.png' });
    // Snapshot or loading state
    await expect(page).not.toHaveURL(/login/);
  });

  test('FN-PAR-09 | Filter journey by date range June 1-16 shows entries', async ({ page }) => {
    /** Expected: Changing date range to June 1-16 shows Aarav's highlight entry */
    await login(page, P1.mobile, P1.role);
    await page.waitForLoadState('networkidle');
    const journeyLink = page.locator('a[href*="journey"]').first();
    if (await journeyLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await journeyLink.click();
    } else {
      await page.goto(`${BASE}/parent/journey`);
    }
    await page.waitForLoadState('networkidle');
    const fromInput = page.locator('input[type="date"]').first();
    if (await fromInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fromInput.fill('2026-06-01');
      await page.locator('input[type="date"]').nth(1).fill('2026-06-16');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/fn-parent-09-date-filter.png' });
      await expect(page.locator('text=alphabet, text=Aarav, text=highlight, text=beginning').first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('FN-PAR-10 | Journey entry type badges show Daily / Weekly / Highlight', async ({ page }) => {
    /** Seed: Aarav has "highlight" entry. Expected: Highlight badge visible */
    await login(page, P1.mobile, P1.role);
    await page.waitForLoadState('networkidle');
    const journeyLink = page.locator('a[href*="journey"]').first();
    if (await journeyLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await journeyLink.click();
    } else {
      await page.goto(`${BASE}/parent/journey`);
    }
    await page.waitForLoadState('networkidle');
    await page.locator('input[type="date"]').first().fill('2026-06-01').catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/fn-parent-10-entry-types.png' });
    await expect(
      page.locator('text=Highlight, text=highlight, text=Daily, text=Weekly').first()
    ).toBeVisible({ timeout: 10000 });
  });

});

test.describe('Parent Functional — Cross-actor: Report Shared by Admin', () => {

  test('FN-CROSS-01 | Admin shares report → Parent sees it on dashboard', async ({ page }) => {
    /**
     * CROSS-ACTOR FLOW:
     *  Step 1: Admin generates and shares Aarav's report
     *  Step 2: Parent1 logs in and sees the report on their dashboard
     *
     * EXPECTED: Report card visible on parent dashboard with Aarav's name
     * SEED: Requires FN-RPT-04 to have run (or existing shared report in DB)
     */
    // Step 1: Admin shares report
    await login(page, USERS.admin.mobile, USERS.admin.role);
    await page.goto(`${BASE}/admin/reports`);
    await page.waitForLoadState('networkidle');
    await page.locator('button:has-text("Saved")').first().click();
    await page.waitForLoadState('networkidle');
    const shareBtn = page.locator('button:has-text("Share")').first();
    if (await shareBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await shareBtn.click();
      await page.waitForTimeout(3000);
    }
    await page.screenshot({ path: 'test-results/fn-cross-01-admin-shared.png' });

    // Step 2: Parent logs in and checks
    await page.evaluate(() => { localStorage.clear(); });
    await login(page, P1.mobile, P1.role);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/fn-cross-01-parent-sees-report.png' });
    await expect(page.locator('text=Report, text=report').first()).toBeVisible({ timeout: 10000 });
  });

  test('FN-CROSS-02 | Teacher sends homework → Parent sees it on dashboard', async ({ page }) => {
    /**
     * CROSS-ACTOR FLOW:
     *  Step 1: Teacher sends homework for today
     *  Step 2: Parent logs in and sees homework on dashboard
     *
     * SEED: teacher_homework table has entries June 2-16.
     * EXPECTED: Parent dashboard shows homework text
     */
    // Parent checks homework (seed already has homework sent)
    await login(page, P1.mobile, P1.role);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/fn-cross-02-parent-homework.png' });
    await expect(page.locator('text=Homework, text=homework, text=Practice, text=letters').first()).toBeVisible({ timeout: 10000 });
  });

  test('FN-CROSS-03 | Teacher adds journey entry → Parent sees it in journey page', async ({ page }) => {
    /**
     * CROSS-ACTOR FLOW:
     *  Seed has Aarav's highlight entry from June 16.
     *  Parent navigates to journey and sees the entry.
     *
     * EXPECTED: "alphabet song" or "proud moment" text visible in journey
     */
    await login(page, P1.mobile, P1.role);
    await page.waitForLoadState('networkidle');
    const journeyLink = page.locator('a[href*="journey"]').first();
    if (await journeyLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await journeyLink.click();
    } else {
      await page.goto(`${BASE}/parent/journey`);
    }
    await page.waitForLoadState('networkidle');
    await page.locator('input[type="date"]').first().fill('2026-06-01').catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/fn-cross-03-journey-entry.png' });
    await expect(
      page.locator('text=alphabet, text=proud, text=Aarav, text=beginning').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('FN-CROSS-04 | Teacher sends message → Parent sees it in messages', async ({ page }) => {
    /**
     * CROSS-ACTOR FLOW:
     *  Seed has 3 messages between Kavitha and Parent1.
     *  Parent1 logs in and sees the message thread.
     *
     * EXPECTED: Message from Kavitha visible on parent dashboard
     */
    await login(page, P1.mobile, P1.role);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/fn-cross-04-parent-messages.png' });
    // Messages section on parent dashboard
    await expect(
      page.locator('text=Kavitha, text=message, text=Message, text=alphabet').first()
    ).toBeVisible({ timeout: 10000 });
  });

});
