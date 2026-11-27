import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

import fixture from '../../libs/react-ui/integration/fixtures/portfolio.json';

// Browser journey for the two Charts sprint tasks shipped in one PR:
// 1. Integration already covers series -> toggles -> drawdown against the
//    live API (libs/react-ui/integration/charts-journey.integration.tsx).
// 2. This file is the end-to-end walk: open chart -> change range -> toggle
//    series -> drawdown on /en/home.
//
// BLOCKED on this journey (annotated on the test):
// - Benchmark comparison: React card and GET /charts/benchmark-comparison
//   are still on open PR #160.
// - Return comparison: GET /charts/return-comparison is still on open PR #105;
//   there is no React screen for it on main.

const HOME_PAGE = '/en/home';
const HOST_FALLBACK = 'This section could not be loaded';
const EXPECTED_PORTFOLIO_VALUE = 1055;

interface ApiEnvelope<T> {
  data: T | null;
  error: { code: string; message: string } | null;
}

interface ChartSeries {
  kind: string;
  points: { date: string; value: number }[];
}

interface DrawdownPoint {
  drawdown: number;
  isNewPeak: boolean;
}

interface Drawdown {
  maxDrawdown: number;
  maxDrawdownDate: string;
  points: DrawdownPoint[];
}

async function createUserWithPortfolio(request: APIRequestContext) {
  const userResponse = await request.post('/api/v1/user', { data: {} });

  expect(userResponse.ok()).toBeTruthy();

  // API calls need authToken; the sign-in dialog uses accessToken (same as
  // e2e/tests/dashboard.spec.ts). Using accessToken for Authorization makes
  // POST /import return 401 and fails createUserWithPortfolio.
  const { accessToken, authToken } = (await userResponse.json()) as {
    accessToken: string;
    authToken: string;
  };
  const runId = Date.now().toString(36).toUpperCase();
  const symbolFor = (symbol: string) => `${symbol}_${runId}`;
  const headers = { Authorization: `Bearer ${authToken}` };

  const importResponse = await request.post('/api/v1/import', {
    data: {
      activities: fixture.activities.map((activity) => ({
        ...activity,
        symbol: symbolFor(activity.symbol)
      }))
    },
    headers
  });

  expect(importResponse.ok()).toBeTruthy();

  for (const [symbol, marketData] of Object.entries(fixture.marketData)) {
    const priceResponse = await request.post(
      `/api/v1/market-data/MANUAL/${symbolFor(symbol)}`,
      { data: { marketData }, headers }
    );

    expect(priceResponse.ok()).toBeTruthy();
  }

  return accessToken;
}

async function signIn(page: Page, accessToken: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).first().click();

  const dialog = page.getByRole('dialog');

  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Security Token').fill(accessToken);
  await dialog.getByRole('button', { name: 'Sign in' }).click();
  await expect(dialog).toBeHidden({ timeout: 15000 });

  await expect(
    page.getByRole('link', { name: 'Portfolio', exact: true })
  ).toBeVisible({ timeout: 15000 });
}

async function responseFromAction<T>(
  page: Page,
  path: string,
  action: () => Promise<unknown>
): Promise<T> {
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.request().method() === 'GET' &&
        new URL(candidate.url()).pathname === path,
      { timeout: 30000 }
    ),
    action()
  ]);

  expect(response.status(), `${path} should return HTTP 200`).toBe(200);

  const envelope = (await response.json()) as ApiEnvelope<T>;

  expect(envelope.error, `${path} should not return an error`).toBeNull();

  return envelope.data as T;
}

async function expectNoHostErrors(page: Page) {
  await expect(page.getByTestId('react-host-error')).toHaveCount(0);
  await expect(page.getByText(HOST_FALLBACK)).toHaveCount(0);
}

test.describe('Charts browser journey', () => {
  test.describe.configure({ timeout: 120_000 });

  test('open chart -> change range -> toggle series -> drawdown', async ({
    page,
    request
  }) => {
    test.info().annotations.push({
      type: 'BLOCKED',
      description:
        'Benchmark comparison: screen and GET /api/v1/charts/benchmark-comparison are still on open PR #160.'
    });
    test.info().annotations.push({
      type: 'BLOCKED',
      description:
        'Return comparison: GET /api/v1/charts/return-comparison is still on open PR #105; no React screen on main.'
    });

    const errors: string[] = [];

    page.on('pageerror', (error) => errors.push(error.message));

    const accessToken = await createUserWithPortfolio(request);

    await signIn(page, accessToken);

    const seriesPromise = page.waitForResponse(
      (candidate) =>
        candidate.request().method() === 'GET' &&
        new URL(candidate.url()).pathname === '/api/v1/charts/series',
      { timeout: 30000 }
    );
    const drawdownPromise = page.waitForResponse(
      (candidate) =>
        candidate.request().method() === 'GET' &&
        new URL(candidate.url()).pathname === '/api/v1/charts/drawdown',
      { timeout: 30000 }
    );

    await page.goto(HOME_PAGE);

    const [seriesResponse, drawdownResponse] = await Promise.all([
      seriesPromise,
      drawdownPromise
    ]);

    expect(seriesResponse.status()).toBe(200);
    expect(drawdownResponse.status()).toBe(200);

    const seriesEnvelope =
      (await seriesResponse.json()) as ApiEnvelope<ChartSeries>;
    const drawdownEnvelope =
      (await drawdownResponse.json()) as ApiEnvelope<Drawdown>;

    expect(seriesEnvelope.error).toBeNull();
    expect(drawdownEnvelope.error).toBeNull();

    await expect(page.getByTestId('interactive-chart')).toBeVisible({
      timeout: 20000
    });
    await expect(page.getByTestId('drawdown-card')).toBeVisible();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, {
      timeout: 20000
    });
    await expectNoHostErrors(page);

    await expect(
      page.getByRole('button', { name: 'Max', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      seriesEnvelope.data?.points[seriesEnvelope.data.points.length - 1]?.value
    ).toBe(EXPECTED_PORTFOLIO_VALUE);

    // Change range: Max -> YTD. Both series and drawdown refetch for that range.
    const ytdSeries = await responseFromAction<ChartSeries>(
      page,
      '/api/v1/charts/series',
      () => page.getByRole('button', { name: 'YTD', exact: true }).click()
    );

    await expect(
      page.getByRole('button', { name: 'YTD', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('button', { name: 'Max', exact: true })
    ).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, {
      timeout: 20000
    });
    expect(ytdSeries.kind).toBe('portfolioValue');
    expect(ytdSeries.points[ytdSeries.points.length - 1]?.value).toBe(
      EXPECTED_PORTFOLIO_VALUE
    );

    // Toggle series: portfolio value -> invested capital -> cash.
    // Overview mounts InteractiveChart with embedded=true, which hides the
    // "Showing …" kind label — assert pressed state on the toggle instead.
    await responseFromAction<ChartSeries>(page, '/api/v1/charts/series', () =>
      page
        .getByRole('button', { name: 'Invested capital', exact: true })
        .click()
    );

    await expect(
      page.getByRole('button', { name: 'Invested capital', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('button', { name: 'Portfolio value', exact: true })
    ).toHaveAttribute('aria-pressed', 'false');

    const cashSeries = await responseFromAction<ChartSeries>(
      page,
      '/api/v1/charts/series',
      () => page.getByRole('button', { name: 'Cash', exact: true }).click()
    );

    await expect(
      page.getByRole('button', { name: 'Cash', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(cashSeries.kind).toBe('cash');
    expect(cashSeries.points.every((point) => point.value === 0)).toBe(true);

    // Drawdown stays on the shared YTD range after the kind toggles.
    await expect(page.getByTestId('drawdown-max')).toContainText(
      'Max drawdown'
    );
    await expect(page.getByTestId('drawdown-max')).toContainText('0.00%');
    await expect(page.getByTestId('drawdown-short-history')).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expectNoHostErrors(page);

    expect(errors).toEqual([]);
  });
});
