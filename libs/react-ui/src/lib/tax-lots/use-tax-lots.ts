import type { ApiResponse } from '@ghostfolio/common/api-conventions';

import { useCallback, useEffect, useRef, useState } from 'react';

// Mirrors GET /api/v1/tax/lots. Kept in the Tax React feature rather than
// importing server-side types from apps/api.
export type TaxLotStatus = 'CLOSED' | 'OPEN' | 'PARTIALLY_CONSUMED';

export interface TaxLot {
  accountId: string | null;
  acquiredAt: string;
  consumedQuantity: string;
  currency: string | null;
  lotId: string;
  originalQuantity: string;
  relatedSellActivityIds: string[];
  remainingQuantity: string;
  sourceActivityId: string;
  status: TaxLotStatus;
  symbolProfileId: string;
}

export interface TaxLotsDiagnostic {
  affectedSellActivityIds: string[];
  code: 'TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY';
  excludedActivityIds: string[];
  message: string;
}

export interface TaxLotsData {
  diagnostics?: TaxLotsDiagnostic[];
  isComplete?: false;
  lots: TaxLot[];
}

export type TaxLotsStatus = 'empty' | 'error' | 'loading' | 'ready';
export type TaxLotsFetch = typeof fetch;

/** Carries the HTTP status and backend error code without exposing server text to users. */
export class TaxLotsApiError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'TaxLotsApiError';
  }
}

export interface TaxLotsState {
  data: TaxLotsData | null;
  diagnostics: TaxLotsDiagnostic[];
  error: Error | null;
  isComplete: boolean | null;
  status: TaxLotsStatus;
}

/**
 * The request MUST come from the host's authenticated HTTP adapter.
 * Native fetch does not pass through Ghostfolio's Angular AuthInterceptor.
 * Neither the access token nor the impersonation identity is read here.
 */
export async function fetchTaxLots(
  request: TaxLotsFetch,
  signal?: AbortSignal
): Promise<TaxLotsData> {
  const response = await request('/api/v1/tax/lots', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    method: 'GET',
    signal
  });

  let body: ApiResponse<TaxLotsData>;

  try {
    body = (await response.json()) as ApiResponse<TaxLotsData>;
  } catch {
    throw new TaxLotsApiError(
      response.status,
      'TAX_INVALID_RESPONSE',
      'Could not read the tax-lots response'
    );
  }

  if (!response.ok || body?.error) {
    throw new TaxLotsApiError(
      response.status,
      body?.error?.code ?? 'TAX_REQUEST_FAILED',
      response.status === 401
        ? 'Please sign in to view tax lots'
        : 'Unable to load tax lots'
    );
  }

  if (!body?.data || !Array.isArray(body.data.lots)) {
    throw new Error('Invalid tax-lots API response');
  }

  // Reject changed API contracts instead of silently coercing precise
  // decimal strings into JavaScript floating-point values.
  for (const lot of body.data.lots) {
    if (
      !lot ||
      typeof lot !== 'object' ||
      typeof lot.originalQuantity !== 'string' ||
      typeof lot.consumedQuantity !== 'string' ||
      typeof lot.remainingQuantity !== 'string'
    ) {
      throw new Error('Tax-lot quantities must be decimal strings');
    }
  }

  return body.data;
}

/**
 * Tax-owned hook. Supply the host's authenticated fetch adapter.
 * Changing an inline request callback alone does not refetch; call reload()
 * when authentication/impersonation changes and fresh data is required.
 */
export function useTaxLots(request: TaxLotsFetch) {
  const [state, setState] = useState<TaxLotsState>({
    data: null,
    diagnostics: [],
    error: null,
    isComplete: null,
    status: 'loading'
  });
  const [revision, setRevision] = useState(0);
  const requestRef = useRef(request);
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    requestRef.current = request;
  }, [request]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setState({
      data: null,
      diagnostics: [],
      error: null,
      isComplete: null,
      status: 'loading'
    });

    fetchTaxLots(requestRef.current, controller.signal)
      .then((data) => {
        if (active) {
          const isComplete = data.isComplete !== false;
          setState({
            data,
            diagnostics: data.diagnostics ?? [],
            error: null,
            isComplete,
            // Incomplete history must not be presented as a normal empty set.
            status: isComplete && data.lots.length === 0 ? 'empty' : 'ready'
          });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            data: null,
            diagnostics: [],
            error: error instanceof Error ? error : new Error(String(error)),
            isComplete: null,
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
