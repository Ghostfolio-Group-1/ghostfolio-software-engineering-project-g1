import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiRequestError, requestApi } from '../data/api-request';
import type { AuthenticatedFetch } from '../data/api-request';

// Mirrors ChartSeriesResponse from @ghostfolio/common. Kept local so the
// React library does not depend on Nest/API packages at runtime.
export const CHART_SERIES_KINDS = [
  'portfolioValue',
  'investedCapital',
  'cash'
] as const;

export type ChartSeriesKind = (typeof CHART_SERIES_KINDS)[number];
export type ChartSeriesGranularity = 'daily' | 'weekly';

export interface ChartSeriesPoint {
  date: string;
  value: number;
}

export interface ChartSeriesData {
  endDate: string;
  granularity: ChartSeriesGranularity;
  kind: ChartSeriesKind;
  points: ChartSeriesPoint[];
  startDate: string;
}

export type ChartSeriesStatus = 'empty' | 'error' | 'loading' | 'ready';
export type ChartSeriesFetch = AuthenticatedFetch;

export type ChartSeriesRangeQuery =
  | { kind?: ChartSeriesKind; range: string }
  | {
      endDate: string;
      kind?: ChartSeriesKind;
      startDate: string;
    };

export interface ChartSeriesState {
  data: ChartSeriesData | null;
  error: Error | null;
  status: ChartSeriesStatus;
}

function buildSeriesUrl(query: ChartSeriesRangeQuery): string {
  const params = new URLSearchParams();

  if ('range' in query) {
    params.set('range', query.range);
  } else {
    params.set('startDate', query.startDate);
    params.set('endDate', query.endDate);
  }

  if (query.kind) {
    params.set('kind', query.kind);
  }

  return `/api/v1/charts/series?${params.toString()}`;
}

function isChartSeriesData(value: unknown): value is ChartSeriesData {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const data = value as ChartSeriesData;

  return (
    typeof data.endDate === 'string' &&
    typeof data.startDate === 'string' &&
    (data.granularity === 'daily' || data.granularity === 'weekly') &&
    CHART_SERIES_KINDS.includes(data.kind) &&
    Array.isArray(data.points) &&
    data.points.every(
      (point) =>
        point &&
        typeof point.date === 'string' &&
        typeof point.value === 'number' &&
        Number.isFinite(point.value)
    )
  );
}

/**
 * Safe UI copy for chart-series failures. Branch on status/code — never show
 * raw backend error text.
 */
export function chartSeriesErrorMessage(error: Error | null): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return 'Please sign in to view charts';
    }

    if (error.code === 'CHARTS_INVALID_QUERY') {
      return 'That chart range is not valid';
    }

    if (error.code === 'CHARTS_SERIES_FAILED') {
      return 'Unable to load the chart series';
    }
  }

  return 'Chart data is unavailable';
}

/**
 * Retrieve a Charts series response through the host's authenticated fetch.
 * Native fetch is not accepted as a default — it skips Ghostfolio auth.
 */
export async function fetchChartSeries(
  query: ChartSeriesRangeQuery,
  request: ChartSeriesFetch,
  signal?: AbortSignal
): Promise<ChartSeriesData> {
  const data = await requestApi<unknown>(
    request,
    buildSeriesUrl(query),
    signal
  );

  if (!isChartSeriesData(data)) {
    throw new ApiRequestError(
      200,
      'INVALID_RESPONSE',
      'Invalid chart-series API response'
    );
  }

  return data;
}

/**
 * Charts-owned React hook for GET /api/v1/charts/series. The host must supply
 * an authenticated fetch adapter. Inline request identity alone does not
 * refetch — call reload() when auth/impersonation changes.
 */
export function useChartSeries(
  query: ChartSeriesRangeQuery,
  request: ChartSeriesFetch
) {
  const [state, setState] = useState<ChartSeriesState>({
    data: null,
    error: null,
    status: 'loading'
  });
  const [revision, setRevision] = useState(0);
  const requestRef = useRef(request);
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  const rangeKey =
    'range' in query
      ? `range:${query.range}`
      : `custom:${query.startDate}:${query.endDate}`;
  const kindKey = query.kind ?? 'portfolioValue';

  useEffect(() => {
    requestRef.current = request;
  }, [request]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setState({ data: null, error: null, status: 'loading' });

    fetchChartSeries(query, requestRef.current, controller.signal)
      .then((data) => {
        if (active) {
          setState({
            data,
            error: null,
            status: data.points.length === 0 ? 'empty' : 'ready'
          });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            data: null,
            error: error instanceof Error ? error : new Error(String(error)),
            status: 'error'
          });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
    // query is summarized via rangeKey/kindKey so callers can pass a fresh
    // object each render without retriggering the fetch.
  }, [kindKey, rangeKey, revision]);

  return { ...state, reload };
}
