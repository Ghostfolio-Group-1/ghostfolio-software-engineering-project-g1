import { format, parse, startOfWeek } from 'date-fns';

import { resolveChartGranularity } from './chart-series';
import { DATE_FORMAT } from './helper';
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
  // proceeds are negative. Aggregate returns subtract this so the flow is
  // not mistaken for a gain or loss.
  flow?: number;
  sold?: boolean;
  symbol?: string;
  value: number;
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
  const points = symbol
    ? indexLevels(timelineForSymbol(selected, endDate))
    : indexPortfolio(selected, endDate);
  const granularity = resolveChartGranularity({ endDate, startDate });

  return {
    endDate,
    granularity,
    points: granularity === 'weekly' ? toWeeklyPoints(points) : points,
    startDate
  };
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
      // Dividends are added as cash on the date they are received.
      // The total-return index does not assume that cash bought more shares.
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

function indexLevels(levels: ReturnLevel[]): ReturnComparisonPoint[] {
  const base = levels[0]?.value;

  if (!base) {
    return [];
  }

  // Dividends are added as cash on the date they are received.
  // The total-return index does not assume that cash bought more shares.
  let dividendsSinceStart = 0;

  return levels.map((level, index) => {
    if (index > 0) {
      dividendsSinceStart += level.dividend;
    }

    return {
      date: level.date,
      priceReturn: roundReturn((100 * level.value) / base),
      totalReturn: roundReturn(
        (100 * (level.value + dividendsSinceStart)) / base
      )
    };
  });
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
