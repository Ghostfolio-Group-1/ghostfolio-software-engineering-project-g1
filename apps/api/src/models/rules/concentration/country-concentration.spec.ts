import { PortfolioPosition } from '@ghostfolio/common/interfaces';

import { CountryConcentration } from './country-concentration';

function holding(
  value: number,
  countries: { code: string; weight: number }[]
): PortfolioPosition {
  return {
    assetProfile: { countries, currency: 'USD' },
    quantity: value,
    marketPrice: 1
  } as unknown as PortfolioPosition;
}

const exchangeRateDataServiceMock = {
  toCurrency: (value: number) => value
} as any;

describe('CountryConcentration', () => {
  it('fails when one country exceeds the threshold', () => {
    const holdings = [
      holding(10000, [
        { code: 'US', weight: 0.8 },
        { code: 'CA', weight: 0.2 }
      ])
    ];
    const rule = new CountryConcentration(
      exchangeRateDataServiceMock,
      holdings
    );

    const result = rule.evaluate({
      baseCurrency: 'USD',
      locale: 'en',
      isActive: true,
      thresholdMax: 0.5
    });

    expect(result.value).toBe(false);
    expect(result.evaluation).toContain('US');
    expect(result.evaluation).toContain('80.0%');
  });

  it('defaults thresholdMax to 50%, matching the existing currency rule default', () => {
    const rule = new CountryConcentration(exchangeRateDataServiceMock, []);
    const settings = rule.getSettings({ baseCurrency: 'USD' });

    expect(settings.thresholdMax).toBe(0.5);
  });
});
