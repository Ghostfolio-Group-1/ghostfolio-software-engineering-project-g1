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
//
// Per Tharun's review on PR #320: the what-if endpoint's own
// portfolio.valueBefore/After ($10,640/$6,140) don't agree with the
// documented fixture total ($10,140/$5,640 off AAPL+MSFT+cash) - tracked
// separately as #323, not fixed here (today's task is coverage, not a bug
// fix). Rather than hardcode either disputed total as "correct", this test
// asserts the one invariant that holds regardless of which total is right
// (the shock itself is exactly $4,500 - half of AAPL's $9,000), and
// verifies the UI renders exactly what the real API returned for this
// account, by calling the same POST /risk/what-if directly and comparing.
const SCREENSHOT_DIR = join(__dirname, '..', 'screenshots');
const AAPL_VALUE_BEFORE = 9000;
const DROP_PERCENTAGE = 0.5;

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

  // Per Tharun's review: wait for an authenticated-only UI element, not
  // just the dialog closing, before moving on - the account menu button
  // (header.component.html, @if (user())) only renders once the app has
  // actually finished applying the session, which can lag the dialog's own
  // close animation.
  await expect(
    page.locator('button:has(ion-icon[name="person-circle-outline"])')
  ).toBeVisible({ timeout: 15000 });
}

function formatMoney(amount: number, currency: string): string {
  return `${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`;
}

function formatPercentage(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
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

  // Verify UI/API consistency directly, rather than hardcoding a disputed
  // total: call the same POST /risk/what-if the form just called, using
  // the session's own auth token (same account, same cookies), and assert
  // the UI shows exactly what the API actually returned - whichever total
  // convention that turns out to use (see #323).
  const token = await page.evaluate(() =>
    window.sessionStorage.getItem('auth-token')
  );
  const apiResponse = await page.request.post('/api/v1/risk/what-if', {
    data: {
      dataSource: 'MANUAL',
      dropPercentage: DROP_PERCENTAGE,
      symbol: 'DEMO-AAPL'
    },
    headers: { Authorization: `Bearer ${token}` }
  });

  expect(apiResponse.ok()).toBe(true);

  const { data } = await apiResponse.json();

  await expect(resultCard).toContainText(
    formatMoney(
      data.portfolio.valueBefore.amount,
      data.portfolio.valueBefore.currency
    )
  );
  await expect(resultCard).toContainText(
    formatMoney(
      data.portfolio.valueAfter.amount,
      data.portfolio.valueAfter.currency
    )
  );
  await expect(resultCard).toContainText(
    `Holding allocation: ${formatPercentage(data.holding.allocationBefore)} → ${formatPercentage(data.holding.allocationAfter)}`
  );

  // The one invariant that holds regardless of which total is "right"
  // (#323): the shock itself is exactly half of AAPL's pre-shock value,
  // independent of MSFT/cash/whatever else the portfolio total includes.
  expect(data.holding.valueBefore.amount).toBe(AAPL_VALUE_BEFORE);
  expect(
    data.portfolio.valueBefore.amount - data.portfolio.valueAfter.amount
  ).toBeCloseTo(AAPL_VALUE_BEFORE * DROP_PERCENTAGE, 2);

  // Never a raw/unmapped error code reaching the page (same invariant
  // risk.spec.ts checks for the dashboard itself).
  await expect(page.getByText(/RISK_[A-Z_]+/)).toHaveCount(0);
});
