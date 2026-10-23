import { PortfolioService } from '@ghostfolio/api/app/portfolio/portfolio.service';
import {
  FIXTURE_BASE_CURRENCY,
  FIXTURE_USER_ID,
  holdingsFixture,
  performanceHistoryFixture
} from '@ghostfolio/api/testing/fixtures/portfolio.fixtures';

import { Logger } from '@nestjs/common';

import { ChartsApi } from '../charts/charts-api';
import { ExposureService } from '../risk/exposure.service';
import {
  parseConcentrationLimit,
  toRiskConcentrationResponse
} from '../risk/risk-concentration.mapper';
import { TaxService } from '../tax/tax.service';
import { DASHBOARD_CHART_RANGE, DashboardOverview } from './dashboard-overview';

const mockRiskSection = { section: 'risk' };

jest.mock('../risk/risk-concentration.mapper', () => {
  return {
    parseConcentrationLimit: jest.fn(() => 5),
    toRiskConcentrationResponse: jest.fn(() => mockRiskSection)
  };
});

const unavailable = (name: 'charts' | 'risk' | 'tax') => {
  return {
    error: {
      code: `DASHBOARD_${name.toUpperCase()}_UNAVAILABLE`,
      message: `The ${name} section could not be loaded`
    },
    status: 'unavailable'
  };
};

describe('DashboardOverview.getOverview', () => {
  const chartsSection = { section: 'charts' };
  const summary = { section: 'summary' };
  const taxSection = { method: 'FIFO', sales: [] };

  let getFifoRealizedGains: jest.Mock;
  let getHoldings: jest.Mock;
  let getPerformance: jest.Mock;
  let getRiskSummary: jest.Mock;
  let getSeries: jest.Mock;
  let loggerError: jest.SpyInstance;
  let overview: DashboardOverview;

  beforeEach(() => {
    jest.clearAllMocks();

    loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    getFifoRealizedGains = jest.fn().mockResolvedValue(taxSection);
    getHoldings = jest.fn().mockResolvedValue(holdingsFixture);
    getPerformance = jest.fn().mockResolvedValue({
      chart: performanceHistoryFixture,
      dateOfFirstActivity: new Date(2026, 0, 5)
    });
    getRiskSummary = jest.fn().mockReturnValue(summary);
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

  it('marks every section available when all sources load', async () => {
    await expect(load()).resolves.toEqual({
      charts: { data: chartsSection, status: 'available' },
      risk: { data: mockRiskSection, status: 'available' },
      tax: { data: taxSection, status: 'available' }
    });
    expect(loggerError).not.toHaveBeenCalled();
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

  it('marks only the tax section unavailable when tax fails, without leaking the error', async () => {
    getFifoRealizedGains.mockRejectedValue(
      new Error('Mixed currencies for asset fixture-symbol-aapl')
    );

    const result = await load();

    expect(result.tax).toEqual(unavailable('tax'));
    expect(JSON.stringify(result)).not.toContain('Mixed currencies');
    expect(result.risk).toEqual({ data: mockRiskSection, status: 'available' });
    expect(result.charts).toEqual({ data: chartsSection, status: 'available' });
    expect(loggerError).toHaveBeenCalledWith(
      'Dashboard tax section failed',
      expect.stringContaining('Mixed currencies')
    );
  });

  it('marks only the risk section unavailable when holdings cannot be loaded', async () => {
    getHoldings.mockRejectedValue(new Error('holdings down'));

    const result = await load();

    expect(result.risk).toEqual(unavailable('risk'));
    expect(result.tax.status).toBe('available');
    expect(result.charts.status).toBe('available');
  });

  it('marks only the charts section unavailable when ChartsApi throws', async () => {
    getSeries.mockImplementation(() => {
      throw new Error('bad range');
    });

    const result = await load();

    expect(result.charts).toEqual(unavailable('charts'));
    expect(result.risk.status).toBe('available');
    expect(result.tax.status).toBe('available');
  });

  it('resolves with every section unavailable when all sources fail', async () => {
    getFifoRealizedGains.mockRejectedValue(new Error('tax down'));
    getHoldings.mockRejectedValue(new Error('holdings down'));
    getPerformance.mockRejectedValue(new Error('performance down'));

    await expect(load()).resolves.toEqual({
      charts: unavailable('charts'),
      risk: unavailable('risk'),
      tax: unavailable('tax')
    });
    expect(loggerError).toHaveBeenCalledTimes(3);
  });
  it('logs a non-Error rejection and still marks the section unavailable', async () => {
    getFifoRealizedGains.mockRejectedValue('plain string failure');

    const result = await load();

    expect(result.tax).toEqual(unavailable('tax'));
    expect(loggerError).toHaveBeenCalledWith(
      'Dashboard tax section failed',
      'plain string failure'
    );
  });

  it('omits the first activity date when it is not a valid date', async () => {
    getPerformance.mockResolvedValue({
      chart: performanceHistoryFixture,
      dateOfFirstActivity: new Date('not a date')
    });

    await load();

    expect(getSeries).toHaveBeenCalledWith({
      earliestActivityDate: undefined,
      history: performanceHistoryFixture,
      range: DASHBOARD_CHART_RANGE
    });
  });

  it('marks risk unavailable without loading holdings when the default limit is invalid', async () => {
    (parseConcentrationLimit as jest.Mock).mockReturnValueOnce(null);

    const result = await load();

    expect(result.risk).toEqual(unavailable('risk'));
    expect(getHoldings).not.toHaveBeenCalled();
    expect(result.tax.status).toBe('available');
    expect(result.charts.status).toBe('available');
  });
});
