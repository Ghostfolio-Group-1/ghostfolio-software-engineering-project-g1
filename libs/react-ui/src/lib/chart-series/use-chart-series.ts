import type { ApiResponse } from '@ghostfolio/common/api-conventions';

import { useCallback, useEffect, useState } from 'react';

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
export type ChartSeriesFetch = typeof fetch;

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

const defaultRequest: ChartSeriesFetch = (input, init) => fetch(input, init);

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
 * Retrieve a Charts series response. Callers may inject their authenticated
 * fetch implementation. No chart rendering or aggregation lives here.
 */
export async function fetchChartSeries(
  query: ChartSeriesRangeQuery,
  request: ChartSeriesFetch = defaultRequest,
  signal?: AbortSignal
): Promise<ChartSeriesData> {
  const response = await request(buildSeriesUrl(query), {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    method: 'GET',
    signal
  });

  let body: ApiResponse<ChartSeriesData>;

  try {
    body = (await response.json()) as ApiResponse<ChartSeriesData>;
  } catch {
    throw new Error(`Chart series request failed (HTTP ${response.status})`);
  }

  if (!response.ok || body?.error) {
    throw new Error(
      body?.error?.message ??
        `Chart series request failed (HTTP ${response.status})`
    );
  }

  if (!isChartSeriesData(body?.data)) {
    throw new Error('Invalid chart-series API response');
  }

  return body.data;
}

/**
 * Charts-owned React hook for GET /api/v1/charts/series. The caller supplies
 * an authenticated fetch function when required by the host UI.
 */
export function useChartSeries(
  query: ChartSeriesRangeQuery,
  request: ChartSeriesFetch = defaultRequest
) {
  const [state, setState] = useState<ChartSeriesState>({
    data: null,
    error: null,
    status: 'loading'
  });
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  const rangeKey =
    'range' in query
      ? `range:${query.range}`
      : `custom:${query.startDate}:${query.endDate}`;
  const kindKey = query.kind ?? 'portfolioValue';

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setState({ data: null, error: null, status: 'loading' });

    fetchChartSeries(query, request, controller.signal)
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
  }, [kindKey, rangeKey, request, revision]);

  return { ...state, reload };
}
