import { PortfolioPosition } from '@ghostfolio/common/interfaces';

import { TargetDeviation } from './target-deviation';

function holding(assetClass: string, value: number): PortfolioPosition {
  return {
    assetProfile: { assetClass, currency: 'USD' },
    quantity: value,
    marketPrice: 1
  } as unknown as PortfolioPosition;
}

const exchangeRateDataServiceMock = {
  toCurrency: (value: number) => value
} as any;

describe('TargetDeviation', () => {
  it('matches the worked example: Equity 68% vs 60% target fails, Fixed Income/Cash pass', () => {
    const holdings = [
      holding('EQUITY', 68000),
      holding('FIXED_INCOME', 27000),
      holding('LIQUIDITY', 5000)
    ];
    const rule = new TargetDeviation(exchangeRateDataServiceMock, holdings);

    const result = rule.evaluate({
      baseCurrency: 'USD',
      locale: 'en',
      groupBy: 'assetClass',
      isActive: true,
      thresholdMax: 0.05,
      targets: [
        { key: 'EQUITY', percentage: 0.6 },
        { key: 'FIXED_INCOME', percentage: 0.3 },
        { key: 'LIQUIDITY', percentage: 0.1 }
      ]
    });

    expect(result.value).toBe(false); // Equity breaches the 5pt threshold

    const equityBucket = result.buckets.find((b) => b.key === 'EQUITY');
    expect(equityBucket.actual).toBeCloseTo(0.68, 10);
    expect(equityBucket.deviation).toBeCloseTo(0.08, 10);
    expect(equityBucket.passed).toBe(false);

    const fixedIncomeBucket = result.buckets.find(
      (b) => b.key === 'FIXED_INCOME'
    );
    expect(fixedIncomeBucket.deviation).toBeCloseTo(-0.03, 10);
    expect(fixedIncomeBucket.passed).toBe(true);
  });

  it('treats a held bucket missing from the target as an implicit 0% target', () => {
    const holdings = [holding('EQUITY', 90000), holding('REAL_ESTATE', 10000)];
    const rule = new TargetDeviation(exchangeRateDataServiceMock, holdings);

    const result = rule.evaluate({
      baseCurrency: 'USD',
      locale: 'en',
      groupBy: 'assetClass',
      isActive: true,
      thresholdMax: 0.05,
      targets: [{ key: 'EQUITY', percentage: 0.9 }]
    });

    const realEstateBucket = result.buckets.find(
      (b) => b.key === 'REAL_ESTATE'
    );
    expect(realEstateBucket.target).toBe(0);
    expect(realEstateBucket.deviation).toBeCloseTo(0.1, 10);
    expect(realEstateBucket.passed).toBe(false);
  });

  it('does not run (isActive is false) when the user has not set a target', () => {
    const rule = new TargetDeviation(exchangeRateDataServiceMock, []);

    const settings = rule.getSettings({ baseCurrency: 'USD' });

    expect(settings.isActive).toBe(false);
  });

  it('runs (isActive true) when the user has set an active target', () => {
    const rule = new TargetDeviation(exchangeRateDataServiceMock, []);

    const settings = rule.getSettings({
      baseCurrency: 'USD',
      targetAllocation: {
        isActive: true,
        groupBy: 'assetClass',
        targets: [{ key: 'EQUITY', percentage: 1 }]
      }
    });

    expect(settings.isActive).toBe(true);
    expect(settings.groupBy).toBe('assetClass');
  });
});
