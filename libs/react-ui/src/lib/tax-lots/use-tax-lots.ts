import type { ApiResponse } from '@ghostfolio/common/api-conventions';

import { useCallback, useEffect, useState } from 'react';

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

export interface TaxLotsState {
  data: TaxLotsData | null;
  error: Error | null;
  status: TaxLotsStatus;
}

const defaultRequest: TaxLotsFetch = (input, init) => fetch(input, init);

/**
 * Retrieve a Tax API response without converting or calculating any amounts.
 * Callers may inject their authenticated fetch implementation.
 */
export async function fetchTaxLots(
  request: TaxLotsFetch = defaultRequest,
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
    throw new Error(`Tax lots request failed (HTTP ${response.status})`);
  }

  if (!response.ok || body?.error) {
    throw new Error(
      body?.error?.message ??
        `Tax lots request failed (HTTP ${response.status})`
    );
  }

  if (!body?.data || !Array.isArray(body.data.lots)) {
    throw new Error('Invalid tax-lots API response');
  }

  // Reject an unexpected changed API contract rather than silently converting
  // precise backend decimal strings to JavaScript floating-point numbers.
  for (const lot of body.data.lots) {
    if (
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
 * Tax-owned React hook. The caller supplies an authenticated fetch function
 * when required by the host UI. No FIFO or cost-basis logic lives here.
 */
export function useTaxLots(request: TaxLotsFetch = defaultRequest) {
  const [state, setState] = useState<TaxLotsState>({
    data: null,
    error: null,
    status: 'loading'
  });
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setState({ data: null, error: null, status: 'loading' });

    fetchTaxLots(request, controller.signal)
      .then((data) => {
        if (active) {
          setState({
            data,
            error: null,
            status: data.lots.length === 0 ? 'empty' : 'ready'
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
  }, [request, revision]);

  return { ...state, reload };
}
