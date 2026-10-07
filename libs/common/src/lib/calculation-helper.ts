import { Big } from 'big.js';
import {
  endOfDay,
  endOfYear,
  max,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMilliseconds,
  subYears
} from 'date-fns';
import { isFinite, isNumber } from 'lodash';

import { resetHours } from './helper';
import { DateRange, TimeRangePreset, TimeRangeSelection } from './types';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export class InvalidTimeRangeError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InvalidTimeRangeError';
  }
}

export function getAnnualizedPerformancePercent({
  daysInMarket,
  netPerformancePercentage
}: {
  daysInMarket: number;
  netPerformancePercentage: Big;
}): Big {
  if (isNumber(daysInMarket) && daysInMarket > 0) {
    const exponent = new Big(365).div(daysInMarket).toNumber();
    const growthFactor = Math.pow(
      netPerformancePercentage.plus(1).toNumber(),
      exponent
    );

    if (isFinite(growthFactor)) {
      return new Big(growthFactor).minus(1);
    }
  }

  return new Big(0);
}

export function getIntervalFromDateRange(params: {
  dateRange: DateRange;
  endDate?: Date;
  now?: Date;
  startDate?: Date;
}) {
  const { dateRange } = params;
  const now = params.now ?? new Date();
  let endDate = params.endDate ?? endOfDay(now);
  let startDate = params.startDate ?? new Date(0);

  switch (dateRange) {
    case '1d':
      startDate = max([startDate, subDays(resetHours(now), 1)]);
      break;
    case 'mtd':
      startDate = max([startDate, subDays(startOfMonth(resetHours(now)), 1)]);
      break;
    case 'wtd':
      startDate = max([
        startDate,
        subDays(startOfWeek(resetHours(now), { weekStartsOn: 1 }), 1)
      ]);
      break;
    case 'ytd':
      startDate = max([startDate, subDays(startOfYear(resetHours(now)), 1)]);
      break;
    case '1y':
      startDate = max([startDate, subYears(resetHours(now), 1)]);
      break;
    case '5y':
      startDate = max([startDate, subYears(resetHours(now), 5)]);
      break;
    case 'max':
      break;
    default: {
      // '2024', '2023', '2022', etc.
      const yearStartDate = new Date(Number(dateRange), 0, 1);

      // Derive the boundaries of the calendar year in the local time zone, as
      // the consumers apply local time zone semantics. As the start date is
      // exclusive, the last millisecond of the preceding year is used.
      endDate = endOfYear(yearStartDate);
      startDate = max([startDate, subMilliseconds(yearStartDate, 1)]);
    }
  }

  return { endDate, startDate };
}

export function resolveTimeRange({
  earliestDate,
  now = new Date(),
  selection
}: {
  earliestDate?: Date;
  now?: Date;
  selection: TimeRangeSelection;
}): { endDate: Date; startDate: Date } {
  if (selection.mode === 'preset') {
    return getIntervalFromDateRange({
      dateRange: toDateRange(selection.preset),
      now,
      startDate: earliestDate
    });
  }

  const startParts = parseCalendarDate(selection.startDate, 'startDate');
  const endParts = parseCalendarDate(selection.endDate, 'endDate');
  const startDate = clampStart(startOfCalendarDate(startParts), earliestDate);
  const endDate = clampEnd(endOfCalendarDate(endParts), now);

  if (endDate.getTime() < startDate.getTime()) {
    throw new InvalidTimeRangeError('endDate must not be before startDate');
  }

  return { endDate, startDate };
}

function toDateRange(preset: TimeRangePreset): DateRange {
  return preset === 'today' ? '1d' : preset;
}

function parseCalendarDate(
  value: string,
  label: 'startDate' | 'endDate'
): { day: number; month: number; year: number } {
  const match = ISO_DATE.exec(value);

  if (!match) {
    throw new InvalidTimeRangeError(
      `${label} must be an ISO date (YYYY-MM-DD)`
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));

  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new InvalidTimeRangeError(`${label} is not a valid calendar date`);
  }

  return { day, month, year };
}

function startOfCalendarDate({
  day,
  month,
  year
}: {
  day: number;
  month: number;
  year: number;
}): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function endOfCalendarDate({
  day,
  month,
  year
}: {
  day: number;
  month: number;
  year: number;
}): Date {
  return endOfDay(new Date(year, month - 1, day));
}

function clampStart(startDate: Date, earliestDate?: Date): Date {
  if (!earliestDate) {
    return startDate;
  }

  return max([startDate, earliestDate]);
}

function clampEnd(endDate: Date, now: Date): Date {
  const today = endOfDay(now);

  return endDate.getTime() > today.getTime() ? today : endDate;
}
