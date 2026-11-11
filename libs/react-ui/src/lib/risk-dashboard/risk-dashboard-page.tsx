import type { AuthenticatedFetch } from '../data/api-request';
import { useApiData } from '../data/use-api-data';
import { RiskDashboardCard } from './risk-dashboard-card';
import {
  loadRiskDashboardSummary,
  riskDashboardErrorMessage
} from './risk-dashboard.client';

export interface RiskDashboardPageProps {
  /** The host's authenticated fetch (see data/api-request). */
  request: AuthenticatedFetch;
}

// Issue #258: standalone Risk route, built on top of the already-merged
// RiskDashboardCard + loadRiskDashboardSummary (GET /risk/score and
// /risk/concentration). The What-if simulator (PR #241) mounts alongside
// this once it merges - not pulled in here to avoid depending on an
// unmerged branch.
export function RiskDashboardPage({ request }: RiskDashboardPageProps) {
  const { data, error, reload, status } = useApiData(() =>
    loadRiskDashboardSummary(request)
  );

  return (
    <RiskDashboardCard
      data={data ?? undefined}
      errorMessage={
        status === 'error' ? riskDashboardErrorMessage(error) : undefined
      }
      onRetry={reload}
      status={status}
    />
  );
}
