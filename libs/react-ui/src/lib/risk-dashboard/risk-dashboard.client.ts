import type { AuthenticatedFetch } from '../data/api-request';
import { requestApi } from '../data/api-request';
import type {
  RiskDashboardSummary,
  RiskDashboardTopConcentration,
  RiskSeverity
} from './risk-dashboard-card';

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
