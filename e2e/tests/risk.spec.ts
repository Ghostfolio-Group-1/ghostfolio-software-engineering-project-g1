import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

// Browser E2E for the Risk module (/risk, mounted via gf-react-host - #260).
// Uses the four fixed demo users from scripts/seed-risk-demo-data.mts, which
// must already be seeded into whatever database the demo stack is running
// against (see e2e/README.md). Each one shows a different, real Risk
// dashboard state - this is not synthetic/mocked data, it's the actual API
// response for a seeded account.
const SCREENSHOT_DIR = join(__dirname, '..', 'screenshots');

mkdirSync(SCREENSHOT_DIR, { recursive: true });

interface DemoUser {
  description: string;
  loginToken: string;
  name: string;
}

const DEMO_USERS: DemoUser[] = [
  {
    description: 'one stock ~90% of holdings - every concentration bucket RED',
    loginToken: 'demo-risk-concentrated',
    name: 'concentrated'
  },
  {
    description: 'diversified portfolio - score 80 / grade B, no RED anywhere',
    loginToken: 'demo-risk-balanced',
    name: 'balanced'
  },
  {
    description: 'no holdings - every rule NO_DATA, score null',
    loginToken: 'demo-risk-empty',
    name: 'empty'
  },
  {
    description: 'target allocation configured and deviated from',
    loginToken: 'demo-risk-target',
    name: 'target'
  }
];

async function screenshot(page: Page, user: string, step: string) {
  await page.screenshot({
    fullPage: true,
    path: join(SCREENSHOT_DIR, `${user}-${step}.png`)
  });
}

async function signInWithToken(page: Page, user: string, token: string) {
  await page.goto('/');
  await screenshot(page, user, '01-landing');

  await page.getByRole('button', { name: 'Sign in' }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await screenshot(page, user, '02-sign-in-dialog');

  await dialog.getByLabel('Security Token').fill(token);
  await screenshot(page, user, '03-token-entered');

  await dialog.getByRole('button', { name: 'Sign in' }).click();
  await expect(dialog).toBeHidden({ timeout: 15000 });
  await screenshot(page, user, '04-signed-in');
}

for (const user of DEMO_USERS) {
  test(`Risk dashboard - ${user.name} (${user.description})`, async ({
    page
  }) => {
    await signInWithToken(page, user.name, user.loginToken);

    // A fresh full-page navigation needs the locale prefix the Angular build
    // serves under (/en, /es, ...) - only the bare "/" auto-redirects to it.
    // Same for every other route in this app, not specific to /risk.
    await page.goto('/en/risk');
    await screenshot(page, user.name, '05-risk-page-loading');

    // The card always settles with a visible score element (a number, or a
    // "-" dash when score is null); the empty user additionally shows an
    // "unavailable reason" message alongside the dash. Either way,
    // risk-score-value settling in means the card left its loading skeleton.
    await expect(page.getByTestId('risk-score-value')).toBeVisible({
      timeout: 15000
    });

    await screenshot(page, user.name, '06-risk-page-loaded');

    // Never a generic error card ("Risk data is unavailable") for a seeded
    // demo user - that would mean the route or the API is actually broken,
    // not just a NO_DATA state (which is its own, different, visible text).
    await expect(page.getByText('Risk data is unavailable')).toHaveCount(0);

    // No raw/unmapped error code or stack trace ever reaches the page.
    await expect(page.getByText(/RISK_[A-Z_]+/)).toHaveCount(0);
  });
}
