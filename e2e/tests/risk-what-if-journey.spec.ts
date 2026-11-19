import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

// Thu Nov 19 task (Sprint Plan Rev 2 / QA Execution Plan A1): the full
// browser journey open Risk dashboard -> read indicators -> run a what-if,
// as one continuous flow (risk.spec.ts checks indicators per seeded user in
// isolation; this is the missing "then run a what-if" step on top of that).
// Uses the "concentrated" seeded demo user (scripts/seed-risk-demo-data.mts)
// since it's the only one with a real, documented single-stock position
// worth shocking: AAPL 50 @ $180 = $9,000, MSFT 2 @ $320 = $640, cash $500.
// The exact numbers below (including the portfolio-value vs. allocation%
// totals not agreeing with each other - the what-if endpoint's own
// portfolio.valueBefore/After include $500 the concentration/allocation
// calculation doesn't) were confirmed directly against this seeded
// account's real `POST /api/v1/risk/what-if` response for a 50% AAPL drop,
// not hand-derived - see the PR description for the raw response.
const SCREENSHOT_DIR = join(__dirname, '..', 'screenshots');

mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function screenshot(page: Page, step: string) {
  await page.screenshot({
    fullPage: true,
    path: join(SCREENSHOT_DIR, `what-if-journey-${step}.png`)
  });
}

async function signInWithToken(page: Page, token: string) {
  await page.goto('/');

  await page.getByRole('button', { name: 'Sign in' }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // No screenshot between filling the token and submitting (risk.spec.ts's
  // own convention): the field can render it as plain text, and these are
  // real login credentials even if fixed/documented ones.
  await dialog.getByLabel('Security Token').fill(token);

  await dialog.getByRole('button', { name: 'Sign in' }).click();
  await expect(dialog).toBeHidden({ timeout: 15000 });
}

test('Risk journey: open dashboard, read indicators, run a what-if (concentrated user)', async ({
  page
}) => {
  await signInWithToken(page, 'demo-risk-concentrated');
  await screenshot(page, '01-signed-in');

  // See risk.spec.ts for why the locale prefix is required on a fresh
  // navigation/typed URL.
  await page.goto('/en/risk');

  await expect(page.getByTestId('risk-score-value')).toBeVisible({
    timeout: 15000
  });
  await screenshot(page, '02-risk-dashboard-loaded');

  // Read the indicators: this account is calibrated RED (one stock ~90% of
  // holdings) - same accessible-name convention as risk.spec.ts
  // (RiskIndicator's aria-label, not fragile visible text matching).
  await expect(page.getByText('Grade F')).toBeVisible();
  await expect(
    page.getByRole('status', { name: 'Overall: Red' })
  ).toBeVisible();

  const warningsList = page.getByRole('list').filter({
    has: page.getByRole('status', { name: /: Red$/ })
  });

  await expect(warningsList.first()).toBeVisible();

  // Run a what-if: shock AAPL by 50%. The simulator is mounted further down
  // the same /risk page (RiskPage, issue #261) - no separate navigation.
  await page
    .getByLabel('Holding to shock')
    .selectOption({ label: 'Apple Inc. (DEMO-AAPL · MANUAL)' });
  await page.getByLabel('Drop percentage').fill('50');
  await screenshot(page, '03-what-if-form-filled');

  await page.getByRole('button', { name: 'Run simulation' }).click();

  const resultHeading = page.getByRole('heading', {
    name: /^Scenario: Apple Inc\. \(-50%\)$/
  });

  await expect(resultHeading).toBeVisible({ timeout: 15000 });
  await screenshot(page, '04-what-if-result');

  const resultCard = resultHeading.locator('xpath=ancestor::section[1]');

  await expect(resultCard).toContainText('10,640 USD');
  await expect(resultCard).toContainText('6,140 USD');
  await expect(resultCard).toContainText('Holding allocation: 88.8% → 79.8%');

  // Never a raw/unmapped error code reaching the page (same invariant
  // risk.spec.ts checks for the dashboard itself).
  await expect(page.getByText(/RISK_[A-Z_]+/)).toHaveCount(0);
});
