import { addYears, format, parse, startOfWeek } from 'date-fns';

import { DATE_FORMAT } from './helper';
import {
  ChartSeriesGranularity,
  ChartSeriesKind,
  ChartSeriesPoint,
  ChartSeriesResponse
} from './interfaces/chart-series-response.interface';
import { HistoricalDataItem } from './interfaces/historical-data-item.interface';

const WEEK_STARTS_ON_MONDAY = 1;

export function toChartSeriesResponse({
  endDate,
  history,
  kind = 'portfolioValue',
  startDate
}: {
  endDate: string;
  history: HistoricalDataItem[];
  kind?: ChartSeriesKind;
  startDate: string;
}): ChartSeriesResponse {
  const dailyPoints = toDailyPoints({ endDate, history, kind, startDate });
  const granularity = resolveChartGranularity({ endDate, startDate });

  return {
    endDate,
    granularity,
    kind,
    points:
      granularity === 'weekly' ? toWeeklyPoints(dailyPoints) : dailyPoints,
    startDate
  };
}

export function resolveChartGranularity({
  endDate,
  startDate
}: {
  endDate: string;
  startDate: string;
}): ChartSeriesGranularity {
  const start = parse(startDate, DATE_FORMAT, new Date());
  const end = parse(endDate, DATE_FORMAT, new Date());

  return end.getTime() <= addYears(start, 2).getTime() ? 'daily' : 'weekly';
}

function toDailyPoints({
  endDate,
  history,
  kind,
  startDate
}: {
  endDate: string;
  history: HistoricalDataItem[];
  kind: ChartSeriesKind;
  startDate: string;
}): ChartSeriesPoint[] {
  const portfolioPoints = readPoints({
    endDate,
    history,
    kind: 'portfolioValue',
    startDate
  });

  if (kind === 'portfolioValue') {
    return portfolioPoints;
  }

  // Invested capital is a step function. The cumulative total changes only
  // when a contribution is recorded and then holds on every later
  // portfolio-value date, including dates with no new activity. Cash is the
  // running balance sampled on that same date index. Neither series is
  // interpolated between those dates.
  return sampleOnDates({
    dates: portfolioPoints.map(({ date }) => {
      return date;
    }),
    history,
    kind
  });
}

function readPoints({
  endDate,
  history,
  kind,
  startDate
}: {
  endDate: string;
  history: HistoricalDataItem[];
  kind: ChartSeriesKind;
  startDate: string;
}): ChartSeriesPoint[] {
  const pointsByDate = new Map<string, number>();

  for (const item of history) {
    if (item.date < startDate || item.date > endDate) {
      continue;
    }

    const value = readSeriesValue(item, kind);

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

function sampleOnDates({
  dates,
  history,
  kind
}: {
  dates: string[];
  history: HistoricalDataItem[];
  kind: ChartSeriesKind;
}): ChartSeriesPoint[] {
  const ordered = [...history].sort((left, right) => {
    return left.date.localeCompare(right.date);
  });
  let cursor = 0;
  let last = 0;

  return dates.map((date) => {
    while (cursor < ordered.length && ordered[cursor].date <= date) {
      const value = readSeriesValue(ordered[cursor], kind);

      if (value !== undefined) {
        last = value;
      }

      cursor++;
    }

    return { date, value: last };
  });
}

function toWeeklyPoints(points: ChartSeriesPoint[]): ChartSeriesPoint[] {
  const pointsByWeek = new Map<string, ChartSeriesPoint>();

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

function readSeriesValue(
  item: HistoricalDataItem,
  kind: ChartSeriesKind
): number | undefined {
  const value = SERIES_VALUE[kind](item);

  return Number.isFinite(value) ? value : undefined;
}

const SERIES_VALUE: Record<
  ChartSeriesKind,
  (item: HistoricalDataItem) => number | undefined
> = {
  cash: (item) => item.totalCashInBaseCurrency,
  investedCapital: (item) => {
    // Running cumulative total already stored on the history snapshot.
    return item.totalInvestmentValueWithCurrencyEffect ?? item.totalInvestment;
  },
  portfolioValue: (item) => {
    // The portfolio calculator already sums holdings and cash into netWorth.
    // Rows that only carry the parts are added together here.
    if (isFiniteNumber(item.netWorth)) {
      return item.netWorth;
    }

    const holdings = item.valueWithCurrencyEffect ?? item.value;
    const cash = item.totalCashInBaseCurrency;

    if (!isFiniteNumber(holdings) && !isFiniteNumber(cash)) {
      return undefined;
    }

    return (holdings ?? 0) + (cash ?? 0);
  }
};

function isFiniteNumber(value: number | undefined): value is number {
  return Number.isFinite(value);
}
