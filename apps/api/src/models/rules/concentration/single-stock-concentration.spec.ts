import { PortfolioPosition } from '@ghostfolio/common/interfaces';

import { SingleStockConcentration } from './single-stock-concentration';

function holding(
  symbol: string,
  assetSubClass: string,
  value: number,
  currency = 'USD'
): PortfolioPosition {
  return {
    assetProfile: { assetSubClass, currency, symbol },
    quantity: value,
    marketPrice: 1
  } as unknown as PortfolioPosition;
}

const exchangeRateDataServiceMock = {
  toCurrency: (value: number) => value
} as any;

describe('SingleStockConcentration', () => {
  it('fails when one stock exceeds the threshold (worked example: 33.3% vs 10%)', () => {
    const holdings = [
      holding('AAPL', 'STOCK', 30000),
      holding('MSFT', 'STOCK', 20000),
      holding('GOOGL', 'STOCK', 10000),
      holding('VTI', 'ETF', 30000)
    ];
    const rule = new SingleStockConcentration(
      exchangeRateDataServiceMock,
      holdings
    );

    const result = rule.evaluate({
      baseCurrency: 'USD',
      locale: 'en',
      isActive: true,
      thresholdMax: 0.1
    });

    expect(result.value).toBe(false);
    expect(result.evaluation).toContain('AAPL');
    expect(result.evaluation).toContain('33.3%');
  });

  it('excludes ETFs and mutual funds from the single-stock check', () => {
    const holdings = [
      holding('VTI', 'ETF', 90000),
      holding('AAPL', 'STOCK', 10000)
    ];
    const rule = new SingleStockConcentration(
      exchangeRateDataServiceMock,
      holdings
    );

    const result = rule.evaluate({
      baseCurrency: 'USD',
      locale: 'en',
      isActive: true,
      thresholdMax: 0.1
    });

    // AAPL is only 10% of the total (the 90% ETF holding is not eligible),
    // so it passes even though the ETF alone would have failed if counted.
    expect(result.value).toBe(true);
  });

  it('passes when the largest eligible holding is exactly at the threshold', () => {
    const holdings = [
      holding('AAPL', 'STOCK', 10),
      holding('MSFT', 'STOCK', 90)
    ];
    const rule = new SingleStockConcentration(
      exchangeRateDataServiceMock,
      holdings
    );

    const result = rule.evaluate({
      baseCurrency: 'USD',
      locale: 'en',
      isActive: true,
      thresholdMax: 0.9
    });

    // exactly on the line -> not "above", so it passes
    expect(result.value).toBe(true);
  });

  it('passes with an informative message when there are no eligible holdings', () => {
    const holdings = [holding('VTI', 'ETF', 100000)];
    const rule = new SingleStockConcentration(
      exchangeRateDataServiceMock,
      holdings
    );

    const result = rule.evaluate({
      baseCurrency: 'USD',
      locale: 'en',
      isActive: true,
      thresholdMax: 0.1
    });

    expect(result.value).toBe(true);
    expect(result.evaluation).toContain('No individual stock');
  });

  it('aggregates the same symbol held as separate positions across accounts (Tharun review, PR #51)', () => {
    // AAPL at 6% in one account + 6% in another must be seen as 12% total
    // concentration, not two separate 6% positions that each individually
    // pass a 10% threshold. Without aggregation, the largest single position
    // would be 6% (passes); aggregated, AAPL is 12% (fails).
    const holdings = [
      holding('AAPL', 'STOCK', 6000), // account A
      holding('AAPL', 'STOCK', 6000), // account B
      holding('MSFT', 'STOCK', 4000),
      holding('VTI', 'ETF', 84000)
    ];
    const rule = new SingleStockConcentration(
      exchangeRateDataServiceMock,
      holdings
    );

    const result = rule.evaluate({
      baseCurrency: 'USD',
      locale: 'en',
      isActive: true,
      thresholdMax: 0.1
    });

    expect(result.value).toBe(false);
    expect(result.evaluation).toContain('AAPL');
    expect(result.evaluation).toContain('12.0%');
  });

  it('defaults thresholdMax to 10% when the user has not customized it', () => {
    const rule = new SingleStockConcentration(exchangeRateDataServiceMock, []);
    const settings = rule.getSettings({ baseCurrency: 'USD' });

    expect(settings.thresholdMax).toBe(0.1);
    expect(settings.isActive).toBe(true);
  });
});
