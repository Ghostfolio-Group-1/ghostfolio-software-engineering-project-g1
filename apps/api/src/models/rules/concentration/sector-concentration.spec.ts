import { PortfolioPosition } from '@ghostfolio/common/interfaces';

import { SectorConcentration } from './sector-concentration';

function holding(
  value: number,
  sectors: { name: string; weight: number }[]
): PortfolioPosition {
  return {
    assetProfile: { currency: 'USD', sectors },
    quantity: value,
    marketPrice: 1
  } as unknown as PortfolioPosition;
}

const exchangeRateDataServiceMock = {
  toCurrency: (value: number) => value
} as any;

describe('SectorConcentration', () => {
  it('splits a multi-sector holding proportionally by weight (worked example: $10,000 at 70/30)', () => {
    const holdings = [
      holding(10000, [
        { name: 'Technology', weight: 0.7 },
        { name: 'Healthcare', weight: 0.3 }
      ])
    ];
    const rule = new SectorConcentration(exchangeRateDataServiceMock, holdings);

    const result = rule.evaluate({
      baseCurrency: 'USD',
      locale: 'en',
      isActive: true,
      thresholdMax: 0.3
    });

    // Technology = $7,000 / $10,000 = 70%, above the 30% threshold.
    expect(result.value).toBe(false);
    expect(result.evaluation).toContain('Technology');
    expect(result.evaluation).toContain('70.0%');
  });

  it('groups holdings with no sector data under UNKNOWN rather than dropping them', () => {
    const holdings = [
      holding(100, []),
      holding(5, [{ name: 'Technology', weight: 1 }])
    ];
    const rule = new SectorConcentration(exchangeRateDataServiceMock, holdings);

    const result = rule.evaluate({
      baseCurrency: 'USD',
      locale: 'en',
      isActive: true,
      thresholdMax: 0.3
    });

    expect(result.value).toBe(false);
    expect(result.evaluation).toMatch(/UNKNOWN/);
  });

  it('passes a well-diversified sector split', () => {
    const holdings = [
      holding(10000, [
        { name: 'Technology', weight: 0.25 },
        { name: 'Healthcare', weight: 0.25 },
        { name: 'Financials', weight: 0.25 },
        { name: 'Energy', weight: 0.25 }
      ])
    ];
    const rule = new SectorConcentration(exchangeRateDataServiceMock, holdings);

    const result = rule.evaluate({
      baseCurrency: 'USD',
      locale: 'en',
      isActive: true,
      thresholdMax: 0.3
    });

    expect(result.value).toBe(true);
  });
});
