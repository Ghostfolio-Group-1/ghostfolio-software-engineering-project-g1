import { CashAllocation } from './cash-allocation';

const exchangeRateDataServiceMock = {} as any;
const settings = {
  locale: 'en',
  isActive: true,
  thresholdMax: 0.15,
  thresholdMin: 0.02
};

describe('CashAllocation', () => {
  it('passes within the default 2%-15% band (worked example: 10%)', () => {
    const rule = new CashAllocation(exchangeRateDataServiceMock, 10000, 100000);

    const result = rule.evaluate(settings);

    expect(result.value).toBe(true);
    expect(result.evaluation).toContain('10.0%');
    expect(result.actual).toBe(0.1);
  });

  it('passes when the ratio is exactly at thresholdMin (inclusive lower bound)', () => {
    const rule = new CashAllocation(exchangeRateDataServiceMock, 2000, 100000);

    const result = rule.evaluate(settings);

    expect(result.value).toBe(true);
    expect(result.actual).toBe(0.02);
  });

  it('passes when the ratio is exactly at thresholdMax (inclusive upper bound)', () => {
    const rule = new CashAllocation(exchangeRateDataServiceMock, 15000, 100000);

    const result = rule.evaluate(settings);

    expect(result.value).toBe(true);
    expect(result.actual).toBe(0.15);
  });

  it('fails when too little cash (below the minimum)', () => {
    const rule = new CashAllocation(exchangeRateDataServiceMock, 500, 100000);

    const result = rule.evaluate(settings);

    expect(result.value).toBe(false);
    expect(result.actual).toBe(0.005);
  });

  it('fails when too much idle cash (above the maximum)', () => {
    const rule = new CashAllocation(exchangeRateDataServiceMock, 30000, 100000);

    const result = rule.evaluate(settings);

    expect(result.value).toBe(false);
    expect(result.actual).toBe(0.3);
  });

  it('handles a zero-value portfolio without dividing by zero', () => {
    const rule = new CashAllocation(exchangeRateDataServiceMock, 0, 0);

    const result = rule.evaluate(settings);

    // 0 / 0 must resolve to a defined ratio (0%, below the 2% minimum),
    // never NaN leaking into the evaluation message.
    expect(result.value).toBe(false);
    expect(result.actual).toBe(0);
    expect(result.evaluation).not.toContain('NaN');
  });
});
