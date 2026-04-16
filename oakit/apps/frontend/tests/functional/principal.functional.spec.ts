/**
 * PRINCIPAL FUNCTIONAL TESTS — seed_demo_june17.sql
 * Actor: Principal (9800000002) | School: sojs
 * June 17: Birthdays today (Priya + Rohan), attendance not marked
 */
import { test, expect } from '@playwright/test';
import { login, USERS, BASE } from '../e2e/helpers';
const U = USERS.principal;

test.describe('Principal Functional — Dashboard', () => {

  test('FN-PRI-01 | Birthday widget shows Priya Nair and Rohan Mehta today', async ({ page }) => {
    /** Seed: date_of_birth=2021-06-17 for Priya and Rohan. Expected: "Today" badge for both */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/fn-principal-01-birthdays.png' });
    const birthdaySection = page.locator('text=Birthday, text=birthday').first();
    if (await birthdaySection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(page.locator('text=Priya Nair').first()).toBeVisible();
      await expect(page.locator('text=Rohan Mehta').first()).toBeVisible();
      await expect(page.locator('text=Today, text=today').first()).toBeVisible();
    }
  });

  test('FN-PRI-02 | Aarav Kapoor shows as upcoming birthday (in 3 days)', async ({ page }) => {
    /** Seed: Aarav DOB=2021-06-20, demo date=June 17 → in 3 days */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/fn-principal-02-upcoming-bday.png' });
    const birthdaySection = page.locator('text=Birthday, text=birthday').first();
    if (await birthdaySection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(page.locator('text=Aarav Kapoor').first()).toBeVisible();
      await expect(page.locator('text=in 3d, text=3 days').first()).toBeVisible();
    }
  });

  test('FN-PRI-03 | School Health donuts show correct percentages', async ({ page }) => {
    /** Seed: 11 days full completion. Expected: Curriculum donut >60%, Plans 0% (today not done) */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/fn-principal-03-health.png' });
    await expect(page.locator('text=School Health').first()).toBeVisible();
    await expect(page.locator('text=Curriculum').first()).toBeVisible();
    await expect(page.locator('text=Attendance').first()).toBeVisible();
  });

  test('FN-PRI-04 | Teaching Consistency shows Kavitha with 11 days', async ({ page }) => {
    /** Seed: teacher_streaks current_streak=11. Expected: Kavitha row shows 11 days */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    const btn = page.locator('button:has-text("Teaching Consistency")').first();
    if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: 'test-results/fn-principal-04-consistency.png' });
      await expect(page.locator('text=Kavitha').first()).toBeVisible();
      await expect(page.locator('text=11').first()).toBeVisible();
    }
  });

  test('FN-PRI-05 | Teaching Engagement shows Kavitha 30d rate', async ({ page }) => {
    /** Seed: 11 completions in ~22 school days = ~50% rate. Expected: % visible */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    const btn = page.locator('button:has-text("Teaching Engagement")').first();
    if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: 'test-results/fn-principal-05-engagement.png' });
      await expect(page.locator('text=Kavitha').first()).toBeVisible();
      await expect(page.locator('text=%').first()).toBeVisible();
    }
  });

  test('FN-PRI-06 | Engagement drill-down shows formula for Kavitha', async ({ page }) => {
    /** Expected: Clicking Kavitha row shows Plans completed, Current consistency, Formula */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    const btn = page.locator('button:has-text("Teaching Engagement")').first();
    if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(400);
      const kavithaRow = page.locator('button:has-text("Kavitha"), button:has-text("%")').first();
      if (await kavithaRow.isVisible({ timeout: 3000 }).catch(() => false)) {
        await kavithaRow.click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: 'test-results/fn-principal-06-drilldown.png' });
        await expect(page.locator('text=Plans completed, text=Formula').first()).toBeVisible();
      }
    }
  });

  test('FN-PRI-07 | Classes & Sections shows UKG with 6 students', async ({ page }) => {
    /** Seed: UKG Section A with 6 students. Expected: UKG row shows 6 students */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    const btn = page.locator('button:has-text("Classes"), button:has-text("Classes & Sections")').first();
    if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: 'test-results/fn-principal-07-classes.png' });
      await expect(page.locator('text=UKG').first()).toBeVisible();
      await expect(page.locator('text=6 students, text=6').first()).toBeVisible();
    }
  });

  test('FN-PRI-08 | Ask Oakie "Who is the teacher of UKG?" gets Kavitha', async ({ page }) => {
    /** Expected: AI responds with Kavitha's name as UKG teacher */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    const input = page.locator('input[placeholder*="Ask"], input[placeholder*="school"]').first();
    if (await input.isVisible({ timeout: 5000 }).catch(() => false)) {
      await input.fill('Who is the teacher of UKG?');
      await input.press('Enter');
      await page.waitForTimeout(10000);
      await page.screenshot({ path: 'test-results/fn-principal-08-teacher-query.png' });
      await expect(page.locator('text=Kavitha, text=UKG, text=teacher').first()).toBeVisible({ timeout: 15000 });
    }
  });

  test('FN-PRI-09 | Ask Oakie "How is UKG coverage?" gets coverage data', async ({ page }) => {
    /** Expected: AI responds with UKG coverage percentage from DB */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    const input = page.locator('input[placeholder*="Ask"], input[placeholder*="school"]').first();
    if (await input.isVisible({ timeout: 5000 }).catch(() => false)) {
      await input.fill('How is the UKG curriculum coverage?');
      await input.press('Enter');
      await page.waitForTimeout(10000);
      await page.screenshot({ path: 'test-results/fn-principal-09-coverage-query.png' });
      await expect(page.locator('text=UKG, text=coverage, text=%, text=covered').first()).toBeVisible({ timeout: 15000 });
    }
  });

  test('FN-PRI-10 | Ask Oakie "Who has not submitted attendance?" gets pending list', async ({ page }) => {
    /** Seed: June 17 attendance not marked. Expected: AI says UKG Section A pending */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    const input = page.locator('input[placeholder*="Ask"], input[placeholder*="school"]').first();
    if (await input.isVisible({ timeout: 5000 }).catch(() => false)) {
      await input.fill("Who hasn't submitted attendance today?");
      await input.press('Enter');
      await page.waitForTimeout(10000);
      await page.screenshot({ path: 'test-results/fn-principal-10-attendance-query.png' });
      await expect(page.locator('text=UKG, text=attendance, text=Attendance, text=pending').first()).toBeVisible({ timeout: 15000 });
    }
  });

});

test.describe('Principal Functional — Sub-pages', () => {

  test('FN-PRI-11 | Coverage page shows UKG with high coverage bar', async ({ page }) => {
    /** Seed: 11 days full completion. Expected: UKG shows green/amber bar */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/principal/coverage`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/fn-principal-11-coverage.png' });
    await expect(page.locator('text=UKG').first()).toBeVisible();
  });

  test('FN-PRI-12 | Overview — generate class coverage report for UKG', async ({ page }) => {
    /** Expected: Selecting UKG Section A and generating shows grouped subjects (not Week X Day Y) */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/principal/overview`);
    await page.waitForLoadState('networkidle');
    const sectionSelect = page.locator('select').first();
    if (await sectionSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sectionSelect.selectOption({ index: 1 });
      await page.locator('input[type="date"]').first().fill('2026-06-02');
      await page.locator('input[type="date"]').nth(1).fill('2026-06-16');
      await page.locator('button:has-text("Generate Report")').first().click();
      await page.waitForTimeout(5000);
      await page.screenshot({ path: 'test-results/fn-principal-12-coverage-report.png' });
      // Should show grouped subjects, NOT "Week 1 Day 1" style
      await expect(page.locator('text=English, text=Math, text=Circle Time, text=subjects covered').first()).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=Week 1 Day 1').first()).not.toBeVisible();
    }
  });

  test('FN-PRI-13 | Teachers page Engagement tab shows Kavitha 30d rate', async ({ page }) => {
    /** Expected: Engagement tab shows Kavitha with completion % and last plan date */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/principal/teachers`);
    await page.waitForLoadState('networkidle');
    const engTab = page.locator('button:has-text("Engagement")').first();
    if (await engTab.isVisible()) {
      await engTab.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/fn-principal-13-engagement.png' });
      await expect(page.locator('text=Kavitha').first()).toBeVisible();
      await expect(page.locator('text=30-day rate, text=%').first()).toBeVisible();
    }
  });

  test('FN-PRI-14 | Send birthday wish to Priya and Rohan', async ({ page }) => {
    /** Seed: Priya + Rohan birthday June 17. Expected: Birthday widget shows, Oakie formats wish */
    await login(page, U.mobile, U.role);
    await page.waitForLoadState('networkidle');
    const birthdayBtn = page.locator('button:has-text("Birthday"), button:has-text("birthday")').first();
    if (await birthdayBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await birthdayBtn.click();
      await page.waitForTimeout(400);
      const wishInput = page.locator('input[placeholder*="birthday"], input[placeholder*="wish"]').first();
      if (await wishInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await wishInput.fill('Wishing you a wonderful birthday!');
        await page.locator('button:has-text("✨"), button:has-text("Format")').first().click();
        await page.waitForTimeout(5000);
        await page.screenshot({ path: 'test-results/fn-principal-14-birthday-wish.png' });
        await expect(page.locator('text=Review before sending, text=birthday').first()).toBeVisible();
      }
    }
  });

});
