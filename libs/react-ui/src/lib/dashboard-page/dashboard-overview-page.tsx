import type { AuthenticatedFetch } from '../data/api-request';
import { useApiData } from '../data/use-api-data';
import {
  allSections,
  fetchDashboardOverview,
  toDashboardSections
} from './dashboard-overview';
import { DashboardPage } from './dashboard-page';

export interface DashboardOverviewPageProps {
  /** The host's authenticated fetch (see data/api-request). */
  request: AuthenticatedFetch;
  title?: string;
}

// Unified Dashboard (#68) on live data: one GET /api/v1/dashboard/overview,
// three cards. If the whole request fails every card shows a retryable error;
// if one section is unavailable only that card does.
export function DashboardOverviewPage({
  request,
  title
}: DashboardOverviewPageProps) {
  const { data, reload, status } = useApiData((signal) =>
    fetchDashboardOverview(request, signal)
  );

  let sections = allSections({ status: 'loading' });

  if (status === 'error') {
    sections = allSections({
      errorMessage: 'The dashboard could not be loaded',
      onRetry: reload,
      status: 'error'
    });
  } else if (data) {
    sections = toDashboardSections(data, reload);
  }

  return <DashboardPage sections={sections} title={title} />;
}
