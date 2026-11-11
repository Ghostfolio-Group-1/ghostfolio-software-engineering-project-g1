import { format, parse, startOfWeek } from 'date-fns';

import { resolveChartGranularity } from './chart-series';
import { DATE_FORMAT } from './helper';
import { HistoricalDataItem } from './interfaces/historical-data-item.interface';
import {
  ReturnComparisonPoint,
  ReturnComparisonResponse
} from './interfaces/return-comparison-response.interface';

const WEEK_STARTS_ON_MONDAY = 1;

interface ReturnLevel {
  date: string;
  dividend: number;
  flow: number;
  sold: boolean;
  value: number;
}

export interface ReturnComparisonObservation {
  date: string;
  dividend?: number;
  // External cash added on this date. A purchase is positive and sale
  // proceeds are negative. The return subtracts this so the flow is not
  // mistaken for a gain or loss.
  flow?: number;
  sold?: boolean;
  symbol?: string;
  value: number;
}

export interface ReturnActivityInput {
  date: string;
  quantity: number;
  symbol: string;
  type: 'BUY' | 'DIVIDEND' | 'SELL';
  valueInBaseCurrency: number;
}

export class ReturnComparisonSymbolNotFoundError extends Error {
  public constructor(symbol: string) {
    super(`No holding found for symbol "${symbol}" in the selected range`);
    this.name = 'ReturnComparisonSymbolNotFoundError';
  }
}

export function toReturnComparison({
  endDate,
  observations,
  startDate,
  symbol
}: {
  endDate: string;
  observations: ReturnComparisonObservation[];
  startDate: string;
  symbol?: string;
}): ReturnComparisonResponse {
  const selected = selectObservations(observations, symbol, startDate, endDate);
  const points = indexPortfolio(selected, endDate);
  const granularity = resolveChartGranularity({ endDate, startDate });

  return {
    endDate,
    granularity,
    points: granularity === 'weekly' ? toWeeklyPoints(points) : points,
    startDate
  };
}

/**
 * Portfolio scope uses the performance chart's holding value, with buys and
 * sells removed as cash flow and dividends added only to total return.
 * A symbol scope rebuilds that holding from its own trades and, when prices
 * are in the account currency, its market prices.
 */
export function activitiesToObservations({
  activities,
  history,
  prices = [],
  symbol
}: {
  activities: readonly ReturnActivityInput[];
  history: readonly HistoricalDataItem[];
  prices?: readonly { date: string; marketPrice: number }[];
  symbol?: string;
}): ReturnComparisonObservation[] {
  const named = symbol?.trim();
  const selected = named
    ? activities.filter((activity) => {
        return activity.symbol === named;
      })
    : activities;

  if (named && selected.length === 0) {
    return [];
  }

  if (!named) {
    return portfolioObservations(history, selected);
  }

  return symbolObservations(named, selected, prices);
}

function selectObservations(
  observations: ReturnComparisonObservation[],
  symbol: string | undefined,
  startDate: string,
  endDate: string
): ReturnComparisonObservation[] {
  const scoped = symbol
    ? observations.filter((observation) => {
        return observation.symbol === symbol;
      })
    : observations;

  if (symbol && scoped.length === 0) {
    throw new ReturnComparisonSymbolNotFoundError(symbol);
  }

  const inRange = scoped.filter((observation) => {
    return observation.date >= startDate && observation.date <= endDate;
  });

  if (symbol && inRange.length === 0) {
    throw new ReturnComparisonSymbolNotFoundError(symbol);
  }

  return inRange;
}

function indexPortfolio(
  observations: ReturnComparisonObservation[],
  endDate: string
): ReturnComparisonPoint[] {
  const symbols = [
    ...new Set(
      observations.map((observation) => {
        return observation.symbol ?? '';
      })
    )
  ];
  const timelines = symbols.map((symbol) => {
    return timelineForSymbol(
      observations.filter((observation) => {
        return (observation.symbol ?? '') === symbol;
      }),
      endDate
    );
  });
  const dates = [
    ...new Set(
      timelines.flatMap((timeline) => {
        return timeline.map((level) => {
          return level.date;
        });
      })
    )
  ].sort((left, right) => {
    return left.localeCompare(right);
  });

  if (dates.length === 0) {
    return [];
  }

  // Chain each holding's own change from the previous date. A holding that
  // first appears on a date is new money, so it is left out of that day's
  // ratio instead of being counted as a return.
  let priceIndex = 100;
  let totalIndex = 100;
  const points: ReturnComparisonPoint[] = [
    { date: dates[0], priceReturn: 100, totalReturn: 100 }
  ];

  for (let index = 1; index < dates.length; index++) {
    const date = dates[index];
    let begin = 0;
    let endPrice = 0;
    let endTotal = 0;

    for (const timeline of timelines) {
      const previous = levelAt(timeline, dates[index - 1]);

      if (!previous || previous.sold) {
        continue;
      }

      const current = levelAt(timeline, date);

      begin += previous.value;
      endPrice += (current?.value ?? previous.value) - (current?.flow ?? 0);
      // A dividend is included in that day's total-return ratio. Later days
      // chain on the updated index, so the cash is reinvested at the
      // portfolio's own return.
      endTotal +=
        (current?.value ?? previous.value) -
        (current?.flow ?? 0) +
        (current?.dividend ?? 0);
    }

    if (begin !== 0) {
      priceIndex *= endPrice / begin;
      totalIndex *= endTotal / begin;
    }

    points.push({
      date,
      priceReturn: roundReturn(priceIndex),
      totalReturn: roundReturn(totalIndex)
    });
  }

  return points;
}

function portfolioObservations(
  history: readonly HistoricalDataItem[],
  activities: readonly ReturnActivityInput[]
): ReturnComparisonObservation[] {
  const values = readHoldingValues(history);

  if (values.length === 0) {
    return [];
  }

  const cashByDate = new Map<string, { dividend: number; flow: number }>();

  for (const activity of activities) {
    if (!Number.isFinite(activity.valueInBaseCurrency)) {
      continue;
    }

    if (activity.date < values[0].date) {
      continue;
    }

    const target =
      values.find((point) => {
        return point.date >= activity.date;
      })?.date ?? values[values.length - 1].date;
    const current = cashByDate.get(target) ?? { dividend: 0, flow: 0 };

    if (activity.type === 'DIVIDEND') {
      current.dividend += activity.valueInBaseCurrency;
    } else if (activity.type === 'BUY') {
      current.flow += activity.valueInBaseCurrency;
    } else if (activity.type === 'SELL') {
      current.flow -= activity.valueInBaseCurrency;
    }

    cashByDate.set(target, current);
  }

  let previous: number | undefined;

  return values.map((point) => {
    const cash = cashByDate.get(point.date);
    const sold =
      previous !== undefined &&
      previous > 0 &&
      point.value === 0 &&
      (cash?.flow ?? 0) < 0;

    previous = point.value;

    return toObservation({
      date: point.date,
      dividend: cash?.dividend,
      flow: cash?.flow,
      sold,
      value: point.value
    });
  });
}

function symbolObservations(
  symbol: string,
  activities: readonly ReturnActivityInput[],
  prices: readonly { date: string; marketPrice: number }[]
): ReturnComparisonObservation[] {
  const byDate = new Map<string, ReturnActivityInput[]>();

  for (const activity of activities) {
    const day = byDate.get(activity.date) ?? [];
    day.push(activity);
    byDate.set(activity.date, day);
  }

  const priceByDate = new Map<string, number>();

  for (const price of prices) {
    if (Number.isFinite(price.marketPrice)) {
      priceByDate.set(price.date, price.marketPrice);
    }
  }

  const firstActivity = [...byDate.keys()].sort((left, right) => {
    return left.localeCompare(right);
  })[0];
  const dates = [...new Set([...byDate.keys(), ...priceByDate.keys()])]
    .filter((date) => {
      return date >= firstActivity;
    })
    .sort((left, right) => {
      return left.localeCompare(right);
    });

  let carriedCost = 0;
  let carriedPrice: number | undefined;
  let closed = false;
  let quantity = 0;
  const points: ReturnComparisonObservation[] = [];

  for (const date of dates) {
    if (closed) {
      points.push({ date, sold: true, symbol, value: 0 });
      continue;
    }

    let dividend = 0;
    let flow = 0;
    let soldToday = false;

    for (const activity of byDate.get(date) ?? []) {
      if (!Number.isFinite(activity.valueInBaseCurrency)) {
        continue;
      }

      if (activity.type === 'DIVIDEND') {
        dividend += activity.valueInBaseCurrency;
        continue;
      }

      if (activity.type === 'BUY') {
        quantity += activity.quantity;
        carriedCost += activity.valueInBaseCurrency;
        flow += activity.valueInBaseCurrency;
        continue;
      }

      const fraction =
        quantity > 0 ? Math.min(1, activity.quantity / quantity) : 1;

      quantity = Math.max(0, quantity - activity.quantity);
      carriedCost *= 1 - fraction;
      flow -= activity.valueInBaseCurrency;

      if (quantity <= 1e-8) {
        quantity = 0;
        carriedCost = 0;
        soldToday = true;
      }
    }

    if (priceByDate.has(date)) {
      carriedPrice = priceByDate.get(date);
    }

    const value =
      quantity === 0
        ? 0
        : prices.length > 0 && carriedPrice !== undefined
          ? quantity * carriedPrice
          : carriedCost;

    points.push(
      toObservation({
        date,
        dividend,
        flow,
        sold: soldToday,
        symbol,
        value
      })
    );

    if (soldToday) {
      closed = true;
    }
  }

  return points;
}

function readHoldingValues(
  history: readonly HistoricalDataItem[]
): { date: string; value: number }[] {
  const pointsByDate = new Map<string, number>();

  for (const item of history) {
    const value = readHoldingValue(item);

    if (value === undefined) {
      continue;
    }

    pointsByDate.set(item.date, value);
  }

  return [...pointsByDate.entries()]
    .sort(([left], [right]) => {
      return left.localeCompare(right);
    })
    .map(([date, value]) => {
      return { date, value };
    });
}

function readHoldingValue(item: HistoricalDataItem): number | undefined {
  if (Number.isFinite(item.valueWithCurrencyEffect)) {
    return item.valueWithCurrencyEffect;
  }

  if (Number.isFinite(item.value)) {
    return item.value;
  }

  if (Number.isFinite(item.netWorth)) {
    return item.netWorth;
  }

  return undefined;
}

function toObservation({
  date,
  dividend,
  flow,
  sold,
  symbol,
  value
}: {
  date: string;
  dividend?: number;
  flow?: number;
  sold?: boolean;
  symbol?: string;
  value: number;
}): ReturnComparisonObservation {
  return {
    date,
    value,
    ...(dividend ? { dividend } : {}),
    ...(flow ? { flow } : {}),
    ...(sold ? { sold: true } : {}),
    ...(symbol ? { symbol } : {})
  };
}

function timelineForSymbol(
  observations: ReturnComparisonObservation[],
  endDate: string
): ReturnLevel[] {
  const byDate = new Map<string, ReturnLevel>();

  for (const observation of observations) {
    const current = byDate.get(observation.date) ?? {
      date: observation.date,
      dividend: 0,
      flow: 0,
      sold: false,
      value: observation.value
    };

    current.dividend += observation.dividend ?? 0;
    current.flow += observation.flow ?? 0;
    current.sold = current.sold || observation.sold === true;
    current.value = observation.value;
    byDate.set(observation.date, current);
  }

  const levels = [...byDate.values()].sort((left, right) => {
    return left.date.localeCompare(right.date);
  });
  const sale = levels.find((level) => {
    return level.sold;
  });
  const timeline = levels.map((level) => {
    if (sale && level.date > sale.date) {
      return {
        date: level.date,
        dividend: 0,
        flow: 0,
        sold: true,
        value: sale.value
      };
    }

    return level;
  });

  if (sale && sale.date < endDate && !byDate.has(endDate)) {
    timeline.push({
      date: endDate,
      dividend: 0,
      flow: 0,
      sold: true,
      value: sale.value
    });
  }

  return timeline;
}

function levelAt(
  timeline: ReturnLevel[],
  date: string
): ReturnLevel | undefined {
  let match: ReturnLevel | undefined;

  for (const level of timeline) {
    if (level.date > date) {
      break;
    }

    match = level.date === date ? level : { ...level, dividend: 0, flow: 0 };
  }

  return match;
}

function roundReturn(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function toWeeklyPoints(
  points: ReturnComparisonPoint[]
): ReturnComparisonPoint[] {
  if (points.length === 0) {
    return [];
  }

  const lastByWeek = new Map<string, ReturnComparisonPoint>();

  for (const point of points) {
    lastByWeek.set(weekStart(point.date), point);
  }

  const weekly = [...lastByWeek.values()];
  const first = points[0];

  if (weekly[0]?.date !== first.date) {
    weekly.unshift(first);
  }

  return weekly;
}

function weekStart(date: string): string {
  return format(
    startOfWeek(parse(date, DATE_FORMAT, new Date()), {
      weekStartsOn: WEEK_STARTS_ON_MONDAY
    }),
    DATE_FORMAT
  );
}
