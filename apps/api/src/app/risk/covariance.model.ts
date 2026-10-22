import { mean } from './volatility.model';

// Spec: docs/sesha-notes/04-volatility-cash-allocation-spec.md, Section 2.5.
// Same annualization convention as volatility.model.ts's annualizedVolatility:
// daily variance/covariance scales linearly with time, so annualizing it is
// a plain x252 (volatility, its square root, scales by sqrt(252) instead).
const TRADING_DAYS_PER_YEAR = 252;

export interface DatedPrice {
  date: string;
  price: number;
}

export interface DatedReturn {
  date: string;
  value: number;
}

// Date-aware counterpart to volatility.model.ts's computeDailyReturns: that
// function works on a plain price array and assumes every index lines up
// across symbols, which only holds if every symbol traded on exactly the
// same calendar days. This tags each return with the date it covers so a
// caller can line up two symbols' returns by date rather than by index.
export function computeDatedDailyReturns(prices: DatedPrice[]): DatedReturn[] {
  const sorted = [...prices].sort((left, right) => {
    return left.date < right.date ? -1 : left.date > right.date ? 1 : 0;
  });
  const returns: DatedReturn[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];

    if (previous.price > 0) {
      returns.push({
        date: current.date,
        value: (current.price - previous.price) / previous.price
      });
    }
  }

  return returns;
}

// Restricts two symbols' price series to the trading days they BOTH have a
// price for, before any return is computed. This must happen at the price
// level, not by matching returns on their end date afterwards: if symbol A
// trades Mon/Tue/Wed and symbol B trades only Mon/Wed, A's Wednesday return
// covers Tue->Wed while B's Wednesday return covers Mon->Wed - tagging each
// return only by its end date and matching on that (an earlier version of
// this function did exactly that) would silently pair two returns covering
// different time intervals. Aligning the underlying prices first guarantees
// that any return later computed from the aligned series, for either
// symbol, covers the exact same two calendar dates as its counterpart.
export function alignPrices(
  pricesA: DatedPrice[],
  pricesB: DatedPrice[]
): { a: DatedPrice[]; b: DatedPrice[] } {
  const byDateA = new Map(pricesA.map((entry) => [entry.date, entry.price]));
  const byDateB = new Map(pricesB.map((entry) => [entry.date, entry.price]));
  const commonDates = [...byDateA.keys()]
    .filter((date) => byDateB.has(date))
    .sort();

  return {
    a: commonDates.map((date) => ({ date, price: byDateA.get(date) })),
    b: commonDates.map((date) => ({ date, price: byDateB.get(date) }))
  };
}

// Population covariance between two equal-length return series. Callers
// should derive both from alignPrices()'d price series (see above) so each
// index represents the same pair of calendar dates for both symbols.
export function covariance(returnsA: number[], returnsB: number[]): number {
  if (returnsA.length === 0 || returnsA.length !== returnsB.length) {
    return 0;
  }

  const meanA = mean(returnsA);
  const meanB = mean(returnsB);

  const sumOfProducts = returnsA.reduce((sum, value, index) => {
    return sum + (value - meanA) * (returnsB[index] - meanB);
  }, 0);

  return sumOfProducts / returnsA.length;
}

export function annualizedCovariance(
  returnsA: number[],
  returnsB: number[]
): number {
  return covariance(returnsA, returnsB) * TRADING_DAYS_PER_YEAR;
}

// sqrt(weights^T * covarianceMatrix * weights) - the actual point of a full
// covariance matrix over a naive weighted-average of individual
// volatilities: two holdings that move opposite each other (negative
// covariance) reduce the portfolio's variance below what either holding
// alone would suggest, which a weighted average can never do.
//
// A symbol present in `weights` but missing from `matrix` contributes
// nothing to the sum rather than throwing - the caller (VolatilityCache-
// Service) is responsible for deciding whether that missing coverage should
// degrade the whole result to NO_DATA.
export function portfolioVolatilityFromMatrix({
  matrix,
  weights
}: {
  matrix: Record<string, Record<string, number>>;
  weights: Record<string, number>;
}): number {
  const symbols = Object.keys(weights);
  let variance = 0;

  for (const rowSymbol of symbols) {
    for (const columnSymbol of symbols) {
      const covarianceValue = matrix[rowSymbol]?.[columnSymbol] ?? 0;

      variance += weights[rowSymbol] * weights[columnSymbol] * covarianceValue;
    }
  }

  return variance > 0 ? Math.sqrt(variance) : 0;
}
