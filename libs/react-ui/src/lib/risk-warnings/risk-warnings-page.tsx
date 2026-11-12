import type { AuthenticatedFetch } from '../data/api-request';
import { ApiRequestError } from '../data/api-request';
import { useApiData } from '../data/use-api-data';
import { RiskWarningsList } from './risk-warnings-list';
import { fetchRiskWarnings } from './risk-warnings.client';

export interface RiskWarningsPageProps {
  /** The host's authenticated fetch (see data/api-request). */
  request: AuthenticatedFetch;
}

// Same "page wires a presentational component to live data" split as
// RiskDashboardPage/WhatIfSimulatorPage.
export function RiskWarningsPage({ request }: RiskWarningsPageProps) {
  const { data, error, reload, status } = useApiData(
    (signal) => fetchRiskWarnings(request, signal),
    (warnings) => warnings.length === 0
  );

  return (
    <RiskWarningsList
      errorMessage={
        status === 'error' ? warningsErrorMessage(error) : undefined
      }
      onRetry={reload}
      status={status}
      warnings={data ?? undefined}
    />
  );
}

// Same idiom as riskDashboardErrorMessage (risk-dashboard.client.ts): map
// the backend's status/code onto safe, generic text, never raw server text.
function warningsErrorMessage(error: Error | null): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return 'Please sign in to view your warnings';
    }

    if (error.status === 403) {
      return 'You do not have access to these warnings';
    }
  }

  return 'Warnings are unavailable right now';
}
