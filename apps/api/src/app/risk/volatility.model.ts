// Spec: docs/sesha-notes/04-volatility-cash-allocation-spec.md, Section 2.2.
// Trading days per year, standard convention for annualizing daily volatility.
const TRADING_DAYS_PER_YEAR = 252;

// Section 2.2 Step 1: "pull the last N days of MarketData.marketPrice (I'd
// default N = 90 trading days)". Named `window` here; the downstream
// PortfolioVolatility rule calls the same concept `historyDays`.
export const DEFAULT_VOLATILITY_WINDOW_DAYS = 90;

export interface VolatilityInput {
  prices: number[];
  window?: number;
}

export function computeDailyReturns({
  prices,
  window = DEFAULT_VOLATILITY_WINDOW_DAYS
}: VolatilityInput): number[] {
  // N returns need N+1 prices, so the window keeps one extra price.
  const windowedPrices = prices.slice(-(window + 1));
  const returns: number[] = [];

  for (let i = 1; i < windowedPrices.length; i++) {
    const previous = windowedPrices[i - 1];
    const current = windowedPrices[i];

    // A non-positive previous price means missing/bad market data for that
    // day - skip just that one return rather than dividing by zero or
    // producing a nonsensical negative-base percentage. The series shrinks
    // by one point in this case; see the dedicated test for this behavior.
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
