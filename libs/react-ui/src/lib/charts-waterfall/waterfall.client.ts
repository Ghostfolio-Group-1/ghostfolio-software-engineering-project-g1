import { requestApi } from '../data/api-request';
import type { AuthenticatedFetch } from '../data/api-request';
import { ApiRequestError } from '../data/api-request';

export const WATERFALL_BREAKDOWNS = ['portfolio', 'holding'] as const;
export const WATERFALL_CATEGORIES = [
  'netCashFlow',
  'marketGainLoss',
  'dividends'
] as const;

export type WaterfallBreakdown = (typeof WATERFALL_BREAKDOWNS)[number];
export type WaterfallCategory = (typeof WATERFALL_CATEGORIES)[number];

export type WaterfallSegment =
  | { kind: 'start'; label: string; value: number }
  | {
      category: WaterfallCategory;
      holdingSymbol?: string;
      kind: 'contribution';
      label: string;
      value: number;
    }
  | { kind: 'end'; label: string; value: number };

export interface WaterfallData {
  currency: string;
  endDate: string;
  segments: WaterfallSegment[];
  startDate: string;
}

export type WaterfallRangeQuery =
  | { breakdown?: WaterfallBreakdown; range: string }
  | {
      breakdown?: WaterfallBreakdown;
      endDate: string;
      startDate: string;
    };

export type WaterfallFetch = AuthenticatedFetch;

export interface WaterfallBar {
  category?: WaterfallCategory;
  holdingSymbol?: string;
  kind: WaterfallSegment['kind'];
  label: string;
  value: number;
  /** Data-space bottom of the bar (smaller of the two extents). */
  y0: number;
  /** Data-space top of the bar (larger of the two extents). */
  y1: number;
}

function buildWaterfallUrl(query: WaterfallRangeQuery): string {
  const params = new URLSearchParams();

  if ('range' in query) {
    params.set('range', query.range);
  } else {
    params.set('startDate', query.startDate);
    params.set('endDate', query.endDate);
  }

  if (query.breakdown && query.breakdown !== 'portfolio') {
    params.set('breakdown', query.breakdown);
  }

  return `/api/v1/charts/waterfall?${params.toString()}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isWaterfallSegment(value: unknown): value is WaterfallSegment {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const segment = value as WaterfallSegment;

  if (segment.kind === 'start' || segment.kind === 'end') {
    return typeof segment.label === 'string' && isFiniteNumber(segment.value);
  }

  if (segment.kind === 'contribution') {
    return (
      typeof segment.label === 'string' &&
      isFiniteNumber(segment.value) &&
      WATERFALL_CATEGORIES.includes(segment.category) &&
      (segment.holdingSymbol === undefined ||
        typeof segment.holdingSymbol === 'string')
    );
  }

  return false;
}

function isWaterfallData(value: unknown): value is WaterfallData {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const data = value as WaterfallData;

  return (
    typeof data.currency === 'string' &&
    typeof data.endDate === 'string' &&
    typeof data.startDate === 'string' &&
    Array.isArray(data.segments) &&
    data.segments.every(isWaterfallSegment)
  );
}

/**
 * Map Iteration 1 waterfall segments onto floating bars. Start and end are
 * absolute (from 0); contributions stack from the running total so
 * start + contributions === end in data space.
 */
export function toWaterfallBars(segments: WaterfallSegment[]): WaterfallBar[] {
  let running = 0;
  const bars: WaterfallBar[] = [];

  for (const segment of segments) {
    if (segment.kind === 'start') {
      running = segment.value;
      bars.push({
        kind: 'start',
        label: segment.label,
        value: segment.value,
        y0: Math.min(0, segment.value),
        y1: Math.max(0, segment.value)
      });
      continue;
    }

    if (segment.kind === 'contribution') {
      const next = running + segment.value;
      bars.push({
        category: segment.category,
        holdingSymbol: segment.holdingSymbol,
        kind: 'contribution',
        label: segment.label,
        value: segment.value,
        y0: Math.min(running, next),
        y1: Math.max(running, next)
      });
      running = next;
      continue;
    }

    bars.push({
      kind: 'end',
      label: segment.label,
      value: segment.value,
      y0: Math.min(0, segment.value),
      y1: Math.max(0, segment.value)
    });
  }

  return bars;
}

export function waterfallErrorMessage(error: Error | null): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return 'Please sign in to view charts';
    }

    if (error.status === 403) {
      return 'You do not have permission to view the chart.';
    }

    if (error.code === 'CHARTS_INVALID_QUERY') {
      return 'That chart range is not valid';
    }

    if (error.code === 'CHARTS_WATERFALL_FAILED') {
      return 'Unable to load the contribution chart';
    }
  }

  return 'Contribution chart data is unavailable';
}

/**
 * Retrieve a Charts waterfall response through the host's authenticated fetch.
 * Native fetch is not accepted as a default — it skips Ghostfolio auth.
 */
export async function fetchWaterfall(
  query: WaterfallRangeQuery,
  request: WaterfallFetch,
  signal?: AbortSignal
): Promise<WaterfallData> {
  const data = await requestApi<unknown>(
    request,
    buildWaterfallUrl(query),
    signal
  );

  if (!isWaterfallData(data)) {
    throw new ApiRequestError(
      200,
      'INVALID_RESPONSE',
      'Invalid waterfall API response'
    );
  }

  return data;
}
