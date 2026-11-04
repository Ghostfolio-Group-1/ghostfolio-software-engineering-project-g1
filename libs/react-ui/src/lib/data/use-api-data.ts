import { useCallback, useEffect, useRef, useState } from 'react';

import type { DashboardCardStatus } from '../dashboard-card/dashboard-card';

export interface ApiDataState<T> {
  data: T | null;
  error: Error | null;
  status: DashboardCardStatus;
}

/**
 * Generic loader for feature screens. `load` receives an AbortSignal; the
 * result maps straight onto DashboardCard's status. A new `load` callback does
 * not refetch on its own (inline callbacks change every render); call
 * reload() when the data should be fetched again, e.g. after login changes.
 */
export function useApiData<T>(
  load: (signal: AbortSignal) => Promise<T>,
  isEmpty: (data: T) => boolean = () => false
) {
  const [state, setState] = useState<ApiDataState<T>>({
    data: null,
    error: null,
    status: 'loading'
  });
  const [revision, setRevision] = useState(0);
  const loadRef = useRef(load);
  const isEmptyRef = useRef(isEmpty);
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  loadRef.current = load;
  isEmptyRef.current = isEmpty;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setState({ data: null, error: null, status: 'loading' });

    loadRef
      .current(controller.signal)
      .then((data) => {
        if (active) {
          setState({
            data,
            error: null,
            status: isEmptyRef.current(data) ? 'empty' : 'ready'
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
  }, [revision]);

  return { ...state, reload };
}
