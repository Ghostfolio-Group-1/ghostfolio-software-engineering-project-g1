import {
  DEFAULT_VOLATILITY_WINDOW_DAYS,
  annualizedVolatility,
  computeDailyReturns,
  standardDeviation
} from './volatility.model';

describe('computeDailyReturns', () => {
  it('computes simple percentage returns between consecutive prices', () => {
    const returns = computeDailyReturns({ prices: [100, 105, 110] });

    expect(returns[0]).toBeCloseTo(0.05, 10);
    expect(returns[1]).toBeCloseTo(0.047619047619, 10);
  });

  it('defaults the window to 90 trading days when none is given', () => {
    expect(DEFAULT_VOLATILITY_WINDOW_DAYS).toBe(90);

    // 95 prices (values 1..95) with a default 90-day window -> only the
    // last 91 prices (values 5..95) are used, giving 90 returns.
    const prices = Array.from({ length: 95 }, (_, i) => i + 1);
    const returns = computeDailyReturns({ prices });

    expect(returns).toHaveLength(90);
    // First return uses the window's first two prices: 5 -> 6.
    expect(returns[0]).toBeCloseTo((6 - 5) / 5, 10);
  });

  it('respects an explicit window smaller than the full price history', () => {
    // 10 prices, window = 3 -> last 4 prices used -> 3 returns.
    const prices = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109];
    const returns = computeDailyReturns({ prices, window: 3 });

    expect(returns).toHaveLength(3);
    expect(returns[0]).toBeCloseTo((107 - 106) / 106, 10);
  });

  it('skips a return when the previous price is non-positive, shrinking the series by one', () => {
    const returns = computeDailyReturns({
      prices: [100, 0, 105],
      window: 10
    });

    // Only the 0 -> 105 step is skipped (previous price not > 0); the
    // 100 -> 0 step is still a valid return (100% drop), so 1 of the 2
    // possible returns is produced, not 0.
    expect(returns).toHaveLength(1);
    expect(returns[0]).toBeCloseTo(-1, 10);
  });
});

describe('standardDeviation / annualizedVolatility', () => {
  it('matches a hand-computed known series', () => {
    const returns = [0.01, -0.01, 0.01, -0.01];

    // mean = 0, variance = mean of squares = 0.0001, stdDev = 0.01
    expect(standardDeviation(returns)).toBeCloseTo(0.01, 10);
    expect(annualizedVolatility(returns)).toBeCloseTo(
      0.01 * Math.sqrt(252),
      10
    );
  });

  it('returns 0 for an empty series rather than NaN', () => {
    expect(standardDeviation([])).toBe(0);
    expect(annualizedVolatility([])).toBe(0);
  });
});
