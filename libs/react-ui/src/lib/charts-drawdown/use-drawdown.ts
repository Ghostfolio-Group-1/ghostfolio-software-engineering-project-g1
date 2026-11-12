import { useCallback, useEffect, useRef, useState } from 'react';

import type { DashboardCardStatus } from '../dashboard-card/dashboard-card';
import { drawdownErrorMessage, fetchDrawdown } from './drawdown.client';
import type {
  DrawdownData,
  DrawdownFetch,
  DrawdownRangeQuery
} from './drawdown.client';

export interface DrawdownState {
  data: DrawdownData | null;
  error: Error | null;
  status: DashboardCardStatus;
}

export { drawdownErrorMessage };

/**
 * Charts-owned React hook for GET /api/v1/charts/drawdown. The host must
 * supply an authenticated fetch adapter. Inline request identity alone does
 * not refetch — call reload() when auth/impersonation changes.
 */
export function useDrawdown(query: DrawdownRangeQuery, request: DrawdownFetch) {
  const [state, setState] = useState<DrawdownState>({
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

  useEffect(() => {
    requestRef.current = request;
  }, [request]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setState({ data: null, error: null, status: 'loading' });

    fetchDrawdown(query, requestRef.current, controller.signal)
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
    // query is summarized via rangeKey so callers can pass a fresh object
    // each render without retriggering the fetch.
  }, [rangeKey, revision]);

  return { ...state, reload };
}
