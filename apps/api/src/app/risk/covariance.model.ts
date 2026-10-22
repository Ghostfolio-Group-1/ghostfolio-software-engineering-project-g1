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
// same calendar days. This tags each return with the date it covers so
// alignReturns() below can intersect two symbols' returns on shared trading
// days only, rather than silently pairing returns from different dates.
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

// Two symbols only contribute to each other's covariance on the trading
// days they both have a return for - a symbol listed on a different
// exchange calendar (or with a gap in its history) should not silently
// shift one series against the other.
export function alignReturns(
  returnsA: DatedReturn[],
  returnsB: DatedReturn[]
): { a: number[]; b: number[] } {
  const byDateB = new Map(returnsB.map((entry) => [entry.date, entry.value]));
  const a: number[] = [];
  const b: number[] = [];

  for (const entry of returnsA) {
    if (byDateB.has(entry.date)) {
      a.push(entry.value);
      b.push(byDateB.get(entry.date));
    }
  }

  return { a, b };
}

// Population covariance between two equal-length, date-aligned return
// series (see alignReturns()).
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
