import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Issue #263: real-browser coverage of the mounted Angular -> React TaxWorkspace.
// Requires the *existing* synthetic seed users from seed-risk-demo-data.mts
// in a disposable local environment. No API routes, responses, or calculations
// are mocked. The browser's authenticated UI calls supply the API evidence.
// Do not take screenshots while the sign-in token is visible in the dialog.
const TAX_PAGE = '/en/portfolio/tax';
const TAX_API = '/api/v1/tax';
const FIXTURE_YEAR = '2026';

interface ApiEnvelope<T> {
  data: T | null;
  error: { code: string; message: string } | null;
}

interface TaxLot {
  consumedQuantity: string;
  lotId: string;
  originalQuantity: string;
  remainingQuantity: string;
  status: 'CLOSED' | 'OPEN' | 'PARTIALLY_CONSUMED';
}

interface TaxLotsData {
  lots: TaxLot[];
}

interface GainSale {
  grossCostBasis: string;
  grossProceeds: string;
  realizedGainAfterActivityFees: string;
  sellActivityId: string;
}

interface GainsData {
  method: 'AVERAGE_COST' | 'FIFO';
  sales: GainSale[];
}

interface DividendRecord {
  grossDividend: string;
  netDividend: string | null;
  sourceActivityId: string;
  withholdingTax: string | null;
}

interface DividendsData {
  records: DividendRecord[];
}

interface YearlyData {
  disposalCount: number;
  dividendCount: number;
  grossCostBasisBaseCurrency: string | null;
  grossProceedsBaseCurrency: string | null;
  grossRealizedGainBaseCurrency: string | null;
  method: 'AVERAGE_COST' | 'FIFO';
  year: number;
}

const viewButton = (page: Page, label: string) =>
  page
    .getByRole('group', { name: 'Tax analytics views' })
    .getByRole('button', { name: label, exact: true });

/** Observe the real response produced by a UI action, with no interception. */
async function requestFromAction<T>(
  page: Page,
  path: string,
  action: () => Promise<unknown>,
  query: Record<string, string> = {}
): Promise<T> {
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) => {
        const url = new URL(candidate.url());
        return (
          candidate.request().method() === 'GET' &&
          url.pathname === path &&
          Object.entries(query).every(
            ([key, value]) => url.searchParams.get(key) === value
          )
        );
      },
      { timeout: 30000 }
    ),
    action()
  ]);

  expect(response.status(), `${path} should return HTTP 200`).toBe(200);
  const envelope = (await response.json()) as ApiEnvelope<T>;
  expect(envelope.error, `${path} should not return an error`).toBeNull();
  expect(envelope.data, `${path} should include data`).not.toBeNull();
  return envelope.data as T;
}

async function signIn(page: Page, token: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Security Token').fill(token);
  await dialog.getByRole('button', { name: 'Sign in' }).click();
  await expect(dialog).toBeHidden({ timeout: 15000 });

  // Closing the token dialog happens before async login/user initialization.
  // Wait for the authenticated header instead of racing the AuthGuard.
  await expect(
    page.getByRole('link', { name: 'Portfolio', exact: true })
  ).toBeVisible({ timeout: 15000 });
}

async function openTaxWorkspace(page: Page) {
  // Exercise the actual Portfolio navigation tab.
  await page.goto('/en/portfolio');
  const taxTab = page.getByRole('tab', { name: 'Tax analytics' });
  await expect(taxTab).toBeVisible();
  const lots = await requestFromAction<TaxLotsData>(
    page,
    `${TAX_API}/lots`,
    () => taxTab.click()
  );
  await expect(page).toHaveURL(new RegExp(`${TAX_PAGE}$`));
  await expect(
    page.getByRole('heading', { name: 'Tax analytics' })
  ).toBeVisible();
  await expect(page.getByTestId('react-host-error')).toHaveCount(0);
  await expect(page.getByText('This section could not be loaded')).toHaveCount(
    0
  );
  await expect(viewButton(page, 'Tax lots')).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  return lots;
}

async function selectView<T>(
  page: Page,
  label: string,
  path: string,
  query: Record<string, string> = {}
): Promise<T> {
  const result = await requestFromAction<T>(
    page,
    path,
    () => viewButton(page, label).click(),
    query
  );
  await expect(viewButton(page, label)).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('region', { name: `${label} view` })
  ).toBeVisible();
  return result;
}

async function selectYear<T>(
  page: Page,
  path: string,
  year: string,
  method?: string
) {
  await page.getByLabel('Calendar year (UTC)').fill(year);
  const query: Record<string, string> = { year };
  if (method) query.method = method;
  return requestFromAction<T>(
    page,
    path,
    () => page.getByRole('button', { name: 'Load year' }).click(),
    query
  );
}

function findDataRow(page: Page, tableName: string, key: string) {
  const table = page.getByRole('table', { name: tableName });
  return table.locator('tbody tr').filter({
    has: page.getByRole('cell', { exact: true, name: key })
  });
}

function annualTotal(page: Page, label: string) {
  return page
    .getByRole('region', { name: 'Yearly summary view' })
    .locator('dt')
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator('xpath=following-sibling::dd');
}

test.describe('TaxWorkspace authenticated browser journeys (#263)', () => {
  // Live seeded portfolios can take longer than the 30-second Playwright default.
  test.describe.configure({ timeout: 120_000 });
  test('empty seeded user: four API-backed tabs and year selection', async ({
    page
  }) => {
    await signIn(page, 'demo-risk-empty');
    const lots = await openTaxWorkspace(page);

    expect(lots.lots).toEqual([]);
    await expect(page.getByText('No FIFO tax lots available')).toBeVisible();
    await expect(page.getByLabel('Cost-basis method')).toHaveValue('FIFO');
    await expect(
      page
        .getByLabel('Cost-basis method')
        .locator('option[value="AVERAGE_COST"]')
    ).toBeDisabled();

    const gains = await selectView<GainsData>(
      page,
      'Realized gains',
      `${TAX_API}/realized-gains`,
      { method: 'FIFO' }
    );
    expect(gains.sales).toEqual([]);
    await expect(page.getByText('No realized sales for FIFO.')).toBeVisible();

    const currentYear = String(new Date().getUTCFullYear());
    const dividends = await selectView<DividendsData>(
      page,
      'Dividend withholding',
      `${TAX_API}/dividends`,
      { year: currentYear }
    );
    expect(dividends.records).toEqual([]);
    await expect(
      page.getByText(`No tax-relevant dividend records for ${currentYear}.`)
    ).toBeVisible();

    const summary = await selectView<YearlyData>(
      page,
      'Yearly summary',
      `${TAX_API}/yearly-summary`,
      { method: 'FIFO', year: currentYear }
    );
    expect(summary.disposalCount).toBe(0);
    expect(summary.dividendCount).toBe(0);
    await expect(
      page.getByText(`No Tax activities for ${currentYear} using FIFO.`)
    ).toBeVisible();

    const alternateYear = currentYear === FIXTURE_YEAR ? '2025' : FIXTURE_YEAR;
    const alternate = await selectYear<YearlyData>(
      page,
      `${TAX_API}/yearly-summary`,
      alternateYear,
      'FIFO'
    );
    expect(alternate.year).toBe(Number(alternateYear));
    expect(alternate.disposalCount).toBe(0);
    await expect(
      page.getByText(`No Tax activities for ${alternateYear} using FIFO.`)
    ).toBeVisible();

    // Screenshot only after authentication, never while the token is entered.
    await test.info().attach('tax-empty-yearly.png', {
      body: await page.screenshot(),
      contentType: 'image/png'
    });
  });

  test('populated seeded user: lots, filters, methods, dividend nulls and 2026 totals', async ({
    page
  }) => {
    await signIn(page, 'demo-risk-rich');
    const lots = await openTaxWorkspace(page);
    expect(lots.lots.length).toBeGreaterThan(0);
    expect(lots.lots.some((lot) => lot.status === 'PARTIALLY_CONSUMED')).toBe(
      true
    );

    // Individual acquisition lots are FIFO-only; do not suggest that their
    // method selector can produce average-cost lots.
    await expect(
      page
        .getByLabel('Cost-basis method')
        .locator('option[value="AVERAGE_COST"]')
    ).toBeDisabled();

    const lotTable = page.getByRole('table', {
      name: 'FIFO acquisition lots, ordered by acquisition date'
    });
    const openLots = lots.lots.filter((lot) => lot.status !== 'CLOSED');
    await expect(page.getByLabel('Lot status')).toHaveValue('OPEN');
    await expect(lotTable.locator('tbody tr')).toHaveCount(openLots.length);

    const firstLot = openLots[0];
    const lotRow = findDataRow(
      page,
      'FIFO acquisition lots, ordered by acquisition date',
      firstLot.lotId
    );
    await expect(lotRow).toHaveCount(1);
    await expect(lotRow.locator('td').nth(3)).toHaveText(
      firstLot.originalQuantity
    );
    await expect(lotRow.locator('td').nth(4)).toHaveText(
      firstLot.consumedQuantity
    );
    await expect(lotRow.locator('td').nth(5)).toHaveText(
      firstLot.remainingQuantity
    );

    await page.getByLabel('Lot status').selectOption('ALL');
    await expect(lotTable.locator('tbody tr')).toHaveCount(lots.lots.length);

    const fifo = await selectView<GainsData>(
      page,
      'Realized gains',
      `${TAX_API}/realized-gains`,
      { method: 'FIFO' }
    );
    expect(fifo.method).toBe('FIFO');
    expect(fifo.sales.length).toBeGreaterThan(0);
    const firstFifoSale = fifo.sales[0];
    const fifoRow = findDataRow(
      page,
      'Realized-gain amounts provided by the Tax API',
      firstFifoSale.sellActivityId
    );
    await expect(fifoRow.locator('td').nth(5)).toHaveText(
      firstFifoSale.grossProceeds
    );
    await expect(fifoRow.locator('td').nth(6)).toHaveText(
      firstFifoSale.grossCostBasis
    );
    await expect(fifoRow.locator('td').nth(10)).toHaveText(
      firstFifoSale.realizedGainAfterActivityFees
    );

    const average = await requestFromAction<GainsData>(
      page,
      `${TAX_API}/realized-gains`,
      () => page.getByLabel('Cost-basis method').selectOption('AVERAGE_COST'),
      { method: 'AVERAGE_COST' }
    );
    expect(average.method).toBe('AVERAGE_COST');
    expect(average.sales.length).toBeGreaterThan(0);
    const firstAverageSale = average.sales[0];
    const averageRow = findDataRow(
      page,
      'Realized-gain amounts provided by the Tax API',
      firstAverageSale.sellActivityId
    );
    await expect(averageRow.locator('td').nth(5)).toHaveText(
      firstAverageSale.grossProceeds
    );
    await expect(averageRow.locator('td').nth(6)).toHaveText(
      firstAverageSale.grossCostBasis
    );
    await expect(averageRow.locator('td').nth(10)).toHaveText(
      firstAverageSale.realizedGainAfterActivityFees
    );

    const initialYear = String(new Date().getUTCFullYear());
    let dividends = await selectView<DividendsData>(
      page,
      'Dividend withholding',
      `${TAX_API}/dividends`,
      { year: initialYear }
    );
    if (initialYear !== FIXTURE_YEAR) {
      dividends = await selectYear<DividendsData>(
        page,
        `${TAX_API}/dividends`,
        FIXTURE_YEAR
      );
    }
    expect(dividends.records.length).toBeGreaterThan(0);
    const dividend = dividends.records[0];
    const dividendRow = findDataRow(
      page,
      'Dividend amounts from the Tax record',
      dividend.sourceActivityId
    );
    await expect(dividendRow.locator('td').nth(3)).toHaveText(
      dividend.grossDividend
    );
    await expect(dividendRow.locator('td').nth(4)).toHaveText(
      dividend.withholdingTax ?? 'Not available'
    );
    await expect(dividendRow.locator('td').nth(5)).toHaveText(
      dividend.netDividend ?? 'Not available'
    );

    let yearly = await selectView<YearlyData>(
      page,
      'Yearly summary',
      `${TAX_API}/yearly-summary`,
      { method: 'FIFO', year: initialYear }
    );
    if (initialYear !== FIXTURE_YEAR) {
      yearly = await selectYear<YearlyData>(
        page,
        `${TAX_API}/yearly-summary`,
        FIXTURE_YEAR,
        'FIFO'
      );
    }
    expect(yearly.year).toBe(2026);
    expect(yearly.method).toBe('FIFO');
    expect(yearly.disposalCount).toBeGreaterThan(0);
    await expect(
      page.getByRole('heading', { name: 'Yearly Tax summary — 2026' })
    ).toBeVisible();

    // Compare decimal strings from the actual authenticated HTTP response;
    // no frontend recomputation, mixing currencies, or null -> zero coercion.
    await expect(annualTotal(page, 'Gross proceeds')).toHaveText(
      yearly.grossProceedsBaseCurrency ?? 'Not available'
    );
    await expect(annualTotal(page, 'Gross cost basis')).toHaveText(
      yearly.grossCostBasisBaseCurrency ?? 'Not available'
    );
    await expect(annualTotal(page, 'Gross realized gain')).toHaveText(
      yearly.grossRealizedGainBaseCurrency ?? 'Not available'
    );
    await expect(
      page.getByText(`Disposals: ${yearly.disposalCount}.`, { exact: false })
    ).toBeVisible();

    await test.info().attach('tax-populated-yearly-2026.png', {
      body: await page.screenshot(),
      contentType: 'image/png'
    });
  });
});
