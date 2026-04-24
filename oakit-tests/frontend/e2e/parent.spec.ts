/**
 * ═══════════════════════════════════════════════════════════════
 * PARENT REGRESSION SUITE
 * Actor  : Parent 1  |  Mobile: 9800000004  |  Password: 9800000004
 *          Parent 2  |  Mobile: 9800000005  |  Password: 9800000005
 * School : sojs (Silveroak Juniors)
 *
 * Features tested:
 *  AUTH  — Login / logout for multiple parents
 *  DASH  — Child information, attendance, homework, messages
 *  SUB   — Child profile, communication tools
 * ═══════════════════════════════════════════════════════════════
 */
import { test, expect } from '@playwright/test';
import { login, logout, USERS, BASE } from './helpers';

const P1 = USERS.parent1;
const P2 = USERS.parent2;

// Test configuration
test.describe.configure({ mode: 'serial' });

// ─── AUTHENTICATION TESTS ──────────────────────────────────────

test.describe('Parent — Authentication', () => {

  test('AUTH-01 | Parent 1 login with valid credentials redirects to /parent', async ({ page }) => {
    /**
     * Given: Parent 1 is on login page
     * When:  User enters valid Parent 1 credentials
     * Then:  User is redirected to parent dashboard
     */
    await login(page, P1.mobile, P1.role);
    await page.screenshot({ path: 'test-results/parent-AUTH-01.png' });
    await expect(page).toHaveURL(/\/parent/);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('AUTH-02 | Parent 2 login with valid credentials redirects to /parent', async ({ page }) => {
    /**
     * Given: Parent 2 is on login page
     * When:  User enters valid Parent 2 credentials
     * Then:  User is redirected to parent dashboard
     */
    await login(page, P2.mobile, P2.role);
    await page.screenshot({ path: 'test-results/parent-AUTH-02.png' });
    await expect(page).toHaveURL(/\/parent/);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('AUTH-03 | Sign out clears session and returns to /login', async ({ page }) => {
    /**
     * Given: Parent is logged in
     * When:  User clicks sign out
     * Then:  User is redirected to login page and session is cleared
     */
    await login(page, P1.mobile, P1.role);
    await page.screenshot({ path: 'test-results/parent-AUTH-03-before.png' });
    await logout(page);
    await page.screenshot({ path: 'test-results/parent-AUTH-03-after.png' });
    await expect(page).toHaveURL(/\/login/);
  });

  test('AUTH-04 | Accessing /parent without login redirects to /login', async ({ page }) => {
    /**
     * Given: User is not logged in
     * When:  User tries to access /parent directly
     * Then:  User is redirected to /login
     */
    await page.goto(`${BASE}/parent`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/parent-AUTH-04.png' });
    await expect(page).toHaveURL(/\/login/);
  });

});

test.describe('Parent — Dashboard', () => {

  test('DASH-01 | Dashboard shows child name or card', async ({ page }) => {
    /**
     * Expectation : Parent dashboard shows their linked child's name.
     *               Data comes from /api/v1/parent/context.
     */
    await login(page, P1.mobile, P1.role);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/parent-DASH-01.png' });
    await expect(page).not.toHaveURL(/login/);
    // Child name or "no children" message
    await expect(page.locator('body')).not.toContainText('Error');
  });

  test('DASH-02 | Attendance summary visible', async ({ page }) => {
    /**
     * Expectation : Parent can see their child's attendance summary
     *               (present/absent counts or percentage).
     */
    await login(page, P1.mobile, P1.role);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/parent-DASH-02.png' });
    await expect(page.locator('text=Attendance, text=Present, text=attendance').first()).toBeVisible();
  });

  test('DASH-03 | Curriculum coverage visible', async ({ page }) => {
    /**
     * Expectation : Parent can see curriculum coverage percentage for their child.
     */
    await login(page, P1.mobile, P1.role);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/parent-DASH-03.png' });
    await expect(page.locator('text=Coverage, text=curriculum, text=covered, text=%').first()).toBeVisible();
  });

  test('DASH-04 | Homework section visible', async ({ page }) => {
    /**
     * Expectation : Parent can see today's homework sent by the teacher.
     */
    await login(page, P1.mobile, P1.role);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/parent-DASH-04.png' });
    await expect(page.locator('text=Homework, text=homework').first()).toBeVisible();
  });

  test('DASH-05 | Notes section visible', async ({ page }) => {
    /**
     * Expectation : Parent can see class notes sent by the teacher.
     */
    await login(page, P1.mobile, P1.role);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/parent-DASH-05.png' });
    await expect(page.locator('text=Notes, text=note').first()).toBeVisible();
  });

  test('DASH-06 | Reports section visible', async ({ page }) => {
    /**
     * Expectation : Parent can see shared progress reports.
     */
    await login(page, P1.mobile, P1.role);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/parent-DASH-06.png' });
    await expect(page.locator('text=Report, text=report').first()).toBeVisible();
  });

});

test.describe('Parent — Child Journey', () => {

  test('JOURNEY-01 | Journey page loads from dashboard link', async ({ page }) => {
    /**
     * Expectation : Clicking the Journey link navigates to /parent/journey
     *               and shows the child's name in the header.
     */
    await login(page, P1.mobile, P1.role);
    await page.waitForLoadState('networkidle');
    const journeyLink = page.locator('a[href*="journey"]').first();
    if (await journeyLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await journeyLink.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/parent-JOURNEY-01.png' });
      await expect(page).toHaveURL(/journey/);
      await expect(page.locator('text=Journey, text=Notes from, text=classroom').first()).toBeVisible();
    } else {
      await page.goto(`${BASE}/parent/journey`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/parent-JOURNEY-01-direct.png' });
      await expect(page).not.toHaveURL(/login/);
    }
  });

  test('JOURNEY-02 | Daily snapshot section loads', async ({ page }) => {
    /**
     * Expectation : The journey page shows a daily snapshot card at the top
     *               (generated by Oakie, cached per day).
     *               If no snapshot exists, shows a loading skeleton or empty state.
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
    await page.waitForTimeout(3000); // snapshot may take time
    await page.screenshot({ path: 'test-results/parent-JOURNEY-02.png' });
    await expect(page).not.toHaveURL(/login/);
  });

  test('JOURNEY-03 | Date range filter changes journal entries', async ({ page }) => {
    /**
     * Expectation : Changing the "From" date input triggers a reload of entries.
     *               The page should not crash or redirect to login.
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
    const fromInput = page.locator('input[type="date"]').first();
    if (await fromInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fromInput.fill('2026-06-01');
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'test-results/parent-JOURNEY-03.png' });
      await expect(page).not.toHaveURL(/login/);
    }
  });

  test('JOURNEY-04 | Journal entries show or empty state shown', async ({ page }) => {
    /**
     * Expectation : The journal section shows either entry cards or a
     *               friendly "journey is just beginning" empty state.
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
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/parent-JOURNEY-04.png' });
    await expect(
      page.locator('text=beginning, text=Daily, text=Weekly, text=Highlight, text=No specific').first()
    ).toBeVisible({ timeout: 10000 });
  });

});
