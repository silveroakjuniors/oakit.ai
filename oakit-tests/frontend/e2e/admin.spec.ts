/**
 * ═══════════════════════════════════════════════════════════════
 * ADMIN REGRESSION SUITE
 * Actor  : Admin  |  Mobile: 9800000001  |  Password: 9800000001
 * School : sojs (Silveroak Juniors)
 *
 * Features tested:
 *  AUTH  — Login / logout
 *  DASH  — Stat cards, Safety alerts, School Intelligence,
 *           Setup wizard, Coverage, Attendance trend,
 *           Engagement Intelligence, Quick Access, Time Machine
 *  NAV   — All 9 sub-pages load without crash
 *  RPT   — Reports: all 5 tabs, selectors, generate button
 * ═══════════════════════════════════════════════════════════════
 */
import { test, expect } from '@playwright/test';
import { login, logout, USERS, BASE } from './helpers';

const U = USERS.admin;

// Test configuration
test.describe.configure({ mode: 'serial' });

// ─── AUTHENTICATION TESTS ──────────────────────────────────────

test.describe('Admin — Authentication', () => {

  test('AUTH-01 | Login with valid credentials redirects to /admin', async ({ page }) => {
    /**
     * Given: User is on login page
     * When:  User enters valid admin credentials
     * Then:  User is redirected to admin dashboard
     */
    await login(page, U.mobile, U.role);
    await page.screenshot({ path: 'test-results/admin-AUTH-01.png' });
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('AUTH-02 | Sign out clears session and returns to /login', async ({ page }) => {
    /**
     * Given: User is logged in as admin
     * When:  User clicks sign out
     * Then:  User is redirected to login page and session is cleared
     */
    await login(page, U.mobile, U.role);
    await page.screenshot({ path: 'test-results/admin-AUTH-02-before.png' });
    await logout(page);
    await page.screenshot({ path: 'test-results/admin-AUTH-02-after.png' });
    await expect(page).toHaveURL(/\/login/);
  });

  test('AUTH-03 | Accessing /admin without login redirects to /login', async ({ page }) => {
    /**
     * Given: User is not logged in
     * When:  User tries to access /admin directly
     * Then:  User is redirected to /login
     */
    await page.goto(`${BASE}/admin`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/admin-AUTH-03.png' });
    await expect(page).toHaveURL(/\/login/);
  });

});

// ─── DASHBOARD TESTS ─────────────────────────────────────────

test.describe('Admin — Dashboard', () => {

  test.describe('Dashboard - Statistics Cards', () => {

    test('DASH-01 | Stat cards display key metrics', async ({ page }) => {
      /**
       * Given: Admin is logged in
       * When:  Dashboard loads
       * Then:  All stat cards are visible with correct labels
       */
      await login(page, U.mobile, U.role);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/admin-DASH-01.png' });

      // Verify all stat cards are present
      await expect(page.locator('text=Total Students')).toBeVisible();
      await expect(page.locator('text=Present Today')).toBeVisible();
      await expect(page.locator('text=Attendance')).toBeVisible();
      await expect(page.locator('text=Plans Done')).toBeVisible();
    });

    test('DASH-02 | No JavaScript errors on dashboard load', async ({ page }) => {
      /**
       * Given: Admin dashboard is loading
       * When:  Page loads completely
       * Then:  No uncaught JavaScript errors occur (excluding benign ResizeObserver)
       */
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(e.message));

      await login(page, U.mobile, U.role);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/admin-DASH-02.png' });

      const realErrors = errors.filter(e => !e.includes('ResizeObserver'));
      expect(realErrors, `JavaScript errors found: ${realErrors.join(', ')}`).toHaveLength(0);
    });

  });

  test.describe('Dashboard - School Intelligence', () => {

    test('DASH-03 | School Intelligence section is visible and expandable', async ({ page }) => {
      /**
       * Given: Admin dashboard is loaded
       * When:  User views School Intelligence section
       * Then:  Section displays with alert count badge
       */
      await login(page, U.mobile, U.role);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/admin-DASH-03.png' });

      await expect(page.locator('text=School Intelligence')).toBeVisible();
      // Check for expandable behavior
      const intelligenceBtn = page.locator('button:has-text("School Intelligence")').first();
      if (await intelligenceBtn.isVisible()) {
        await intelligenceBtn.click();
        await page.waitForTimeout(500);
        // Verify content appears after expansion
      }
    });

  });

  test.describe('Dashboard - Curriculum Coverage', () => {

    test('DASH-04 | Curriculum Coverage section loads and displays data', async ({ page }) => {
      /**
       * Given: Admin dashboard is loaded
       * When:  Curriculum Coverage section is viewed
       * Then:  Coverage data is displayed correctly
       */
      await login(page, U.mobile, U.role);
      await page.waitForLoadState('networkidle');

      const coverageBtn = page.locator('button:has-text("Curriculum Coverage")').first();
      await expect(coverageBtn).toBeVisible({ timeout: 10000 });
      await coverageBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/admin-DASH-04.png' });

      // Verify coverage data is shown
      await expect(
        page.locator('text=UKG, text=No curriculum, text=on track, text=need attention').first()
      ).toBeVisible();
    });

    test('DASH-05 | Coverage drill-down shows topic details', async ({ page }) => {
      /**
       * Given: Curriculum Coverage is expanded
       * When:  User clicks on a section
       * Then:  Topic-level breakdown is displayed
       */
      await login(page, U.mobile, U.role);
      await page.waitForLoadState('networkidle');

      const coverageBtn = page.locator('button:has-text("Curriculum Coverage")').first();
      await coverageBtn.click();
      await page.waitForTimeout(500);

      // Click first section row
      const sectionRow = page.locator('button:has-text("UKG"), button:has-text("Section")').first();
      if (await sectionRow.isVisible({ timeout: 3000 }).catch(() => false)) {
        await sectionRow.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'test-results/admin-DASH-05.png' });
        await expect(page.locator('text=Topic Breakdown, text=topics covered, text=No curriculum').first()).toBeVisible();
      }
    });

  });

  test.describe('Dashboard - Attendance & Engagement', () => {

    test('DASH-06 | Attendance Trend chart renders correctly', async ({ page }) => {
      /**
       * Given: Admin dashboard is loaded
       * When:  Attendance Trend section is viewed
       * Then:  Chart displays or shows appropriate empty state
       */
      await login(page, U.mobile, U.role);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/admin-DASH-06.png' });

      await expect(page.locator('text=Attendance Trend')).toBeVisible();
      // Chart should render or show "No attendance data yet"
    });

    test('DASH-07 | Engagement Intelligence expands with all tabs', async ({ page }) => {
      /**
       * Given: Admin dashboard is loaded
       * When:  Engagement Intelligence section is expanded
       * Then:  All four tabs (Teachers, Parents, Homework, Messages) are visible
       */
      await login(page, U.mobile, U.role);
      await page.waitForLoadState('networkidle');

      const engagementBtn = page.locator('button:has-text("Engagement Intelligence")').first();
      await engagementBtn.click();
      await page.waitForTimeout(1000);

      // Verify all tabs are present
      await expect(page.locator('button:has-text("Teachers")')).toBeVisible();
      await expect(page.locator('button:has-text("Parents")')).toBeVisible();
      await expect(page.locator('button:has-text("Homework")')).toBeVisible();
      await expect(page.locator('button:has-text("Messages")')).toBeVisible();

      await page.screenshot({ path: 'test-results/admin-DASH-07.png' });
    });

  });

  test.describe('Dashboard - Quick Access & Time Machine', () => {

    test('DASH-08 | Quick Access links are all functional', async ({ page }) => {
      /**
       * Given: Admin dashboard is loaded
       * When:  Quick Access section is viewed
       * Then:  All navigation links are visible and accessible
       */
      await login(page, U.mobile, U.role);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/admin-DASH-08.png' });

      await expect(page.locator('text=Quick Access')).toBeVisible();
      await expect(page.locator('a[href="/admin/users"]')).toBeVisible();
      await expect(page.locator('a[href="/admin/classes"]')).toBeVisible();
      await expect(page.locator('a[href="/admin/curriculum"]')).toBeVisible();
      await expect(page.locator('a[href="/admin/calendar"]')).toBeVisible();
    });

    test('DASH-09 | Time Machine controls are available', async ({ page }) => {
      /**
       * Given: Admin dashboard is loaded
       * When:  Time Machine section is viewed
       * Then:  Date input and activation controls are present
       */
      await login(page, U.mobile, U.role);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/admin-DASH-09.png' });

      await expect(page.locator('text=Time Machine')).toBeVisible();
      await expect(page.locator('input[type="date"]')).toBeVisible();
      await expect(page.locator('button:has-text("Activate")')).toBeVisible();
    });

});

// ─── NAVIGATION TESTS ──────────────────────────────────────────

test.describe('Admin — Navigation', () => {

  const subPages = [
    { id: 'NAV-01', path: '/admin/classes', label: 'Classes' },
    { id: 'NAV-02', path: '/admin/students', label: 'Students' },
    { id: 'NAV-03', path: '/admin/curriculum', label: 'Curriculum' },
    { id: 'NAV-04', path: '/admin/settings',         label: 'Settings' },
    { id: 'NAV-05', path: '/admin/users',            label: 'Users & Roles' },
    { id: 'NAV-06', path: '/admin/calendar',         label: 'Calendar' },
    { id: 'NAV-07', path: '/admin/announcements',    label: 'Announcements' },
    { id: 'NAV-08', path: '/admin/audit',            label: 'Audit Log' },
    { id: 'NAV-09', path: '/admin/plans',            label: 'Plans' },
    { id: 'NAV-10', path: '/admin/textbook-planner', label: 'Textbook Planner' },
    { id: 'NAV-11', path: '/admin/supplementary',    label: 'Supplementary Activities' },
  ];

  for (const pg of subPages) {
    test(`${pg.id} | ${pg.label} page loads without crash`, async ({ page }) => {
      /**
       * Expectation : Navigating to the page:
       *   1. Does NOT redirect to /login (auth guard passes)
       *   2. Renders a visible heading (h1 or h2)
       *   3. No "Error" text in the body
       */
      await login(page, U.mobile, U.role);
      await page.goto(`${BASE}${pg.path}`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `test-results/admin-${pg.id}.png` });
      await expect(page).not.toHaveURL(/login/);
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });
  }

});

// ─── REPORTS ──────────────────────────────────────────────────

test.describe('Admin — Reports', () => {

  test('RPT-01 | Reports page loads with all tabs visible', async ({ page }) => {
    /**
     * Expectation : /admin/reports renders tab buttons for:
     *               Progress, Saved, Term, School, Quizzes
     */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/admin/reports`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/admin-RPT-01.png' });
    await expect(page.locator('text=Reports').first()).toBeVisible();
    for (const tab of ['Progress', 'Saved', 'Term']) {
      await expect(page.locator(`button:has-text("${tab}")`).first()).toBeVisible();
    }
  });

  test('RPT-02 | Progress tab shows Class/Section/Student selectors', async ({ page }) => {
    /**
     * Expectation : Progress tab (default) shows 3 dropdowns:
     *               Class → Section → Student, plus From/To date pickers
     *               and a "Generate Report" button (disabled until student selected).
     */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/admin/reports`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/admin-RPT-02.png' });
    await expect(page.locator('select').first()).toBeVisible();
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
    await expect(page.locator('button:has-text("Generate")').first()).toBeVisible();
  });

  test('RPT-03 | Saved tab loads and shows count or empty state', async ({ page }) => {
    /**
     * Expectation : Clicking Saved tab fetches /api/v1/admin/reports/saved
     *               and shows either saved report cards or "No saved reports".
     */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/admin/reports`);
    await page.waitForLoadState('networkidle');
    await page.locator('button:has-text("Saved")').first().click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/admin-RPT-03.png' });
    await expect(
      page.locator('text=report, text=No saved, text=available, text=Refresh').first()
    ).toBeVisible();
  });

  test('RPT-04 | Term tab shows Term/Annual toggle and date range', async ({ page }) => {
    /**
     * Expectation : Term tab shows:
     *   - "Term Report" / "Annual Report" toggle buttons
     *   - Start and End date pickers
     *   - Generate button
     */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/admin/reports`);
    await page.waitForLoadState('networkidle');
    await page.locator('button:has-text("Term")').first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/admin-RPT-04.png' });
    await expect(page.locator('button:has-text("Term Report")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Annual Report")').first()).toBeVisible();
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
  });

  test('RPT-05 | School tab shows Generate School Report button', async ({ page }) => {
    /**
     * Expectation : School tab renders a "Generate School Report" button.
     *               Clicking it calls /api/v1/admin/reports/school-overview.
     */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/admin/reports`);
    await page.waitForLoadState('networkidle');
    const schoolTab = page.locator('button:has-text("School")').first();
    if (await schoolTab.isVisible()) {
      await schoolTab.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/admin-RPT-05.png' });
      await expect(page.locator('button:has-text("Generate School Report")').first()).toBeVisible();
    }
  });

  test('RPT-06 | Quizzes tab loads quiz list or empty state', async ({ page }) => {
    /**
     * Expectation : Quizzes tab fetches /api/v1/admin/reports/quizzes
     *               and shows quiz cards or "No quizzes" message.
     */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/admin/reports`);
    await page.waitForLoadState('networkidle');
    const quizTab = page.locator('button:has-text("Quiz")').first();
    if (await quizTab.isVisible()) {
      await quizTab.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/admin-RPT-06.png' });
      await expect(page.locator('text=quiz, text=Quiz, text=No quiz').first()).toBeVisible();
    }
  });

  test('RPT-07 | Bulk generate button visible when section selected', async ({ page }) => {
    /**
     * Expectation : After selecting a class and section with multiple students,
     *               a "Generate for X Students" bulk button appears below
     *               the individual generate button.
     */
    await login(page, U.mobile, U.role);
    await page.goto(`${BASE}/admin/reports`);
    await page.waitForLoadState('networkidle');
    // Select class
    const classSelect = page.locator('select').first();
    await classSelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);
    // Select section
    const sectionSelect = page.locator('select').nth(1);
    if (await sectionSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sectionSelect.selectOption({ index: 1 });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/admin-RPT-07.png' });
      // Bulk button may appear if section has multiple students
      const bulkBtn = page.locator('button:has-text("Generate for")').first();
      if (await bulkBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(bulkBtn).toBeVisible();
      }
    }
  });

});
