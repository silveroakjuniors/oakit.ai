import { Page, test } from '@playwright/test';

export const BASE = 'http://localhost:3000';
export const SCHOOL_CODE = 'sojs';

export const USERS = {
  admin:     { mobile: '9800000001', role: 'Admin' },
  principal: { mobile: '9800000002', role: 'Principal' },
  teacher:   { mobile: '9800000003', role: 'Teacher' },
  parent1:   { mobile: '9800000004', role: 'Parent 1' },
  parent2:   { mobile: '9800000005', role: 'Parent 2' },
};

/**
 * Login helper.
 * Uses localStorage pre-seed + native input events to ensure React state updates.
 */
export async function login(page: Page, mobile: string, roleName: string) {
  await test.step(`Login as ${roleName}`, async () => {
    // Pre-seed school code so the field is hidden on mount
    await page.goto(`${BASE}/login`);
    await page.evaluate((code) => localStorage.setItem('oakit_school_code', code), SCHOOL_CODE);
    await page.reload();
    await page.waitForSelector('input[type="tel"]', { state: 'visible', timeout: 15000 });
    await page.waitForTimeout(400);

    // Use evaluate to set React state directly via native input value setter
    await page.evaluate(({ m }) => {
      const tel = document.querySelector('input[type="tel"]') as HTMLInputElement;
      const pw  = document.querySelector('input[type="password"]') as HTMLInputElement;
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      nativeInputValueSetter.call(tel, m);
      tel.dispatchEvent(new Event('input', { bubbles: true }));
      nativeInputValueSetter.call(pw, m);
      pw.dispatchEvent(new Event('input', { bubbles: true }));
    }, { m: mobile });

    await page.waitForTimeout(200);

    // Submit
    await page.locator('button[type="submit"]').click();

    // Wait for redirect away from /login (API + brand fetch)
    await page.waitForURL(
      url => !url.toString().includes('/login') && !url.toString().includes('/auth'),
      { timeout: 30000 }
    );
    await page.waitForLoadState('domcontentloaded');
  });
}

export async function logout(page: Page) {
  await test.step('Sign out', async () => {
    const btn = page.locator('button:has-text("Sign out"), a:has-text("Sign out")').first();
    if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await btn.click();
      await page.waitForURL(/login/, { timeout: 10000 });
    }
  });
}
