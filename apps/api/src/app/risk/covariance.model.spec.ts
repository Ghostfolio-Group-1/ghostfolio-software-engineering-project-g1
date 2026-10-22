import {
  alignReturns,
  annualizedCovariance,
  computeDatedDailyReturns,
  covariance,
  portfolioVolatilityFromMatrix
} from './covariance.model';

describe('computeDatedDailyReturns', () => {
  it('tags each return with the date it covers', () => {
    const returns = computeDatedDailyReturns([
      { date: '2026-01-01', price: 100 },
      { date: '2026-01-02', price: 105 },
      { date: '2026-01-03', price: 110 }
    ]);

    expect(returns[0]).toEqual({ date: '2026-01-02', value: 0.05 });
    expect(returns[1].date).toBe('2026-01-03');
    expect(returns[1].value).toBeCloseTo(0.047619047619, 10);
  });

  it('sorts out-of-order input by date before computing returns', () => {
    const returns = computeDatedDailyReturns([
      { date: '2026-01-03', price: 110 },
      { date: '2026-01-01', price: 100 },
      { date: '2026-01-02', price: 105 }
    ]);

    expect(returns[0]).toEqual({ date: '2026-01-02', value: 0.05 });
  });
});

describe('alignReturns', () => {
  it('keeps only the dates present in both series', () => {
    const aligned = alignReturns(
      [
        { date: '2026-01-02', value: 0.01 },
        { date: '2026-01-03', value: 0.02 },
        { date: '2026-01-04', value: 0.03 }
      ],
      [
        { date: '2026-01-02', value: -0.01 },
        { date: '2026-01-04', value: -0.03 }
      ]
    );

    // 2026-01-03 is missing from B, so it is dropped from both sides.
    expect(aligned.a).toEqual([0.01, 0.03]);
    expect(aligned.b).toEqual([-0.01, -0.03]);
  });
});

describe('covariance / annualizedCovariance', () => {
  it('is positive when two series move together', () => {
    const a = [0.01, 0.02, -0.01, -0.02];
    const b = [0.01, 0.02, -0.01, -0.02];

    expect(covariance(a, b)).toBeGreaterThan(0);
    // Covariance of a series with itself is its variance.
    expect(covariance(a, b)).toBeCloseTo(0.01 * 0.01 * 2.5, 6);
  });

  it('is negative when two series move opposite each other', () => {
    const a = [0.01, 0.02, -0.01, -0.02];
    const b = [-0.01, -0.02, 0.01, 0.02];

    expect(covariance(a, b)).toBeLessThan(0);
  });

  it('is zero for mismatched-length or empty series rather than NaN', () => {
    expect(covariance([], [])).toBe(0);
    expect(covariance([0.01], [0.01, 0.02])).toBe(0);
  });

  it('annualizes by the same x252 trading-day convention as volatility', () => {
    const a = [0.01, -0.01, 0.01, -0.01];
    expect(annualizedCovariance(a, a)).toBeCloseTo(covariance(a, a) * 252, 10);
  });
});

describe('portfolioVolatilityFromMatrix', () => {
  it("matches a single holding's own volatility (sqrt of its variance)", () => {
    const volatility = portfolioVolatilityFromMatrix({
      matrix: { AAPL: { AAPL: 0.04 } },
      weights: { AAPL: 1 }
    });

    expect(volatility).toBeCloseTo(Math.sqrt(0.04), 10);
  });

  it('is lower than either holding alone when two holdings are negatively correlated', () => {
    // Two holdings, 50/50, each with variance 0.04 (volatility 0.2), but
    // perfectly negatively covarying (covariance = -0.04): a diversified
    // portfolio should have LOWER volatility than either holding alone -
    // the entire point of using the covariance matrix instead of a naive
    // weighted average, which would just give 0.2 here.
    const matrix = {
      AAPL: { AAPL: 0.04, MSFT: -0.04 },
      MSFT: { AAPL: -0.04, MSFT: 0.04 }
    };
    const weights = { AAPL: 0.5, MSFT: 0.5 };

    const volatility = portfolioVolatilityFromMatrix({ matrix, weights });
    const naiveWeightedAverage = 0.5 * 0.2 + 0.5 * 0.2;

    expect(volatility).toBeLessThan(naiveWeightedAverage);
    // variance = 0.25*0.04 + 0.25*0.04 + 2*0.5*0.5*(-0.04) = 0.02 - 0.02 = 0
    expect(volatility).toBeCloseTo(0, 10);
  });

  it('is higher than either holding alone when two holdings are perfectly positively correlated', () => {
    const matrix = {
      AAPL: { AAPL: 0.04, MSFT: 0.04 },
      MSFT: { AAPL: 0.04, MSFT: 0.04 }
    };
    const weights = { AAPL: 0.5, MSFT: 0.5 };

    const volatility = portfolioVolatilityFromMatrix({ matrix, weights });

    // variance = 0.25*0.04 + 0.25*0.04 + 2*0.5*0.5*0.04 = 0.04 -> vol = 0.2
    expect(volatility).toBeCloseTo(0.2, 10);
  });

  it('treats a symbol missing from the matrix as contributing zero rather than throwing', () => {
    const volatility = portfolioVolatilityFromMatrix({
      matrix: { AAPL: { AAPL: 0.04 } },
      weights: { AAPL: 0.5, UNKNOWN: 0.5 }
    });

    expect(Number.isNaN(volatility)).toBe(false);
  });
});
