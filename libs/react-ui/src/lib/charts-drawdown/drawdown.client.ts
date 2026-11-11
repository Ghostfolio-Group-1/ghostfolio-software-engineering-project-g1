import { requestApi } from '../data/api-request';
import type { AuthenticatedFetch } from '../data/api-request';
import { ApiRequestError } from '../data/api-request';

export type DrawdownGranularity = 'daily' | 'weekly';

export interface DrawdownPoint {
  date: string;
  drawdown: number;
  isNewPeak: boolean;
}

export interface DrawdownData {
  endDate: string;
  granularity: DrawdownGranularity;
  maxDrawdown: number;
  maxDrawdownDate: string;
  points: DrawdownPoint[];
  startDate: string;
}

export type DrawdownRangeQuery =
  { range: string } | { endDate: string; startDate: string };

export type DrawdownFetch = AuthenticatedFetch;

function buildDrawdownUrl(query: DrawdownRangeQuery): string {
  const params = new URLSearchParams();

  if ('range' in query) {
    params.set('range', query.range);
  } else {
    params.set('startDate', query.startDate);
    params.set('endDate', query.endDate);
  }

  return `/api/v1/charts/drawdown?${params.toString()}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isDrawdownPoint(value: unknown): value is DrawdownPoint {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const point = value as DrawdownPoint;

  return (
    typeof point.date === 'string' &&
    isFiniteNumber(point.drawdown) &&
    typeof point.isNewPeak === 'boolean'
  );
}

function isDrawdownData(value: unknown): value is DrawdownData {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const data = value as DrawdownData;

  return (
    typeof data.endDate === 'string' &&
    typeof data.startDate === 'string' &&
    (data.granularity === 'daily' || data.granularity === 'weekly') &&
    isFiniteNumber(data.maxDrawdown) &&
    typeof data.maxDrawdownDate === 'string' &&
    Array.isArray(data.points) &&
    data.points.every(isDrawdownPoint)
  );
}

/** Format a fractional drawdown (e.g. -0.125) as a percentage string. */
export function formatDrawdownPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function drawdownErrorMessage(error: Error | null): string {
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

    if (error.code === 'CHARTS_DRAWDOWN_FAILED') {
      return 'Unable to load the drawdown chart';
    }
  }

  return 'Drawdown chart data is unavailable';
}

/**
 * Retrieve a Charts drawdown response through the host's authenticated fetch.
 * Peak tracking stays on the live `GET /api/v1/charts/drawdown` route.
 */
export async function fetchDrawdown(
  query: DrawdownRangeQuery,
  request: DrawdownFetch,
  signal?: AbortSignal
): Promise<DrawdownData> {
  const data = await requestApi<unknown>(
    request,
    buildDrawdownUrl(query),
    signal
  );

  if (!isDrawdownData(data)) {
    throw new ApiRequestError(
      200,
      'INVALID_RESPONSE',
      'Invalid drawdown API response'
    );
  }

  return data;
}
