import type { ApiResponse } from '@ghostfolio/common/api-conventions';

import type { AuthenticatedFetch } from '../data/api-request';
import { ApiRequestError, requestApi } from '../data/api-request';
import type {
  RiskDashboardSummary,
  RiskDashboardTopConcentration,
  RiskSeverity
} from './risk-dashboard-card';

// Shared with the what-if simulator client (what-if-simulator.client.ts),
// which POSTs rather than GETs and so cannot use requestApi (GET-only) -
// this is the same { data, error, meta } envelope shape, with the server's
// error message preserved rather than generalized, since the what-if
// error codes (RISK_WHATIF_INVALID_DROP, RISK_WHATIF_HOLDING_NOT_FOUND) are
// deliberately safe, user-actionable text (risk.controller.ts#postWhatIf),
// unlike the generic failures requestApi hides.
export type RiskApiEnvelope<T> = ApiResponse<T>;

export class RiskApiError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'RiskApiError';
  }
}

// Wiring for the Risk dashboard card (Thu Nov 5): pulls real data from
// GET /risk/score and GET /risk/concentration and maps the API's
// { data, error, meta } envelope onto RiskDashboardSummary, reusing the
// shared requestApi/AuthenticatedFetch adapter (libs/react-ui/src/lib/data,
// from #207/#208) rather than a risk-only HTTP helper, so error handling
// (401/403/invalid-body/missing-data) matches every other feature's client.
interface RiskScoreApiCategory {
  key: string;
  name: string;
  score: number | null;
  severity: RiskSeverity;
}

interface RiskScoreApiResponse {
  categories: RiskScoreApiCategory[];
  grade: string | null;
  score: number | null;
  severity: RiskSeverity;
  unavailableReason: string | null;
}

interface RiskConcentrationApiBucket {
  name: string;
  percentage: number;
  severity: RiskSeverity;
}

interface RiskConcentrationApiResponse {
  stock: { buckets: RiskConcentrationApiBucket[] };
}

export async function fetchRiskScore(
  request: AuthenticatedFetch
): Promise<Omit<RiskDashboardSummary, 'topConcentration'>> {
  const data = await requestApi<RiskScoreApiResponse>(
    request,
    '/api/v1/risk/score'
  );

  return {
    categories: data.categories.map((category) => ({
      key: category.key,
      name: category.name,
      score: category.score,
      severity: category.severity
    })),
    grade: data.grade,
    score: data.score,
    severity: data.severity,
    unavailableReason: data.unavailableReason
  };
}

// Only the stock group's top bucket - not necessarily the highest-risk
// concentration overall, since country/currency/sector buckets from the
// same response aren't compared here. Every bucket's severity is 'NO_DATA'
// today (risk-concentration.mapper.ts#toGroup: "Severity and thresholds
// come from the threshold engine", not yet built), so this value is
// display-only until that lands - it isn't used to flag risk by itself.
export async function fetchTopConcentration(
  request: AuthenticatedFetch
): Promise<RiskDashboardTopConcentration | null> {
  const data = await requestApi<RiskConcentrationApiResponse>(
    request,
    '/api/v1/risk/concentration'
  );
  const [top] = data.stock.buckets;

  return top
    ? { name: top.name, percentage: top.percentage, severity: top.severity }
    : null;
}

// Combines both calls for the card. Either call failing fails the whole
// load - the card has one status (loading/error/empty/ready), not two
// independent ones, which matches how RiskDashboardCard is written today.
export async function loadRiskDashboardSummary(
  request: AuthenticatedFetch
): Promise<RiskDashboardSummary> {
  const [score, topConcentration] = await Promise.all([
    fetchRiskScore(request),
    fetchTopConcentration(request)
  ]);

  return { ...score, topConcentration };
}

// Same idiom as chartSeriesErrorMessage (use-chart-series.ts): map the
// backend's status/code onto a safe, generic message, never raw server text.
export function riskDashboardErrorMessage(error: Error | null): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return 'Please sign in to view your risk score';
    }

    if (error.status === 403) {
      return 'You do not have access to this risk score';
    }

    if (error.code === 'RISK_CALC_FAILED') {
      return 'Unable to calculate your risk score right now';
    }
  }

  return 'Risk data is unavailable';
}
