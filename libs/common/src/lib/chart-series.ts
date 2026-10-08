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
    return item.totalInvestmentValueWithCurrencyEffect ?? item.totalInvestment;
  },
  portfolioValue: (item) => item.valueWithCurrencyEffect ?? item.value
};
