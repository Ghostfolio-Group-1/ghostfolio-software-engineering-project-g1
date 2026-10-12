import { PortfolioVolatility } from './portfolio-volatility';

const exchangeRateDataServiceMock = {} as any;
const settings = {
  locale: 'en',
  isActive: true,
  thresholdMax: 0.25,
  thresholdMin: 0.1
};

describe('PortfolioVolatility', () => {
  it('passes when volatility is within the band', () => {
    const rule = new PortfolioVolatility(
      exchangeRateDataServiceMock,
      0.184,
      90
    );

    const result = rule.evaluate(settings);

    expect(result.value).toBe(true);
    expect(result.evaluation).toContain('18.4%');
    expect(result.details.hasSufficientData).toBe(true);
  });

  it('fails when volatility is above the band', () => {
    const rule = new PortfolioVolatility(
      exchangeRateDataServiceMock,
      0.314,
      90
    );

    const result = rule.evaluate(settings);

    expect(result.value).toBe(false);
    expect(result.evaluation).toContain('31.4%');
  });

  it('fails when volatility is below the band', () => {
    const rule = new PortfolioVolatility(exchangeRateDataServiceMock, 0.03, 90);

    const result = rule.evaluate(settings);

    expect(result.value).toBe(false);
  });

  it('returns NO_DATA-flagged soft-pass when there is not enough price history', () => {
    const rule = new PortfolioVolatility(exchangeRateDataServiceMock, null, 5);

    const result = rule.evaluate(settings);

    expect(result.value).toBe(true);
    expect(result.details.hasSufficientData).toBe(false);
    expect(result.details.historyDays).toBe(5);
  });

  it('treats fewer than 20 days as insufficient even when a number is provided', () => {
    const rule = new PortfolioVolatility(exchangeRateDataServiceMock, 0.2, 10);

    const result = rule.evaluate(settings);

    expect(result.details.hasSufficientData).toBe(false);
  });
});
