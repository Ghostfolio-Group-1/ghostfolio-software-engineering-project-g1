import { CountryConcentration } from '@ghostfolio/api/models/rules/concentration/country-concentration';
import { SectorConcentration } from '@ghostfolio/api/models/rules/concentration/sector-concentration';
import { PortfolioPosition } from '@ghostfolio/common/interfaces';

// Real coverage for the Oct 6 sprint task (issue #31), replacing the
// `expect(true).toBe(true)` placeholder from PR #29. Unlike
// sector-concentration.spec.ts / country-concentration.spec.ts, which each
// test one rule in isolation on simple USD fixtures, this exercises both
// rules together against one multi-currency portfolio, since that is the
// shape risk evaluation actually runs in production.
function holding(
  value: number,
  currency: string,
  sectors: { name: string; weight: number }[],
  countries: { code: string; weight: number }[]
): PortfolioPosition {
  return {
    assetProfile: { currency, sectors, countries },
    quantity: value,
    marketPrice: 1
  } as unknown as PortfolioPosition;
}

// EUR holdings are worth 1.1x in USD, so FX conversion must be applied
// before either rule computes its percentages.
const exchangeRateDataServiceMock = {
  toCurrency: (value: number, fromCurrency: string, toCurrency: string) => {
    if (fromCurrency === toCurrency) {
      return value;
    }

    return fromCurrency === 'EUR' && toCurrency === 'USD' ? value * 1.1 : value;
  }
} as any;

describe('RiskService concentration rules (sector + country)', () => {
  const holdings = [
    // $10,000 USD, split 80% Technology / 20% Healthcare, 100% US.
    holding(
      10000,
      'USD',
      [
        { name: 'Technology', weight: 0.8 },
        { name: 'Healthcare', weight: 0.2 }
      ],
      [{ code: 'US', weight: 1 }]
    ),
    // €10,000 EUR (-> $11,000 USD), 100% Healthcare, 100% Germany.
    holding(
      10000,
      'EUR',
      [{ name: 'Healthcare', weight: 1 }],
      [{ code: 'DE', weight: 1 }]
    )
  ];

  it('flags sector concentration once FX conversion is applied: Healthcare is $13,000 ($2,000 US + $11,000 EUR-converted) of $21,000 total', () => {
    const rule = new SectorConcentration(exchangeRateDataServiceMock, holdings);

    const result = rule.evaluate({
      baseCurrency: 'USD',
      locale: 'en',
      isActive: true,
      thresholdMax: 0.3
    });

    // Technology: $8,000. Healthcare: $2,000 (US) + $11,000 (EUR) = $13,000.
    // Total: $21,000. Healthcare = 13,000 / 21,000 = 61.9%.
    expect(result.value).toBe(false);
    expect(result.evaluation).toContain('Healthcare');
    expect(result.evaluation).toContain('61.9%');
  });

  it('flags country concentration on the same FX-converted portfolio: Germany is 52.4% of the total', () => {
    const rule = new CountryConcentration(
      exchangeRateDataServiceMock,
      holdings
    );

    const result = rule.evaluate({
      baseCurrency: 'USD',
      locale: 'en',
      isActive: true,
      thresholdMax: 0.4
    });

    // Germany: $11,000 / $21,000 = 52.4%, above the 40% threshold.
    expect(result.value).toBe(false);
    expect(result.evaluation).toContain('DE');
    expect(result.evaluation).toContain('52.4%');
  });

  it('passes both rules once the portfolio is diversified enough', () => {
    const diversifiedHoldings = [
      holding(
        10000,
        'USD',
        [
          { name: 'Technology', weight: 0.5 },
          { name: 'Healthcare', weight: 0.5 }
        ],
        [{ code: 'US', weight: 1 }]
      ),
      holding(
        10000,
        'USD',
        [
          { name: 'Financials', weight: 0.5 },
          { name: 'Energy', weight: 0.5 }
        ],
        [{ code: 'CA', weight: 1 }]
      )
    ];

    const sectorRule = new SectorConcentration(
      exchangeRateDataServiceMock,
      diversifiedHoldings
    );
    const countryRule = new CountryConcentration(
      exchangeRateDataServiceMock,
      diversifiedHoldings
    );
    const settings = {
      baseCurrency: 'USD',
      locale: 'en',
      isActive: true,
      thresholdMax: 0.3
    };

    expect(sectorRule.evaluate(settings).value).toBe(true);
    expect(countryRule.evaluate({ ...settings, thresholdMax: 0.6 }).value).toBe(
      true
    );
  });
});
