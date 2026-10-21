import { PortfolioService } from '@ghostfolio/api/app/portfolio/portfolio.service';
import {
  FIXTURE_BASE_CURRENCY,
  FIXTURE_USER_ID,
  holdingsFixture,
  performanceHistoryFixture
} from '@ghostfolio/api/testing/fixtures/portfolio.fixtures';

import { ChartsApi } from '../charts/charts-api';
import { ExposureService } from '../risk/exposure.service';
import { toRiskConcentrationResponse } from '../risk/risk-concentration.mapper';
import { TaxService } from '../tax/tax.service';
import { DASHBOARD_CHART_RANGE, DashboardOverview } from './dashboard-overview';

const mockRiskSection = { section: 'risk' };

jest.mock('../risk/risk-concentration.mapper', () => {
  return {
    parseConcentrationLimit: jest.fn(() => 5),
    toRiskConcentrationResponse: jest.fn(() => mockRiskSection)
  };
});

describe('DashboardOverview.getOverview', () => {
  const chartsSection = { section: 'charts' };
  const summary = { section: 'summary' };
  const taxSection = { method: 'FIFO', sales: [] };

  let getRiskSummary: jest.Mock;
  let getFifoRealizedGains: jest.Mock;
  let getHoldings: jest.Mock;
  let getPerformance: jest.Mock;
  let getSeries: jest.Mock;
  let overview: DashboardOverview;

  beforeEach(() => {
    jest.clearAllMocks();

    getRiskSummary = jest.fn().mockReturnValue(summary);
    getFifoRealizedGains = jest.fn().mockResolvedValue(taxSection);
    getHoldings = jest.fn().mockResolvedValue(holdingsFixture);
    getPerformance = jest.fn().mockResolvedValue({
      chart: performanceHistoryFixture,
      dateOfFirstActivity: new Date(2026, 0, 5)
    });
    getSeries = jest.fn().mockReturnValue(chartsSection);

    overview = new DashboardOverview(
      { getSeries } as unknown as ChartsApi,
      { getRiskSummary } as unknown as ExposureService,
      { getHoldings, getPerformance } as unknown as PortfolioService,
      { getFifoRealizedGains } as unknown as TaxService
    );
  });

  const load = () => {
    return overview.getOverview({
      baseCurrency: FIXTURE_BASE_CURRENCY,
      userId: FIXTURE_USER_ID
    });
  };

  it('places each source in its own section', async () => {
    await expect(load()).resolves.toEqual({
      charts: chartsSection,
      risk: mockRiskSection,
      tax: taxSection
    });
  });

  it('builds the risk section for the token user in their base currency', async () => {
    await load();

    expect(getHoldings).toHaveBeenCalledWith({
      dateRange: 'max',
      userId: FIXTURE_USER_ID
    });
    expect(getRiskSummary).toHaveBeenCalledWith(
      holdingsFixture,
      FIXTURE_BASE_CURRENCY
    );
    expect(toRiskConcentrationResponse).toHaveBeenCalledWith({
      holdings: holdingsFixture,
      limit: 5,
      summary
    });
  });

  it('builds the tax section from FIFO realized gains for the token user', async () => {
    await load();

    expect(getFifoRealizedGains).toHaveBeenCalledWith(FIXTURE_USER_ID);
  });

  it('builds the charts section from the full history and first activity date', async () => {
    await load();

    expect(getPerformance).toHaveBeenCalledWith({
      dateRange: 'max',
      userId: FIXTURE_USER_ID
    });
    expect(getSeries).toHaveBeenCalledWith({
      earliestActivityDate: '2026-01-05',
      history: performanceHistoryFixture,
      range: DASHBOARD_CHART_RANGE
    });
  });

  it('passes an empty history to charts when the portfolio has none', async () => {
    getPerformance.mockResolvedValue({
      chart: undefined,
      dateOfFirstActivity: undefined
    });

    await load();

    expect(getSeries).toHaveBeenCalledWith({
      earliestActivityDate: undefined,
      history: [],
      range: DASHBOARD_CHART_RANGE
    });
  });
});
