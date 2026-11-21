import { useCallback, useEffect, useRef, useState } from 'react';

import type { DashboardCardStatus } from '../dashboard-card/dashboard-card';
import {
  benchmarkErrorMessage,
  fetchBenchmarkComparison
} from './benchmark.client';
import type {
  BenchmarkComparisonData,
  BenchmarkFetch,
  BenchmarkRangeQuery
} from './benchmark.client';

export interface BenchmarkState {
  data: BenchmarkComparisonData | null;
  error: Error | null;
  status: DashboardCardStatus;
}

export { benchmarkErrorMessage };

/**
 * Charts-owned React hook for GET /api/v1/charts/benchmark-comparison. The
 * host must supply an authenticated fetch adapter. Inline request identity
 * alone does not refetch — call reload() when auth/impersonation changes.
 */
export function useBenchmark(
  query: BenchmarkRangeQuery,
  request: BenchmarkFetch
) {
  const [state, setState] = useState<BenchmarkState>({
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
  const benchmarkKey = query.benchmark ?? 'SPY';

  useEffect(() => {
    requestRef.current = request;
  }, [request]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setState({ data: null, error: null, status: 'loading' });

    fetchBenchmarkComparison(query, requestRef.current, controller.signal)
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
    // query is summarized via rangeKey/benchmarkKey so callers can pass a
    // fresh object each render without retriggering the fetch.
  }, [benchmarkKey, rangeKey, revision]);

  return { ...state, reload };
}
