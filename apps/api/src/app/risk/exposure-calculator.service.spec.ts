import { PortfolioPosition } from '@ghostfolio/common/interfaces';

import { ExposureCalculatorService } from './exposure-calculator.service';

function holding(
  currency: string,
  assetClass: string,
  value: number
): PortfolioPosition {
  return {
    assetProfile: { assetClass, currency },
    quantity: value,
    marketPrice: 1
  } as unknown as PortfolioPosition;
}

const exchangeRateDataServiceMock = {
  toCurrency: (value: number) => value
} as any;

// EUR is worth 1.1x in USD, so a naive sum of face values (without FX
// conversion) would understate EUR's share of the portfolio.
const fxExchangeRateDataServiceMock = {
  toCurrency: (value: number, fromCurrency: string, toCurrency: string) => {
    if (fromCurrency === toCurrency) {
      return value;
    }

    return fromCurrency === 'EUR' && toCurrency === 'USD' ? value * 1.1 : value;
  }
} as any;

describe('ExposureCalculatorService', () => {
  const service = new ExposureCalculatorService(exchangeRateDataServiceMock);

  it('calculates currency exposure percentages that sum to 1', () => {
    const holdings = [
      holding('USD', 'EQUITY', 58000),
      holding('EUR', 'EQUITY', 42000)
    ];

    const result = service.calculateCurrencyExposure(holdings, 'USD');

    expect(result.buckets[0]).toMatchObject({ key: 'USD', percentage: 0.58 });
    expect(result.buckets[1]).toMatchObject({ key: 'EUR', percentage: 0.42 });
    const sum = result.buckets.reduce((s, b) => s + b.percentage, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('converts to the base currency before computing exposure (worked example: $50,000 + €50,000 at 1.1 EUR/USD)', () => {
    const fxService = new ExposureCalculatorService(
      fxExchangeRateDataServiceMock
    );
    const holdings = [
      holding('USD', 'EQUITY', 50000),
      holding('EUR', 'EQUITY', 50000)
    ];

    const result = fxService.calculateCurrencyExposure(holdings, 'USD');

    // USD: $50,000. EUR: €50,000 -> $55,000. Total: $105,000.
    const usdBucket = result.buckets.find((bucket) => bucket.key === 'USD');
    const eurBucket = result.buckets.find((bucket) => bucket.key === 'EUR');

    expect(result.totalValue).toBeCloseTo(105000, 10);
    expect(usdBucket.percentage).toBeCloseTo(50000 / 105000, 10);
    expect(eurBucket.percentage).toBeCloseTo(55000 / 105000, 10);
  });

  it('calculates asset-class exposure sorted largest first', () => {
    const holdings = [
      holding('USD', 'FIXED_INCOME', 20000),
      holding('USD', 'EQUITY', 80000)
    ];

    const result = service.calculateAssetClassExposure(holdings, 'USD');

    expect(result.buckets[0].key).toBe('EQUITY');
    expect(result.buckets[0].percentage).toBeCloseTo(0.8, 10);
  });

  it('returns an empty breakdown for an empty portfolio without dividing by zero', () => {
    const result = service.calculateCurrencyExposure([], 'USD');

    expect(result.totalValue).toBe(0);
    expect(result.buckets).toHaveLength(0);
  });
});
