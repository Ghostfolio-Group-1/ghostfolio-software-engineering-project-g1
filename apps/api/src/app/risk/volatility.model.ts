// Spec: docs/sesha-notes/04-volatility-cash-allocation-spec.md, Section 2.2.
// Trading days per year, standard convention for annualizing daily volatility.
const TRADING_DAYS_PER_YEAR = 252;

export function computeDailyReturns(prices: number[]): number[] {
  const returns: number[] = [];

  for (let i = 1; i < prices.length; i++) {
    const previous = prices[i - 1];
    const current = prices[i];

    if (previous > 0) {
      returns.push((current - previous) / previous);
    }
  }

  return returns;
}

export function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// Population standard deviation (we are describing the whole observed
// series, not estimating from a sample of a larger population).
export function standardDeviation(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const average = mean(values);
  const squaredDiffs = values.map((value) => (value - average) ** 2);

  return Math.sqrt(mean(squaredDiffs));
}

export function annualizedVolatility(dailyReturns: number[]): number {
  return standardDeviation(dailyReturns) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}
