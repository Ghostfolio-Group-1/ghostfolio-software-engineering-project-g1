import type { AuthenticatedFetch } from '../data/api-request';
import { requestApi } from '../data/api-request';

export interface RiskWarning {
  actual: number;
  message: string;
  ruleKey: string;
  severity: 'RED' | 'YELLOW';
  subject: {
    type: 'bucket' | 'country' | 'currency' | 'portfolio' | 'sector' | 'stock';
    value: string;
  };
  threshold: number;
}

// Mirrors apps/api/src/app/risk/interfaces/risk-warning.interface.ts - kept
// local so the React library has no dependency on the API's own types
// (same convention as RiskSeverity in risk-indicator.tsx).
//
// Requests the max page size (100) rather than building pager controls: a
// portfolio with over 100 simultaneously-breaching subjects at once isn't
// a case worth a pagination UI for today. GET /risk/warnings is this
// endpoint's only consumer in the React library so far.
export async function fetchRiskWarnings(
  request: AuthenticatedFetch,
  signal?: AbortSignal
): Promise<RiskWarning[]> {
  return requestApi<RiskWarning[]>(
    request,
    '/api/v1/risk/warnings?pageSize=100',
    signal
  );
}
