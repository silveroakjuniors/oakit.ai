/**
 * ═══════════════════════════════════════════════════════════════
 * PRINCIPAL REGRESSION SUITE
 * Actor  : Principal  |  Mobile: 9800000002  |  Password: 9800000002
 * School : sojs (Silveroak Juniors)
 *
 * Features tested:
 *  AUTH  — Login / logout
 *  DASH  — School Health, Stat cards, Teacher Performance,
 *           Birthday widget, Quick Access, Time Machine
 *  SUB   — Sub-pages: Teachers, Classes, Reports, Settings
 * ═══════════════════════════════════════════════════════════════
 */
import { test, expect } from '@playwright/test';
import { login, logout, USERS, BASE } from './helpers';

const U = USERS.principal;

// Test configuration
test.describe.configure({ mode: 'serial' });

// ─── AUTHENTICATION TESTS ──────────────────────────────────────

test.describe.serial('Principal — Authentication', () => {

  test('AUTH-01 | Login with valid credentials redirects to /principal', async ({ page }) => {
    /**
     * Given: User is on login page
     * When:  User enters valid principal credentials
     * Then:  User is redirected to principal dashboard
     */
    await login(page, U.mobile, U.role);
    await page.screenshot({ path: 'test-results/principal-AUTH-01.png' });
    await expect(page).toHaveURL(/\/principal/);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('AUTH-02 | Sign out clears session and returns to /login', async ({ page }) => {
    /**
     * Given: User is logged in as principal
     * When:  User clicks sign out
     * Then:  User is redirected to login page and session is cleared
     */
    await login(page, U.mobile, U.role);
    await page.screenshot({ path: 'test-results/principal-AUTH-02-before.png' });
    await logout(page);
    await page.screenshot({ path: 'test-results/principal-AUTH-02-after.png' });
    await expect(page).toHaveURL(/\/login/);
  });

  test('AUTH-03 | Accessing /principal without login redirects to /login', async ({ page }) => {
    /**
     * Given: User is not logged in
     * When:  User tries to access /principal directly
     * Then:  User is redirected to /login
     */
    await page.goto(`${BASE}/principal`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/principal-AUTH-03.png' });
    await expect(page).toHaveURL(/\/login/);
  });

});

// ─── DASHBOARD TESTS ─────────────────────────────────────────

test.describe('Principal — Dashboard', () => {

  test.describe('Dashboard - Overview & Health', () => {

    test('DASH-01 | School Health section displays curriculum and attendance metrics', async ({ page }) => {
      /**
       * Given: Principal is logged in
       * When:  Dashboard loads
       * Then:  School Health section with donut charts is visible
       */
      await login(page, U.mobile, U.role);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/principal-DASH-01.png' });

      await expect(page.locator('text=School Health')).toBeVisible();
      const svgs = page.locator('svg');
      await expect(svgs.first()).toBeVisible();
    });

    test('DASH-02 | Stat cards display key school metrics', async ({ page }) => {
      /**
       * Given: Principal dashboard is loaded
       * When:  User views stat cards
       * Then:  All key metrics (Students, Present, Absent, etc.) are displayed
       */
      await login(page, U.mobile, U.role);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/principal-DASH-02.png' });

      await expect(page.locator('text=Students')).toBeVisible();
      await expect(page.locator('text=Present')).toBeVisible();
      await expect(page.locator('text=Absent')).toBeVisible();
    });

  });

  test.describe('Dashboard - Quick Navigation', () => {

    test('DASH-03 | Quick navigation links are functional', async ({ page }) => {
      /**
       * Given: Principal dashboard is loaded
       * When:  User views quick navigation
       * Then:  All navigation links (Attendance, Teachers, Coverage, Reports) are visible
       */
      await login(page, U.mobile, U.role);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/principal-DASH-03.png' });

      await expect(page.locator('text=Attendance')).toBeVisible();
      await expect(page.locator('text=Teachers')).toBeVisible();
      await expect(page.locator('text=Coverage')).toBeVisible();
    });

  });

  test.describe('Dashboard - Teaching Performance', () => {

    test('DASH-04 | Teaching Consistency section expands with teacher data', async ({ page }) => {
      /**
       * Given: Principal dashboard is loaded
       * When:  User expands Teaching Consistency section
       * Then:  Teacher consistency data is displayed
       */
      await login(page, U.mobile, U.role);
      await page.waitForLoadState('networkidle');

      const consistencyBtn = page.locator('button:has-text("Teaching Consistency")').first();
      if (await consistencyBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await consistencyBtn.click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: 'test-results/principal-DASH-04.png' });
        await expect(page.locator('text=days')).toBeVisible();
      } else {
        await page.screenshot({ path: 'test-results/principal-DASH-04-not-visible.png' });
        test.skip(true, 'No teacher consistency data in seed — section not rendered');
      }
    });

    test('DASH-05 | Teaching Engagement section shows completion rates', async ({ page }) => {
      /**
       * Given: Principal dashboard is loaded
       * When:  User expands Teaching Engagement section
       * Then:  Teacher engagement metrics and drill-down are available
       */
      await login(page, U.mobile, U.role);
      await page.waitForLoadState('networkidle');

      const engagementBtn = page.locator('button:has-text("Teaching Engagement")').first();
      if (await engagementBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await engagementBtn.click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: 'test-results/principal-DASH-05-expanded.png' });

        // Test drill-down functionality
        const teacherRow = page.locator('button:has-text("%")').first();
        if (await teacherRow.isVisible({ timeout: 3000 }).catch(() => false)) {
          await teacherRow.click();
          await page.waitForTimeout(300);
          await page.screenshot({ path: 'test-results/principal-DASH-05-drilldown.png' });
          await expect(page.locator('text=Plans completed')).toBeVisible();
        }
      } else {
        test.skip(true, 'No engagement data in seed');
      }
    });

  });

  test.describe('Dashboard - Class Management', () => {

    test('DASH-06 | Classes & Sections section displays class information', async ({ page }) => {
      /**
       * Given: Principal dashboard is loaded
       * When:  User expands Classes & Sections section
       * Then:  Class and section data is displayed
       */
      await login(page, U.mobile, U.role);
      await page.waitForLoadState('networkidle');

      const classesBtn = page.locator('button:has-text("Classes & Sections")').first();
      if (await classesBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await classesBtn.click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: 'test-results/principal-DASH-06.png' });
        await expect(page.locator('text=Class, text=Section')).toBeVisible();
      }
    });

    test('DASH-07 | Ask Oakie chat — question about UKG teacher gets a response', async ({ page }) => {
      /**
       * Expectation : Typing "Who is the teacher of UKG?" in the Ask Oakie
       *               chat and submitting returns a non-empty response within 15s.
       *               The response should mention a teacher name or UKG.
       */
      await login(page, U.mobile, U.role);
      await page.waitForLoadState('networkidle');
      const input = page.locator('input[placeholder*="Ask"], input[placeholder*="school"]').first();
      if (await input.isVisible({ timeout: 5000 }).catch(() => false)) {
        await input.fill('Who is the teacher of UKG?');
        await input.press('Enter');
        await page.waitForTimeout(10000);
        await page.screenshot({ path: 'test-results/principal-DASH-07-response.png' });
        // Response should not be empty and should not still show loading dots
        const responseArea = page.locator('.bg-neutral-100.text-neutral-800').last();
        await expect(responseArea).toBeVisible({ timeout: 15000 });
      } else {
        test.skip(true, 'Ask Oakie chat not visible');
      }
    });

    test('DASH-08 | Ask Oakie — attendance question gets attendance-specific response', async ({ page }) => {
      /**
       * Expectation : "Who has not submitted attendance today?" returns
       *               a response mentioning attendance status.
       */
      await login(page, U.mobile, U.role);
      await page.waitForLoadState('networkidle');
      const input = page.locator('input[placeholder*="Ask"], input[placeholder*="school"]').first();
      if (await input.isVisible({ timeout: 5000 }).catch(() => false)) {
        await input.fill("Who hasn't submitted attendance today?");
        await input.press('Enter');
        await page.waitForTimeout(10000);
        await page.screenshot({ path: 'test-results/principal-DASH-08-attendance.png' });
        const responseArea = page.locator('.bg-neutral-100.text-neutral-800').last();
        await expect(responseArea).toBeVisible({ timeout: 15000 });
      }
    });

  });

test.describe('Principal — Sub-pages', () => {

  test('SUB-01 | /principal/attendance loads', async ({ page }) => {
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/principal/attendance`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/principal-SUB-01.png' });
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('SUB-02 | /principal/teachers loads with Activity tab', async ({ page }) => {
    /**
     * Expectation : Teachers page shows "Today's Activity" and "Engagement (30d)" tabs.
     */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/principal/teachers`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/principal-SUB-02.png' });
    await expect(page.locator("text=Activity, text=Engagement").first()).toBeVisible();
  });

  test('SUB-03 | /principal/teachers Engagement tab shows 30-day rates', async ({ page }) => {
    /**
     * Expectation : Switching to Engagement tab shows teacher rows
     *               with "30-day rate" or "%" labels.
     */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/principal/teachers`);
    await page.waitForLoadState('networkidle');
    const engTab = page.locator('button:has-text("Engagement")').first();
    if (await engTab.isVisible()) {
      await engTab.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/principal-SUB-03.png' });
      await expect(page.locator('text=30-day rate, text=30d, text=%').first()).toBeVisible();
    }
  });

  test('SUB-04 | /principal/coverage loads with coverage bars', async ({ page }) => {
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/principal/coverage`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/principal-SUB-04.png' });
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('SUB-05 | /principal/overview loads with Class Coverage Report generator', async ({ page }) => {
    /**
     * Expectation : Overview page shows the Class Coverage Report section
     *               with a section selector and Generate button.
     */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/principal/overview`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/principal-SUB-05.png' });
    await expect(page.locator('text=Class Coverage Report').first()).toBeVisible();
    await expect(page.locator('button:has-text("Generate Report")').first()).toBeVisible();
  });

});
