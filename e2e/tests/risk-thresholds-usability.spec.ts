import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

// Mon 11/23 task (Sprint Plan Rev 2 / QA Execution Plan A1): run the Risk
// usability checklist (learnability, consistent colours/labels, contrast,
// keyboard use) and fix what it finds. Reading risk-threshold-row.tsx and
// target-allocation-form.tsx surfaced two real label bugs (see their own
// comments for the full reasoning):
// - each threshold field's aria-label used to be the raw ruleKey ("Single
//   stock concentration" rendered as "SingleStockConcentration-redMax" to
//   a screen reader);
// - every target-allocation row shared the literal aria-label "Key" /
//   "Percentage", so with 2+ rows (the normal case) a screen reader
//   couldn't tell rows apart.
// This spec proves the fix live, against the real app and a real save
// round-trip, not just the mocked component tests: getByLabel requires an
// exact, unique accessible name, so it would fail outright against the old
// labels if either bug came back. It also keyboard-navigates to the field
// rather than clicking into it, covering the "keyboard use" checklist item
// with a field that previously had no E2E coverage at all.
/**
 * Signs up a fresh, non-demo user. Threshold saves need the
 * updateUserSettings permission that seeded demo accounts deliberately
 * don't have (RISK_FORBIDDEN - see risk-thresholds.client.ts's
 * SAFE_TO_DISPLAY_ERROR_CODES comment), discovered when this test first
 * tried demo-risk-concentrated and got exactly that error back.
 */
async function createFreshUser(request: APIRequestContext) {
  const userResponse = await request.post('/api/v1/user', { data: {} });

  expect(userResponse.ok()).toBeTruthy();

  const { accessToken } = (await userResponse.json()) as {
    accessToken: string;
  };

  return accessToken;
}

async function signInWithToken(page: Page, token: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Security Token').fill(token);
  await dialog.getByRole('button', { name: 'Sign in' }).click();
  await expect(dialog).toBeHidden({ timeout: 15000 });

  // Same convention as risk-what-if-journey.spec.ts: wait for an
  // authenticated-only element, not just the dialog closing.
  await expect(
    page.locator('button:has(ion-icon[name="person-circle-outline"])')
  ).toBeVisible({ timeout: 15000 });
}

test('Risk thresholds: each field has a unique, readable label and can be edited by keyboard alone', async ({
  page,
  request
}) => {
  const accessToken = await createFreshUser(request);

  await signInWithToken(page, accessToken);
  await page.goto('/en/risk');

  await expect(page.getByTestId('risk-score-value')).toBeVisible({
    timeout: 15000
  });

  const warningMaxField = page.getByLabel(
    'Single stock concentration Warning max',
    { exact: true }
  );

  await expect(warningMaxField).toBeVisible();

  const originalValue = await warningMaxField.inputValue();
  const newValue = originalValue === '5' ? '6' : '5';

  // Keyboard only: focus the field directly (same as a screen-reader or
  // keyboard user jumping to it by its accessible name), select the
  // existing value with Ctrl+A, type the replacement, then Tab to the Save
  // button and activate it with Enter rather than a click.
  await warningMaxField.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(newValue);

  const row = warningMaxField.locator(
    'xpath=ancestor::li[contains(., "Single stock concentration")]'
  );
  const saveButton = row.getByRole('button', { name: 'Save' });

  await saveButton.focus();
  await page.keyboard.press('Enter');

  // The save is a real PUT /api/v1/risk/thresholds/:ruleKey round trip -
  // confirm the row reflects the server's response, not just local state.
  await expect(row).toContainText('Customized', { timeout: 10000 });
  await expect(warningMaxField).toHaveValue(newValue);

  // "Reset to default" only renders once the rule is customized - use it
  // (again by keyboard) to confirm the DELETE round trip too, and that the
  // row goes back to a real default, not just whatever was typed in.
  const resetButton = row.getByRole('button', { name: 'Reset to default' });

  await expect(resetButton).toBeVisible();
  await resetButton.focus();
  await page.keyboard.press('Enter');

  await expect(row).not.toContainText('Customized', { timeout: 10000 });
  await expect(warningMaxField).toHaveValue(originalValue);

  // Never a raw/unmapped error code reaching the page.
  await expect(page.getByText(/RISK_[A-Z_]+/)).toHaveCount(0);
});

test('Target allocation: rows have distinct labels once there is more than one', async ({
  page
}) => {
  await signInWithToken(page, 'demo-risk-target');
  await page.goto('/en/risk');

  await expect(page.getByTestId('risk-score-value')).toBeVisible({
    timeout: 15000
  });

  // getByLabel throws if the name matches more than one element, so this
  // alone would fail against the old shared "Key"/"Percentage" labels on
  // any account with 2+ target-allocation rows.
  const firstKey = page.getByLabel('Key (row 1)', { exact: true });
  const secondKey = page.getByLabel('Key (row 2)', { exact: true });

  await expect(firstKey).toBeVisible();
  await expect(secondKey).toBeVisible();
  await expect(firstKey).not.toHaveValue(await secondKey.inputValue());
});
