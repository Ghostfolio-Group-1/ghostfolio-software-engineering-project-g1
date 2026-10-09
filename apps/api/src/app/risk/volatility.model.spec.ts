import {
  annualizedVolatility,
  computeDailyReturns,
  standardDeviation
} from './volatility.model';

describe('computeDailyReturns', () => {
  it('computes simple percentage returns between consecutive prices', () => {
    const returns = computeDailyReturns([100, 105, 110]);

    expect(returns[0]).toBeCloseTo(0.05, 10);
    expect(returns[1]).toBeCloseTo(0.047619047619, 10);
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
