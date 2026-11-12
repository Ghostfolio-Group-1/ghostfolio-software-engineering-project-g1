import { useCallback, useEffect, useRef, useState } from 'react';

import type { DashboardCardStatus } from '../dashboard-card/dashboard-card';
import { fetchWaterfall, waterfallErrorMessage } from './waterfall.client';
import type {
  WaterfallData,
  WaterfallFetch,
  WaterfallRangeQuery
} from './waterfall.client';

export interface WaterfallState {
  data: WaterfallData | null;
  error: Error | null;
  status: DashboardCardStatus;
}

export { waterfallErrorMessage };

/**
 * Charts-owned React hook for GET /api/v1/charts/waterfall. The host must
 * supply an authenticated fetch adapter. Inline request identity alone does
 * not refetch — call reload() when auth/impersonation changes.
 */
export function useWaterfall(
  query: WaterfallRangeQuery,
  request: WaterfallFetch
) {
  const [state, setState] = useState<WaterfallState>({
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
  const breakdownKey = query.breakdown ?? 'portfolio';

  useEffect(() => {
    requestRef.current = request;
  }, [request]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setState({ data: null, error: null, status: 'loading' });

    fetchWaterfall(query, requestRef.current, controller.signal)
      .then((data) => {
        if (active) {
          setState({
            data,
            error: null,
            status: data.segments.length === 0 ? 'empty' : 'ready'
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
    // query is summarized via rangeKey/breakdownKey so callers can pass a
    // fresh object each render without retriggering the fetch.
  }, [breakdownKey, rangeKey, revision]);

  return { ...state, reload };
}
