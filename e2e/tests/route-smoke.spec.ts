import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Browser smoke test for every route that mounts a React screen through
// gf-react-host (#266). Runs against a production build (the demo image), so
// it catches the class of bug from #264: the host failing to mount anything
// even though every unit test passes. No seed data needed: each run signs up
// its own user through the API and signs in through the real header dialog.
//
// Add a route here when a new screen is mounted (e.g. Portfolio → Tax, #262).
const ROUTES = [
  {
    // Unified Dashboard: Risk, Tax and Performance cards (#68)
    path: '/en/dashboard',
    ready: (page: Page) =>
      page.getByRole('heading', { name: 'Portfolio overview' })
  },
  {
    // Risk dashboard (#260)
    path: '/en/risk',
    ready: (page: Page) => page.getByTestId('risk-score-value')
  }
];

const HOST_FALLBACK = 'This section could not be loaded';

async function signUpAndSignIn(page: Page) {
  const response = await page.request.post('/api/v1/user', { data: {} });

  expect(response.ok()).toBeTruthy();

  const { accessToken } = (await response.json()) as { accessToken: string };

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).first().click();

  const dialog = page.getByRole('dialog');

  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Security Token').fill(accessToken);
  await dialog.getByRole('button', { name: 'Sign in' }).click();
  await expect(dialog).toBeHidden({ timeout: 15000 });
}

test.describe('Every React route mounts in the production build', () => {
  for (const route of ROUTES) {
    test(route.path, async ({ page }) => {
      await signUpAndSignIn(page);

      // Collected only for this route's page load, after sign-in.
      const errors: string[] = [];

      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') {
          errors.push(message.text());
        }
      });

      await page.goto(route.path);

      await expect(route.ready(page)).toBeVisible({ timeout: 20000 });
      await expect(page.getByTestId('react-host-error')).toHaveCount(0);
      await expect(page.getByText(HOST_FALLBACK)).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }
});
