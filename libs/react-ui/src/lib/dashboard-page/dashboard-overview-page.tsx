import type { ReactNode } from 'react';

import type { AuthenticatedFetch } from '../data/api-request';
import { useApiData } from '../data/use-api-data';
import {
  allSections,
  fetchDashboardOverview,
  toDashboardSections
} from './dashboard-overview';
import { DashboardPage } from './dashboard-page';
import {
  DashboardPartialFailure,
  failedSections,
  isPartialFailure
} from './dashboard-partial-failure';

export interface DashboardOverviewPageProps {
  /** The host's authenticated fetch (see data/api-request). */
  request: AuthenticatedFetch;
  title?: string;
}

// Unified Dashboard (#68) on live data: one GET /api/v1/dashboard/overview,
// three cards. If the whole request fails every card shows a retryable error;
// if one section is unavailable only that card does, and a notice above the
// cards names it so the page is not mistaken for complete.
export function DashboardOverviewPage({
  request,
  title
}: DashboardOverviewPageProps) {
  const { data, reload, status } = useApiData((signal) =>
    fetchDashboardOverview(request, signal)
  );

  let sections = allSections({ status: 'loading' });
  let notice: ReactNode = null;

  if (status === 'error') {
    sections = allSections({
      errorMessage: 'The dashboard could not be loaded',
      onRetry: reload,
      status: 'error'
    });
  } else if (data) {
    sections = toDashboardSections(data, reload);

    const failed = failedSections(sections);

    if (isPartialFailure(failed)) {
      notice = <DashboardPartialFailure failed={failed} onRetry={reload} />;
    }
  }

  return <DashboardPage notice={notice} sections={sections} title={title} />;
}
