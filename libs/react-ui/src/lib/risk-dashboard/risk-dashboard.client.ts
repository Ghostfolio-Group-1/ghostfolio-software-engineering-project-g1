import type {
  RiskDashboardSummary,
  RiskDashboardTopConcentration,
  RiskSeverity
} from './risk-dashboard-card';

// Wiring for the Risk dashboard card (Thu Nov 5): pulls real data from
// GET /risk/score and GET /risk/concentration and maps the API's
// { data, error, meta } envelope onto RiskDashboardSummary. The HTTP call
// itself is injected as `fetchJson` so tests can mock the HTTP layer
// (per this repo's convention - see risk.controller.spec.ts mocking
// PortfolioService etc.) without needing a DOM/fetch polyfill, since
// libs/react-ui's jest environment is 'node'.
export interface RiskApiEnvelope<T> {
  data: T | null;
  error: { code: string; message: string } | null;
  meta: unknown;
}

export type FetchJson = (url: string) => Promise<RiskApiEnvelope<unknown>>;

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

export class RiskApiError extends Error {}

async function get<T>(fetchJson: FetchJson, url: string): Promise<T> {
  const response = await fetchJson(url);

  if (response.error) {
    throw new RiskApiError(response.error.message);
  }

  return response.data as T;
}

export async function fetchRiskScore(
  fetchJson: FetchJson
): Promise<Omit<RiskDashboardSummary, 'topConcentration'>> {
  const data = await get<RiskScoreApiResponse>(fetchJson, '/api/v1/risk/score');

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

export async function fetchTopConcentration(
  fetchJson: FetchJson
): Promise<RiskDashboardTopConcentration | null> {
  const data = await get<RiskConcentrationApiResponse>(
    fetchJson,
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
  fetchJson: FetchJson
): Promise<RiskDashboardSummary> {
  const [score, topConcentration] = await Promise.all([
    fetchRiskScore(fetchJson),
    fetchTopConcentration(fetchJson)
  ]);

  return { ...score, topConcentration };
}
