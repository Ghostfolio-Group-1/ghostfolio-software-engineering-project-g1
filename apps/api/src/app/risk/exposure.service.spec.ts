import { PortfolioPosition } from '@ghostfolio/common/interfaces';

import { ExposureCalculatorService } from './exposure-calculator.service';
import { ExposureService } from './exposure.service';

function holding({
  assetSubClass = 'STOCK',
  currency = 'USD',
  symbol,
  value
}: {
  assetSubClass?: string;
  currency?: string;
  symbol: string;
  value: number;
}): PortfolioPosition {
  return {
    assetProfile: { assetSubClass, currency, symbol },
    quantity: value,
    marketPrice: 1
  } as unknown as PortfolioPosition;
}

const exchangeRateDataServiceMock = {
  toCurrency: (value: number) => value
} as any;

describe('ExposureService', () => {
  const exposureCalculatorService = new ExposureCalculatorService(
    exchangeRateDataServiceMock
  );
  const service = new ExposureService(
    exchangeRateDataServiceMock,
    exposureCalculatorService
  );

  it('combines concentration and exposure into one RiskSummary (integration)', () => {
    const holdings = [
      holding({ symbol: 'AAPL', value: 30000 }),
      holding({ symbol: 'VTI', value: 70000, assetSubClass: 'ETF' })
    ];

    const summary = service.buildRiskSummary(holdings, 'USD');

    expect(summary.totalValue).toBe(100000);
    // Stock concentration only considers AAPL (VTI is an ETF) as a candidate
    // for the "largest" bucket, but the denominator is still the FULL
    // portfolio (per docs/sesha-notes/03, Section 2: "no matter how much of
    // the rest is ETFs") -> 30,000 / 100,000 = 30%, not 100% of the eligible
    // subset alone.
    expect(summary.concentration.stock[0]).toMatchObject({
      key: 'AAPL',
      percentage: 0.3
    });
    expect(summary.exposure.currency[0]).toMatchObject({
      key: 'USD',
      percentage: 1
    });
  });

  it('returns an empty summary for an empty portfolio', () => {
    const summary = service.buildRiskSummary([], 'USD');

    expect(summary.totalValue).toBe(0);
    expect(summary.concentration.stock).toHaveLength(0);
  });
});
