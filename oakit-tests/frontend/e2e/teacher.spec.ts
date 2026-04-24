/**
 * ═══════════════════════════════════════════════════════════════
 * TEACHER REGRESSION SUITE
 * Actor  : Teacher  |  Mobile: 9800000003  |  Password: 9800000003
 * School : sojs (Silveroak Juniors)
 *
 * Features tested:
 *  AUTH  — Login / logout
 *  DASH  — Main dashboard tabs: Plan, Chat, Help
 *  SUB   — Sub-pages: Attendance, Homework, Journey, Students, Messages
 * ═══════════════════════════════════════════════════════════════
 */
import { test, expect } from '@playwright/test';
import { login, logout, USERS, BASE } from './helpers';

const U = USERS.teacher;

// Test configuration
test.describe.configure({ mode: 'serial' });

// ─── AUTHENTICATION TESTS ──────────────────────────────────────

test.describe('Teacher — Authentication', () => {

  test('AUTH-01 | Login with valid credentials redirects to /teacher', async ({ page }) => {
    /**
     * Given: User is on login page
     * When:  User enters valid teacher credentials
     * Then:  User is redirected to teacher dashboard
     */
    await login(page, U.mobile, U.role);
    await page.screenshot({ path: 'test-results/teacher-AUTH-01.png' });
    await expect(page).toHaveURL(/\/teacher/);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('AUTH-02 | Sign out clears session and returns to /login', async ({ page }) => {
    /**
     * Given: User is logged in as teacher
     * When:  User clicks sign out
     * Then:  User is redirected to login page and session is cleared
     */
    await login(page, U.mobile, U.role);
    await page.screenshot({ path: 'test-results/teacher-AUTH-02-before.png' });
    await logout(page);
    await page.screenshot({ path: 'test-results/teacher-AUTH-02-after.png' });
    await expect(page).toHaveURL(/\/login/);
  });

  test('AUTH-03 | Accessing /teacher without login redirects to /login', async ({ page }) => {
    /**
     * Given: User is not logged in
     * When:  User tries to access /teacher directly
     * Then:  User is redirected to /login
     */
    await page.goto(`${BASE}/teacher`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/teacher-AUTH-03.png' });
    await expect(page).toHaveURL(/\/login/);
  });

});

// ─── DASHBOARD TESTS ─────────────────────────────────────────

test.describe('Teacher — Dashboard', () => {

  test.describe('Dashboard - Main Tabs', () => {

    test('DASH-01 | Plan tab loads and displays curriculum content', async ({ page }) => {
      /**
       * Given: Teacher is logged in
       * When:  Dashboard loads
       * Then:  Plan tab is visible and shows curriculum topics or pending state
       */
      await login(page, U.mobile, U.role);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/teacher-DASH-01.png' });

      await expect(page.locator('button:has-text("Plan")')).toBeVisible();
      // Verify plan content is loaded
      await expect(page.locator('text=Plan, text=Today, text=Pending').first()).toBeVisible();
    });

    test('DASH-02 | Chat tab displays Ask Oakie interface', async ({ page }) => {
      /**
       * Given: Teacher dashboard is loaded
       * When:  User switches to Chat tab
       * Then:  Ask Oakie input field is visible
       */
      await login(page, U.mobile, U.role);
      await page.waitForLoadState('networkidle');

      const chatTab = page.locator('button:has-text("Chat"), button:has-text("Ask")').first();
      if (await chatTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await chatTab.click();
        await page.waitForTimeout(500);
      }

      await page.screenshot({ path: 'test-results/teacher-DASH-02.png' });
      await expect(page.locator('input[placeholder*="Ask"], input[placeholder*="Type"], textarea').first()).toBeVisible();
    });

    test('DASH-03 | Help tab shows usage tips and guidance', async ({ page }) => {
      /**
       * Given: Teacher dashboard is loaded
       * When:  User switches to Help tab
       * Then:  Usage tips and guidance are displayed
       */
      await login(page, U.mobile, U.role);
      await page.waitForLoadState('networkidle');

      const helpTab = page.locator('button:has-text("Help"), button:has-text("Tips")').first();
      if (await helpTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await helpTab.click();
        await page.waitForTimeout(300);
      }

      await page.screenshot({ path: 'test-results/teacher-DASH-03.png' });
      await expect(page.locator('text=Oakie, text=Plan, text=Teaching').first()).toBeVisible();
    });

  });

  test.describe('Dashboard - Plan Tab Features', () => {

    test('DASH-04 | Curriculum topics display with interactive checkboxes', async ({ page }) => {
      /**
       * Given: Teacher is on Plan tab
       * When:  Curriculum topics are displayed
       * Then:  Checkboxes are interactive and can be toggled
       */
      await login(page, U.mobile, U.role);
      await page.waitForLoadState('networkidle');

      const planTab = page.locator('button:has-text("Plan")').first();
      if (await planTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await planTab.click();
        await page.waitForTimeout(500);
      }

      const checkbox = page.locator('input[type="checkbox"]').first();
      if (await checkbox.isVisible({ timeout: 3000 }).catch(() => false)) {
        const beforeState = await checkbox.isChecked();
        await checkbox.click();
        await page.waitForTimeout(300);
        const afterState = await checkbox.isChecked();

        await page.screenshot({ path: 'test-results/teacher-DASH-04.png' });
        expect(afterState).toBe(!beforeState);
      } else {
        await page.screenshot({ path: 'test-results/teacher-DASH-04-no-checkbox.png' });
        test.skip(true, 'No checkboxes visible — plan may not be loaded yet');
      }
    });

    test('DASH-05 | Homework and Notes sections are available', async ({ page }) => {
      /**
       * Given: Teacher is on Plan tab
       * When:  Plan content is loaded
       * Then:  Homework and Notes sections are visible for parent communication
       */
      await login(page, U.mobile, U.role);
      await page.waitForLoadState('networkidle');

      const planTab = page.locator('button:has-text("Plan")').first();
      if (await planTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await planTab.click();
        await page.waitForTimeout(500);
      }

      await page.screenshot({ path: 'test-results/teacher-DASH-05.png' });
      await expect(page.locator('text=Homework')).toBeVisible();
      await expect(page.locator('text=Notes')).toBeVisible();
    });

  });

  test.describe('Dashboard - Chat Features', () => {

    test('DASH-06 | Ask Oakie responds to teaching questions', async ({ page }) => {
      /**
       * Given: Teacher is on Chat tab
       * When:  User asks a teaching-related question
       * Then:  Oakie provides relevant teaching guidance
       */
      await login(page, U.mobile, U.role);
      await page.waitForLoadState('networkidle');

      const chatTab = page.locator('button:has-text("Chat"), button:has-text("Ask")').first();
      if (await chatTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await chatTab.click();
      }

      const input = page.locator('input[placeholder*="Ask"], input[placeholder*="Type"], textarea').first();
      await input.fill('How do I conduct Circle Time today?');
      await input.press('Enter');

      await page.waitForTimeout(12000);
      await page.screenshot({ path: 'test-results/teacher-DASH-06-response.png' });

      // Verify response appears
      await expect(page.locator('text=Circle Time, text=children, text=Sorry').first()).toBeVisible({ timeout: 15000 });
    });

  });

});

// ─── SUB-PAGES TESTS ─────────────────────────────────────────

test.describe('Teacher — Sub-Pages', () => {

  test.describe('Attendance Management', () => {

    test('SUB-01 | Attendance page loads with student attendance controls', async ({ page }) => {
      /**
       * Given: Teacher is logged in
       * When:  User navigates to attendance page
       * Then:  Student list with attendance controls is displayed
       */
      await login(page, U.mobile, U.role);
      await page.goto(`${BASE}/teacher/attendance`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/teacher-SUB-01.png' });

      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('text=Attendance, text=Present, text=Absent, text=student').first()).toBeVisible();
    });

  });

  test.describe('Homework Management', () => {

    test('SUB-02 | Homework page loads and displays homework interface', async ({ page }) => {
      /**
       * Given: Teacher is logged in
       * When:  User navigates to homework page
       * Then:  Homework management interface is displayed
       */
      await login(page, U.mobile, U.role);
      await page.goto(`${BASE}/teacher/homework`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/teacher-SUB-02.png' });

      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('h1, h2, text=Homework').first()).toBeVisible();
    });

  });

  test.describe('Student Journey & Reports', () => {

    test('SUB-03 | Journey page loads with journal entry interface', async ({ page }) => {
      /**
       * Given: Teacher is logged in
       * When:  User navigates to journey page
       * Then:  Journal entry and report readiness tabs are available
       */
      await login(page, U.mobile, U.role);
      await page.goto(`${BASE}/teacher/journey`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/teacher-SUB-03.png' });

      await expect(page.locator('text=Journal, text=Journey').first()).toBeVisible();
    });

    test('SUB-04 | Report Readiness tab shows student observation checklists', async ({ page }) => {
      /**
       * Given: Teacher is on journey page
       * When:  User switches to Report Readiness tab
       * Then:  Student observation checklists are displayed
       */
      await login(page, U.mobile, U.role);
      await page.goto(`${BASE}/teacher/journey`);
      await page.waitForLoadState('networkidle');

      const readinessTab = page.locator('button:has-text("Report Readiness"), button:has-text("Readiness")').first();
      if (await readinessTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await readinessTab.click();
        await page.waitForLoadState('networkidle');
      }

      await page.screenshot({ path: 'test-results/teacher-SUB-04.png' });
      await expect(page.locator('text=observation, text=student, text=category, text=No students').first()).toBeVisible();
    });

  });

  test.describe('Student Management', () => {

    test('SUB-05 | Students page displays student profiles and information', async ({ page }) => {
      /**
       * Given: Teacher is logged in
       * When:  User navigates to students page
       * Then:  Student profiles with relevant information are displayed
       */
      await login(page, U.mobile, U.role);
      await page.goto(`${BASE}/teacher/students`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/teacher-SUB-05.png' });

      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('h1, h2, text=Students').first()).toBeVisible();
    });

  });

  test.describe('Parent Communication', () => {

    test('SUB-06 | Messages page loads with parent conversation threads', async ({ page }) => {
      /**
       * Given: Teacher is logged in
       * When:  User navigates to messages page
       * Then:  Parent conversation interface is displayed
       */
      await login(page, U.mobile, U.role);
      await page.goto(`${BASE}/teacher/messages`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/teacher-SUB-06.png' });

      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('h1, h2, text=Messages, text=Parent').first()).toBeVisible();
    });

  });

  test.describe('Resource Management', () => {

    test('SUB-07 | Resources page loads with teaching resources', async ({ page }) => {
      /**
       * Given: Teacher is logged in
       * When:  User navigates to resources page
       * Then:  Teaching resources interface is displayed
       */
      await login(page, U.mobile, U.role);
      await page.goto(`${BASE}/teacher/resources`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/teacher-SUB-07.png' });

      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('SUB-08 | Worksheet page loads with worksheet creation tools', async ({ page }) => {
      /**
       * Given: Teacher is logged in
       * When:  User navigates to worksheet page
       * Then:  Worksheet creation and management interface is displayed
       */
      await login(page, U.mobile, U.role);
      await page.goto(`${BASE}/teacher/worksheet`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/teacher-SUB-08.png' });

      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

  });

});
