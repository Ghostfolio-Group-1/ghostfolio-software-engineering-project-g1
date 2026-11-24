import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { DashboardOverviewPage } from '../src/lib/dashboard-page/dashboard-overview-page';
import { requestApi } from '../src/lib/data/api-request';
import { createIntegrationSession, INTEGRATION_API_URL } from './api-session';
import type { IntegrationSession } from './api-session';
import taxDownPortfolio from './fixtures/tax-down-portfolio.json';

// Unified Dashboard across Risk, Tax and Charts on the running API (QA plan
// A4, Wed Nov 18). Real responses, shared harness, no mocks.

// Worked out by hand from fixtures/portfolio.json, not from the code:
// GF_INT_ALPHA 10 bought - 4 sold = 6 left x 130 = 780
// GF_INT_BETA  5 bought             = 5 left x  55 = 275
// Portfolio total                                   = 1055 USD
const EXPECTED_PORTFOLIO_TOTAL = 1055;

const OVERVIEW_PATH = '/api/v1/dashboard/overview';
const RISK_CONCENTRATION_PATH = '/api/v1/risk/concentration';
// Same range the dashboard uses (DASHBOARD_CHART_RANGE in the API).
const CHART_SERIES_PATH = '/api/v1/charts/series?range=1y';

// Concentration buckets carry percentages only, so Risk's money total comes
// from POST /risk/what-if (portfolio.valueBefore), the one Risk route that
// returns it.
type RiskConcentration = Record<string, unknown>;

interface Holdings {
  holdings: { assetProfile: { dataSource: string; symbol: string } }[];
}

interface WhatIf {
  portfolio: { valueBefore: { amount: number; currency: string } };
}

interface ChartSeries {
  kind: string;
  points: { date: string; value: number }[];
}

type Section<T> =
  | { data: T; status: 'available' }
  | { error: { code: string; message: string }; status: 'unavailable' };

interface Overview {
  charts: Section<ChartSeries>;
  risk: Section<RiskConcentration>;
  tax: Section<unknown>;
}

/** Risk's view of the portfolio total: the "before" value of a what-if. */
async function riskPortfolioTotal(session: IntegrationSession) {
  const holdingsResponse = await session.request(
    '/api/v1/portfolio/holdings?holdingType=ACTIVE',
    { method: 'GET' }
  );
  const { holdings } = (await holdingsResponse.json()) as Holdings;
  const { dataSource, symbol } = holdings[0].assetProfile;

  const whatIfResponse = await session.request('/api/v1/risk/what-if', {
    body: JSON.stringify({ dataSource, dropPercentage: 0.1, symbol }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST'
  });
  const { data } = (await whatIfResponse.json()) as { data: WhatIf };

  return data.portfolio.valueBefore;
}

function lastChartValue(series: ChartSeries) {
  return series.points[series.points.length - 1]?.value;
}

function availableData<T>(section: Section<T>): T {
  if (section.status !== 'available') {
    throw new Error(`Section unavailable: ${section.error.code}`);
  }

  return section.data;
}

const describeLive = INTEGRATION_API_URL ? describe : describe.skip;

describeLive('Unified Dashboard across Risk, Tax and Charts', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
  });

  async function render(element: ReactElement) {
    await act(async () => {
      root.render(element);
    });
  }

  /** Waits until no card is loading, then returns the rendered text. */
  async function settled() {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (!container.querySelector('[aria-busy="true"]')) {
        break;
      }

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
    }

    expect(container.querySelector('[aria-busy="true"]')).toBeNull();

    return container.textContent ?? '';
  }

  describe('all sources up (shared fixture portfolio)', () => {
    let session: IntegrationSession;

    beforeAll(async () => {
      session = await createIntegrationSession(INTEGRATION_API_URL as string);
    });

    it('shows the same portfolio total in Risk, Charts and the Dashboard', async () => {
      const [overview, riskConcentration, charts, riskTotal] =
        await Promise.all([
          requestApi<Overview>(session.request, OVERVIEW_PATH),
          requestApi<RiskConcentration>(
            session.request,
            RISK_CONCENTRATION_PATH
          ),
          requestApi<ChartSeries>(session.request, CHART_SERIES_PATH),
          riskPortfolioTotal(session)
        ]);

      expect(riskTotal).toEqual({
        amount: EXPECTED_PORTFOLIO_TOTAL,
        currency: 'USD'
      });
      expect(charts.kind).toBe('portfolioValue');
      expect(lastChartValue(charts)).toBe(EXPECTED_PORTFOLIO_TOTAL);
      expect(lastChartValue(availableData(overview.charts))).toBe(
        EXPECTED_PORTFOLIO_TOTAL
      );
      // The dashboard's risk section is the same data as the Risk route.
      expect(availableData(overview.risk)).toEqual(riskConcentration);
    });

    it('renders all three cards with no error and no partial-failure notice', async () => {
      await render(<DashboardOverviewPage request={session.request} />);

      await settled();

      expect(container.querySelectorAll('[role="alert"]')).toHaveLength(0);
      expect(
        container.querySelector('[data-testid="dashboard-partial-failure"]')
      ).toBeNull();
    });
  });

  describe('Tax source down (oversell makes the FIFO engine throw)', () => {
    let session: IntegrationSession;

    beforeAll(async () => {
      session = await createIntegrationSession(
        INTEGRATION_API_URL as string,
        taxDownPortfolio
      );
    });

    it('returns HTTP 200 with only the tax section unavailable', async () => {
      const response = await session.request(OVERVIEW_PATH, { method: 'GET' });
      const body = (await response.json()) as { data: Overview; error: null };

      expect(response.status).toBe(200);
      expect(body.error).toBeNull();
      expect(body.data.tax).toEqual({
        error: {
          code: 'DASHBOARD_TAX_UNAVAILABLE',
          message: 'The tax section could not be loaded'
        },
        status: 'unavailable'
      });
      expect(body.data.risk.status).toBe('available');
      expect(body.data.charts.status).toBe('available');
      // The real engine error is logged, never returned.
      expect(JSON.stringify(body)).not.toMatch(/insufficient/i);
    });

    it('shows only the Tax card as unavailable while Risk and Performance render', async () => {
      await render(<DashboardOverviewPage request={session.request} />);

      const text = await settled();
      const alerts = container.querySelectorAll('[role="alert"]');
      const notice = container.querySelector(
        '[data-testid="dashboard-partial-failure"]'
      );

      expect(alerts).toHaveLength(1);
      expect(alerts[0].textContent).toContain(
        'The tax section could not be loaded'
      );
      expect(notice?.textContent).toContain('Tax could not be loaded');
      expect(text).not.toContain('The risk section could not be loaded');
      expect(text).not.toContain('The performance section could not be loaded');
    });
  });
});
