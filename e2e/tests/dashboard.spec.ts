import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

import fixture from '../../libs/react-ui/integration/fixtures/portfolio.json';

// Unified Dashboard browser journey (QA plan A4, Thu Nov 19): sign in ->
// /dashboard -> each card -> that card's feature page. Real production build,
// real API, no route interception. Each test signs up its own user and imports
// its own portfolio, so no seed data is needed and runs never share data.
//
// Drill-down: the dashboard cards have no links to their feature pages yet,
// so the journey opens each feature page directly and checks it shows the
// same numbers as the card. Clicking from a card is BLOCKED until the cards
// get links (see the annotation on the test).

const DASHBOARD_PAGE = '/en/dashboard';
const HOST_FALLBACK = 'This section could not be loaded';

// Worked out by hand from libs/react-ui/integration/fixtures/portfolio.json:
// GF_INT_ALPHA 6 left x 130 = 780, GF_INT_BETA 5 x 55 = 275 -> 1055 USD.
// Realized gain (FIFO) = 480 - 400 - 0.40 buy fee share - 1 sell fee = 78.6.
const EXPECTED_PORTFOLIO_VALUE = 1055;
const EXPECTED_PORTFOLIO_VALUE_TEXT = '1,055.00';
const EXPECTED_REALIZED_GAIN = `${fixture.expected.realizedGainAfterActivityFees} ${fixture.expected.realizedGainCurrency}`;

// Sell 12 of 10 held: the FIFO tax engine throws for insufficient holdings,
// so only the dashboard's Tax section goes down.
const TAX_DOWN_ACTIVITIES = [
  { ...fixture.activities[0], fee: 0 },
  { ...fixture.activities[1], fee: 0 },
  { ...fixture.activities[2], fee: 0, quantity: 12 }
];

interface ApiEnvelope<T> {
  data: T | null;
  error: { code: string; message: string } | null;
}

type Section<T> =
  | { data: T; status: 'available' }
  | { error: { code: string; message: string }; status: 'unavailable' };

interface RiskBucket {
  name: string;
  percentage: number;
}

interface RiskConcentration {
  stock: { buckets: RiskBucket[] };
}

interface TaxSale {
  realizedGainAfterActivityFees: string;
  sellActivityId: string;
}

interface TaxGains {
  method: string;
  sales: TaxSale[];
}

interface ChartSeries {
  kind: string;
  points: { date: string; value: number }[];
}

interface Overview {
  charts: Section<ChartSeries>;
  risk: Section<RiskConcentration>;
  tax: Section<TaxGains>;
}

/** Signs up a fresh user and imports activities + prices under run-specific symbols. */
async function createUserWithPortfolio(
  request: APIRequestContext,
  activities: (typeof fixture)['activities']
) {
  const userResponse = await request.post('/api/v1/user', { data: {} });

  expect(userResponse.ok()).toBeTruthy();

  const { accessToken, authToken } = (await userResponse.json()) as {
    accessToken: string;
    authToken: string;
  };
  const headers = { Authorization: `Bearer ${authToken}` };
  const runId = Date.now().toString(36).toUpperCase();
  const symbolFor = (symbol: string) => `${symbol}_${runId}`;

  const importResponse = await request.post('/api/v1/import', {
    data: {
      activities: activities.map((activity) => ({
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

  // Wait for the authenticated header instead of racing the AuthGuard.
  await expect(
    page.getByRole('link', { name: 'Portfolio', exact: true })
  ).toBeVisible({ timeout: 15000 });
}

/** The real GET response a UI action triggers (observed, never intercepted). */
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

function available<T>(section: Section<T>): T {
  expect(section.status).toBe('available');

  return (section as { data: T }).data;
}

async function expectNoHostErrors(page: Page) {
  await expect(page.getByTestId('react-host-error')).toHaveCount(0);
  await expect(page.getByText(HOST_FALLBACK)).toHaveCount(0);
}

async function openDashboard(page: Page) {
  const overview = await responseFromAction<Overview>(
    page,
    '/api/v1/dashboard/overview',
    () => page.goto(DASHBOARD_PAGE)
  );

  await expect(
    page.getByRole('heading', { name: 'Portfolio overview' })
  ).toBeVisible({ timeout: 20000 });

  for (const title of ['Portfolio risk', 'Tax', 'Performance']) {
    await expect(
      page.getByRole('heading', { name: title, exact: true })
    ).toBeVisible();
  }

  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, {
    timeout: 20000
  });
  await expectNoHostErrors(page);

  return overview;
}

test.describe('Unified Dashboard browser journey', () => {
  test.describe.configure({ timeout: 120_000 });

  test('dashboard -> each card -> its feature page shows the same numbers', async ({
    page,
    request
  }) => {
    test.info().annotations.push({
      type: 'BLOCKED',
      description:
        'Click-through from a dashboard card: the cards have no links to their feature pages yet. Each feature page is opened directly instead.'
    });

    const errors: string[] = [];

    page.on('pageerror', (error) => errors.push(error.message));

    const accessToken = await createUserWithPortfolio(
      request,
      fixture.activities
    );

    await signIn(page, accessToken);

    // 1. Dashboard: all three cards load from one overview response.
    const overview = await openDashboard(page);
    const risk = available(overview.risk);
    const tax = available(overview.tax);
    const charts = available(overview.charts);

    await expect(page.locator('[role="alert"]')).toHaveCount(0);
    await expect(page.getByTestId('dashboard-partial-failure')).toHaveCount(0);

    // Tax card: exact decimal-string gain from the tax engine.
    expect(tax.method).toBe('FIFO');
    await expect(page.getByText(EXPECTED_REALIZED_GAIN).first()).toBeVisible();

    // Performance card: latest portfolio value.
    const latest = charts.points[charts.points.length - 1];

    expect(charts.kind).toBe('portfolioValue');
    expect(latest.value).toBe(EXPECTED_PORTFOLIO_VALUE);
    await expect(
      page.getByText(EXPECTED_PORTFOLIO_VALUE_TEXT).first()
    ).toBeVisible();
    await expect(
      page.getByText(`Portfolio value on ${latest.date}`)
    ).toBeVisible();

    // Risk card: each stock bucket's share, as the API sent it. Imported
    // MANUAL symbols may carry no asset class, so the bucket list can be empty.
    for (const bucket of risk.stock.buckets) {
      await expect(
        page.getByText(`${(bucket.percentage * 100).toFixed(1)}%`).first()
      ).toBeVisible();
    }

    // 2. Risk card -> Risk page: same concentration data as the card.
    const riskPage = await responseFromAction<RiskConcentration>(
      page,
      '/api/v1/risk/concentration',
      () => page.goto('/en/risk')
    );

    expect(riskPage).toEqual(risk);
    await expect(page.getByTestId('risk-score-value')).toBeVisible({
      timeout: 20000
    });
    await expectNoHostErrors(page);

    // 3. Tax card -> Portfolio > Tax analytics > Realized gains: same sales.
    await page.goto('/en/portfolio');
    await page.getByRole('tab', { name: 'Tax analytics' }).click();
    await expect(
      page.getByRole('heading', { name: 'Tax analytics' })
    ).toBeVisible({ timeout: 20000 });

    const gains = await responseFromAction<TaxGains>(
      page,
      '/api/v1/tax/realized-gains',
      () =>
        page
          .getByRole('group', { name: 'Tax analytics views' })
          .getByRole('button', { name: 'Realized gains', exact: true })
          .click()
    );

    expect(gains.sales).toEqual(tax.sales);
    await expect(
      page
        .getByRole('region', { name: 'Realized gains view' })
        .getByText(fixture.expected.realizedGainAfterActivityFees)
        .first()
    ).toBeVisible();
    await expectNoHostErrors(page);

    // 4. Performance card -> Home chart: same latest portfolio value.
    const series = await responseFromAction<ChartSeries>(
      page,
      '/api/v1/charts/series',
      () => page.goto('/en/home')
    );

    expect(series.points[series.points.length - 1].value).toBe(
      EXPECTED_PORTFOLIO_VALUE
    );
    await expect(page.getByTestId('interactive-chart')).toBeVisible({
      timeout: 20000
    });
    await expectNoHostErrors(page);

    expect(errors).toEqual([]);
  });

  test('Tax source down: only the Tax card fails, Risk and Performance still render', async ({
    page,
    request
  }) => {
    const accessToken = await createUserWithPortfolio(
      request,
      TAX_DOWN_ACTIVITIES
    );

    await signIn(page, accessToken);

    const overview = await openDashboard(page);

    expect(overview.tax).toEqual({
      error: {
        code: 'DASHBOARD_TAX_UNAVAILABLE',
        message: 'The tax section could not be loaded'
      },
      status: 'unavailable'
    });
    expect(overview.risk.status).toBe('available');
    expect(overview.charts.status).toBe('available');

    const alerts = page.locator('[role="alert"]');

    await expect(alerts).toHaveCount(1);
    await expect(alerts).toContainText('The tax section could not be loaded');
    await expect(page.getByTestId('dashboard-partial-failure')).toContainText(
      'Tax could not be loaded'
    );
    await expect(page.getByText('Portfolio value on')).toBeVisible();
  });
});
