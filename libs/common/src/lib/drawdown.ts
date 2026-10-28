import { addYears, format, parse, startOfWeek } from 'date-fns';

import { DATE_FORMAT } from './helper';
import {
  DrawdownPoint,
  DrawdownResponse
} from './interfaces/drawdown-response.interface';
import { HistoricalDataItem } from './interfaces/historical-data-item.interface';

const WEEK_STARTS_ON_MONDAY = 1;

/**
 * Drawdown from the running all-time peak of portfolio value.
 * Peak tracking always uses full history (even before startDate); only
 * points inside [startDate, endDate] are returned.
 */
export function toDrawdownResponse({
  endDate,
  history,
  startDate
}: {
  endDate: string;
  history: readonly HistoricalDataItem[];
  startDate: string;
}): DrawdownResponse {
  const values = readPortfolioValues(history);
  const dailyPoints = buildDrawdownPoints({
    endDate,
    startDate,
    values
  });
  const granularity = resolveGranularity({ endDate, startDate });
  const points =
    granularity === 'weekly' ? toWeeklyPoints(dailyPoints) : dailyPoints;
  const { maxDrawdown, maxDrawdownDate } = summarizeMaxDrawdown({
    fallbackDate: startDate,
    points
  });

  return {
    endDate,
    granularity,
    maxDrawdown,
    maxDrawdownDate,
    points,
    startDate
  };
}

function buildDrawdownPoints({
  endDate,
  startDate,
  values
}: {
  endDate: string;
  startDate: string;
  values: { date: string; value: number }[];
}): DrawdownPoint[] {
  let peak: number | undefined;
  const points: DrawdownPoint[] = [];

  for (const { date, value } of values) {
    if (peak === undefined || value > peak) {
      peak = value;
    }

    if (date < startDate || date > endDate) {
      continue;
    }

    const isNewPeak = value === peak;
    const drawdown =
      peak === 0 || peak === undefined ? 0 : (value - peak) / peak;

    points.push({ date, drawdown, isNewPeak });
  }

  return points;
}

function summarizeMaxDrawdown({
  fallbackDate,
  points
}: {
  fallbackDate: string;
  points: DrawdownPoint[];
}): { maxDrawdown: number; maxDrawdownDate: string } {
  if (points.length === 0) {
    return { maxDrawdown: 0, maxDrawdownDate: fallbackDate };
  }

  let maxDrawdown = points[0].drawdown;
  let maxDrawdownDate = points[0].date;

  for (const point of points) {
    if (point.drawdown < maxDrawdown) {
      maxDrawdown = point.drawdown;
      maxDrawdownDate = point.date;
    }
  }

  return { maxDrawdown, maxDrawdownDate };
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

function toWeeklyPoints(points: DrawdownPoint[]): DrawdownPoint[] {
  const pointsByWeek = new Map<string, DrawdownPoint>();

  for (const point of points) {
    const weekStart = format(
      startOfWeek(parse(point.date, DATE_FORMAT, new Date()), {
        weekStartsOn: WEEK_STARTS_ON_MONDAY
      }),
      DATE_FORMAT
    );

    pointsByWeek.set(weekStart, { ...point, date: weekStart });
  }

  return [...pointsByWeek.values()];
}
