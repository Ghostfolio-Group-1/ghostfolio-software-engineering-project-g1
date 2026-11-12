import { addYears, format, parse, startOfWeek } from 'date-fns';

import { DATE_FORMAT } from './helper';
import { BenchmarkComparisonResponse } from './interfaces/benchmark-comparison-response.interface';
import { HistoricalDataItem } from './interfaces/historical-data-item.interface';

const WEEK_STARTS_ON_MONDAY = 1;

export interface BenchmarkPricePoint {
  date: string;
  marketPrice: number;
}

export function toBenchmarkComparisonResponse({
  benchmarkHistory,
  benchmarkSymbol,
  endDate,
  portfolioHistory,
  startDate
}: {
  benchmarkHistory: readonly BenchmarkPricePoint[];
  benchmarkSymbol: string;
  endDate: string;
  portfolioHistory: readonly HistoricalDataItem[];
  startDate: string;
}): BenchmarkComparisonResponse {
  const portfolioValues = readPortfolioValues(portfolioHistory);
  const benchmarkPrices = readBenchmarkPrices(benchmarkHistory);
  const benchmarkAvailableFrom = benchmarkPrices[0]?.date ?? startDate;

  let effectiveStart = startDate;

  if (portfolioValues[0] && portfolioValues[0].date > effectiveStart) {
    effectiveStart = portfolioValues[0].date;
  }

  if (benchmarkAvailableFrom > effectiveStart) {
    effectiveStart = benchmarkAvailableFrom;
  }

  if (effectiveStart > endDate) {
    return {
      benchmarkAvailableFrom,
      benchmarkSymbol,
      endDate,
      granularity: resolveGranularity({ endDate, startDate: effectiveStart }),
      points: [],
      startDate: effectiveStart
    };
  }

  const dailyPoints = alignIndexedPoints({
    benchmarkPrices,
    endDate,
    portfolioValues,
    startDate: effectiveStart
  });

  const granularity = resolveGranularity({
    endDate,
    startDate: effectiveStart
  });

  return {
    benchmarkAvailableFrom,
    benchmarkSymbol,
    endDate,
    granularity,
    points:
      granularity === 'weekly' ? toWeeklyPoints(dailyPoints) : dailyPoints,
    startDate: effectiveStart
  };
}

function alignIndexedPoints({
  benchmarkPrices,
  endDate,
  portfolioValues,
  startDate
}: {
  benchmarkPrices: readonly { date: string; value: number }[];
  endDate: string;
  portfolioValues: readonly { date: string; value: number }[];
  startDate: string;
}): {
  date: string;
  portfolioReturn: number;
  benchmarkReturn: number;
}[] {
  let benchmarkCursor = 0;
  let lastBenchmark: number | undefined;
  const raw: {
    date: string;
    portfolio: number;
    benchmark: number;
  }[] = [];

  for (const portfolio of portfolioValues) {
    if (portfolio.date < startDate || portfolio.date > endDate) {
      continue;
    }

    while (
      benchmarkCursor < benchmarkPrices.length &&
      benchmarkPrices[benchmarkCursor].date <= portfolio.date
    ) {
      lastBenchmark = benchmarkPrices[benchmarkCursor].value;
      benchmarkCursor++;
    }

    if (lastBenchmark === undefined) {
      continue;
    }

    raw.push({
      date: portfolio.date,
      portfolio: portfolio.value,
      benchmark: lastBenchmark
    });
  }

  if (raw.length === 0) {
    return [];
  }

  const basePortfolio = raw[0].portfolio;
  const baseBenchmark = raw[0].benchmark;

  if (basePortfolio === 0 || baseBenchmark === 0) {
    return [];
  }

  return raw.map(({ date, portfolio, benchmark }) => {
    return {
      date,
      portfolioReturn: (portfolio / basePortfolio) * 100,
      benchmarkReturn: (benchmark / baseBenchmark) * 100
    };
  });
}

function readPortfolioValues(
  history: readonly HistoricalDataItem[]
): { date: string; value: number }[] {
  const pointsByDate = new Map<string, number>();

  for (const item of history) {
    const value = readPortfolioValue(item);

    if (value === undefined) {
      continue;
    }

    pointsByDate.set(item.date, value);
  }

  return [...pointsByDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, value]) => {
      return { date, value };
    });
}

function readBenchmarkPrices(
  history: readonly BenchmarkPricePoint[]
): { date: string; value: number }[] {
  const pointsByDate = new Map<string, number>();

  for (const item of history) {
    if (!Number.isFinite(item.marketPrice)) {
      continue;
    }

    pointsByDate.set(item.date, item.marketPrice);
  }

  return [...pointsByDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, value]) => {
      return { date, value };
    });
}

function readPortfolioValue(item: HistoricalDataItem): number | undefined {
  if (Number.isFinite(item.netWorth)) {
    return item.netWorth;
  }

  const holdings = item.valueWithCurrencyEffect ?? item.value;
  const cash = item.totalCashInBaseCurrency;

  if (!Number.isFinite(holdings) && !Number.isFinite(cash)) {
    return undefined;
  }

  return (holdings ?? 0) + (cash ?? 0);
}

function resolveGranularity({
  endDate,
  startDate
}: {
  endDate: string;
  startDate: string;
}): 'daily' | 'weekly' {
  const start = parse(startDate, DATE_FORMAT, new Date());
  const end = parse(endDate, DATE_FORMAT, new Date());

  return end.getTime() <= addYears(start, 2).getTime() ? 'daily' : 'weekly';
}

function toWeeklyPoints(
  points: {
    date: string;
    portfolioReturn: number;
    benchmarkReturn: number;
  }[]
) {
  const pointsByWeek = new Map<
    string,
    { date: string; portfolioReturn: number; benchmarkReturn: number }
  >();

  for (const point of points) {
    const weekStart = format(
      startOfWeek(parse(point.date, DATE_FORMAT, new Date()), {
        weekStartsOn: WEEK_STARTS_ON_MONDAY
      }),
      DATE_FORMAT
    );

    pointsByWeek.set(weekStart, point);
  }

  return [...pointsByWeek.values()];
}
