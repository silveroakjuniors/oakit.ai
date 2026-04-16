# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: functional\admin.functional.spec.ts >> Admin Functional — Time Machine >> FN-TM-01 | Activate Time Machine to June 17 2026
- Location: tests\functional\admin.functional.spec.ts:14:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('input[type="tel"]') to be visible

```

# Page snapshot

```yaml
- generic [active]:
  - alert [ref=e1]
  - dialog [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - heading "Build Error" [level=1] [ref=e7]
        - paragraph [ref=e8]: Failed to compile
        - generic [ref=e9]:
          - text: Next.js (14.2.35) is outdated
          - link "(learn more)" [ref=e11] [cursor=pointer]:
            - /url: https://nextjs.org/docs/messages/version-staleness
      - generic [ref=e12]:
        - generic [ref=e13]:
          - link "./src/features/admin/AdminDashboardPage.premium.tsx" [ref=e14] [cursor=pointer]:
            - text: ./src/features/admin/AdminDashboardPage.premium.tsx
            - img [ref=e15]
          - generic [ref=e19]:
            - generic [ref=e20]: "Error:"
            - text: ×
            - generic [ref=e21]: "Unexpected token `div`. Expected jsx identifier ╭─["
            - generic [ref=e22]: D:\Silveroak Juniors Enquiry\SOJ Curriculum\oakit\apps\frontend\src\features\admin\AdminDashboardPage.premium.tsx
            - generic [ref=e23]: :211:1]
            - text: "211"
            - generic [ref=e24]: │ const upcomingBirthdays = birthdays.filter(b => b.days_until > 0);
            - text: "212"
            - generic [ref=e25]: │
            - text: "213"
            - generic [ref=e26]: │ return (
            - text: "214"
            - generic [ref=e27]: "│ <div className=\"min-h-screen\" style={{ background: 'var(--color-bg)' }}> ·"
            - generic [ref=e28]: ───
            - text: "215"
            - generic [ref=e29]: │
            - text: "216"
            - generic [ref=e30]: "│ {/* ── HERO HEADER ─────────────────────────────────────────── */}"
            - text: "216"
            - generic [ref=e31]: "│ <div className=\"relative overflow-hidden\" style={{ background: 'linear-gradient(135deg, #0f1f17 0%, #1a3c2e 40%, #2e7d5e 100%)' }}> ╰──── Caused by: Syntax Error"
        - contentinfo [ref=e32]:
          - paragraph [ref=e33]: This error occurred during the build process and can only be dismissed by fixing the error.
```

# Test source

```ts
  1  | import { Page, test } from '@playwright/test';
  2  | 
  3  | export const BASE = 'http://localhost:3000';
  4  | export const SCHOOL_CODE = 'sojs';
  5  | 
  6  | export const USERS = {
  7  |   admin:     { mobile: '9800000001', role: 'Admin' },
  8  |   principal: { mobile: '9800000002', role: 'Principal' },
  9  |   teacher:   { mobile: '9800000003', role: 'Teacher' },
  10 |   parent1:   { mobile: '9800000004', role: 'Parent 1' },
  11 |   parent2:   { mobile: '9800000005', role: 'Parent 2' },
  12 | };
  13 | 
  14 | /**
  15 |  * Login helper.
  16 |  * Uses localStorage pre-seed + native input events to ensure React state updates.
  17 |  */
  18 | export async function login(page: Page, mobile: string, roleName: string) {
  19 |   await test.step(`Login as ${roleName}`, async () => {
  20 |     // Pre-seed school code so the field is hidden on mount
  21 |     await page.goto(`${BASE}/login`);
  22 |     await page.evaluate((code) => localStorage.setItem('oakit_school_code', code), SCHOOL_CODE);
  23 |     await page.reload();
> 24 |     await page.waitForSelector('input[type="tel"]', { state: 'visible', timeout: 15000 });
     |                ^ TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
  25 |     await page.waitForTimeout(400);
  26 | 
  27 |     // Use evaluate to set React state directly via native input value setter
  28 |     await page.evaluate(({ m }) => {
  29 |       const tel = document.querySelector('input[type="tel"]') as HTMLInputElement;
  30 |       const pw  = document.querySelector('input[type="password"]') as HTMLInputElement;
  31 |       const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  32 |       nativeInputValueSetter.call(tel, m);
  33 |       tel.dispatchEvent(new Event('input', { bubbles: true }));
  34 |       nativeInputValueSetter.call(pw, m);
  35 |       pw.dispatchEvent(new Event('input', { bubbles: true }));
  36 |     }, { m: mobile });
  37 | 
  38 |     await page.waitForTimeout(200);
  39 | 
  40 |     // Submit
  41 |     await page.locator('button[type="submit"]').click();
  42 | 
  43 |     // Wait for redirect away from /login (API + brand fetch)
  44 |     await page.waitForURL(
  45 |       url => !url.toString().includes('/login') && !url.toString().includes('/auth'),
  46 |       { timeout: 30000 }
  47 |     );
  48 |     await page.waitForLoadState('domcontentloaded');
  49 |   });
  50 | }
  51 | 
  52 | export async function logout(page: Page) {
  53 |   await test.step('Sign out', async () => {
  54 |     const btn = page.locator('button:has-text("Sign out"), a:has-text("Sign out")').first();
  55 |     if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
  56 |       await btn.click();
  57 |       await page.waitForURL(/login/, { timeout: 10000 });
  58 |     }
  59 |   });
  60 | }
  61 | 
```