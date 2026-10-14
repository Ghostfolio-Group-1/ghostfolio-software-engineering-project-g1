import {
  InvalidTimeRangeError,
  resolveTimeRange
} from '@ghostfolio/common/calculation-helper';
import { toChartSeriesResponse } from '@ghostfolio/common/chart-series';
import { DATE_FORMAT } from '@ghostfolio/common/helper';
import {
  CHART_SERIES_KINDS,
  ChartSeriesKind,
  ChartSeriesResponse
} from '@ghostfolio/common/interfaces/chart-series-response.interface';
import { HistoricalDataItem } from '@ghostfolio/common/interfaces/historical-data-item.interface';
import {
  TIME_RANGE_PRESETS,
  TimeRangePreset,
  TimeRangeSelection
} from '@ghostfolio/common/types/time-range-selection.type';

import { BadRequestException } from '@nestjs/common';
import { format } from 'date-fns';

export interface ChartSeriesRequest {
  earliestActivityDate?: string;
  endDate?: string;
  history?: HistoricalDataItem[];
  kind?: ChartSeriesKind;
  now?: Date;
  range?: string;
  startDate?: string;
}

export class ChartsApi {
  public getSeries(request: ChartSeriesRequest = {}): ChartSeriesResponse {
    const kind = this.readKind(request.kind);
    const now = request.now instanceof Date ? request.now : new Date();
    const selection = this.readSelection(request);

    if (
      selection.mode === 'custom' &&
      request.earliestActivityDate &&
      selection.endDate < request.earliestActivityDate
    ) {
      return this.emptySeries({
        endDate: selection.endDate,
        kind,
        startDate: selection.startDate
      });
    }

    const window = this.resolveWindow({
      earliestActivityDate: request.earliestActivityDate,
      now,
      selection
    });

    if (window.empty) {
      return this.emptySeries({
        endDate: window.endDate,
        kind,
        startDate: window.startDate
      });
    }

    return toChartSeriesResponse({
      endDate: window.endDate,
      history: request.history ?? [],
      kind,
      startDate: window.startDate
    });
  }

  private emptySeries({
    endDate,
    kind,
    startDate
  }: {
    endDate: string;
    kind: ChartSeriesKind;
    startDate: string;
  }): ChartSeriesResponse {
    return toChartSeriesResponse({
      endDate,
      history: [],
      kind,
      startDate
    });
  }

  private readKind(kind: ChartSeriesKind | undefined): ChartSeriesKind {
    if (!kind) {
      return 'portfolioValue';
    }

    if (!CHART_SERIES_KINDS.includes(kind)) {
      throw new BadRequestException(
        `kind must be one of: ${CHART_SERIES_KINDS.join(', ')}`
      );
    }

    return kind;
  }

  private readSelection(request: ChartSeriesRequest): TimeRangeSelection {
    const hasRange = request.range !== undefined && request.range !== '';
    const hasStart =
      request.startDate !== undefined && request.startDate !== '';
    const hasEnd = request.endDate !== undefined && request.endDate !== '';

    if (hasRange && (hasStart || hasEnd)) {
      throw new BadRequestException(
        'range and startDate/endDate are mutually exclusive'
      );
    }

    if (!hasRange && !hasStart && !hasEnd) {
      throw new BadRequestException(
        'Provide either range or both startDate and endDate'
      );
    }

    if (hasStart !== hasEnd) {
      throw new BadRequestException(
        'startDate and endDate must both be provided'
      );
    }

    if (hasRange) {
      return {
        mode: 'preset',
        preset: this.readPreset(request.range)
      };
    }

    return {
      endDate: request.endDate,
      mode: 'custom',
      startDate: request.startDate
    };
  }

  private readPreset(range: string): TimeRangePreset {
    if (range === '1d') {
      return 'today';
    }

    if (TIME_RANGE_PRESETS.includes(range as TimeRangePreset)) {
      return range as TimeRangePreset;
    }

    throw new BadRequestException(
      `range must be one of: 1d, ${TIME_RANGE_PRESETS.filter((preset) => {
        return preset !== 'today';
      }).join(', ')}`
    );
  }

  private resolveWindow({
    earliestActivityDate,
    now,
    selection
  }: {
    earliestActivityDate?: string;
    now: Date;
    selection: TimeRangeSelection;
  }): { empty: boolean; endDate: string; startDate: string } {
    if (
      selection.mode === 'custom' &&
      selection.endDate < selection.startDate
    ) {
      throw new BadRequestException('endDate must not be before startDate');
    }

    try {
      const interval = resolveTimeRange({
        earliestDate: earliestActivityDate
          ? utcCalendarDate(earliestActivityDate)
          : undefined,
        now,
        selection
      });

      if (selection.mode === 'custom') {
        return servedCustomWindow({ earliestActivityDate, now, selection });
      }

      return {
        empty: false,
        endDate: format(interval.endDate, DATE_FORMAT),
        startDate: utcCalendarIso(interval.startDate)
      };
    } catch (error) {
      if (error instanceof InvalidTimeRangeError) {
        if (
          selection.mode === 'custom' &&
          selection.endDate >= selection.startDate &&
          !error.message.includes('ISO') &&
          !error.message.includes('calendar')
        ) {
          return {
            empty: true,
            endDate: selection.endDate,
            startDate: selection.startDate
          };
        }

        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }
}

function servedCustomWindow({
  earliestActivityDate,
  now,
  selection
}: {
  earliestActivityDate?: string;
  now: Date;
  selection: { endDate: string; startDate: string };
}): { empty: boolean; endDate: string; startDate: string } {
  const today = format(now, DATE_FORMAT);
  let startDate = selection.startDate;
  let endDate = selection.endDate;

  if (endDate > today) {
    endDate = today;
  }

  if (earliestActivityDate && startDate < earliestActivityDate) {
    startDate = earliestActivityDate;
  }

  if (startDate > endDate) {
    return {
      empty: true,
      endDate: selection.endDate,
      startDate: selection.startDate
    };
  }

  return { empty: false, endDate, startDate };
}

function utcCalendarDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day));
}

function utcCalendarIso(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
