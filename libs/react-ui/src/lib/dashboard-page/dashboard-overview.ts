import type { ReactNode } from 'react';

import { requestApi } from '../data/api-request';
import type { AuthenticatedFetch } from '../data/api-request';
import type {
  DashboardSectionKey,
  DashboardSectionView,
  DashboardSectionViews
} from './dashboard-page';

export const DASHBOARD_OVERVIEW_PATH = '/api/v1/dashboard/overview';

// Mirrors the GET /api/v1/dashboard/overview contract, kept local so the React
// library does not import from the API app. Only the fields the cards read.
export interface OverviewRiskData {
  stock: { buckets: { name: string; percentage: number }[] };
}

export interface OverviewTaxData {
  method: string;
  sales: { realizedGainAfterActivityFees: string }[];
}

export interface OverviewChartsData {
  kind: string;
  points: { date: string; value: number }[];
}

export type OverviewSection<T> =
  | { data: T; status: 'available' }
  | { error: { code: string; message: string }; status: 'unavailable' };

export interface DashboardOverviewData {
  charts: OverviewSection<OverviewChartsData>;
  risk: OverviewSection<OverviewRiskData>;
  tax: OverviewSection<OverviewTaxData>;
}

const SECTION_NAMES: Record<DashboardSectionKey, string> = {
  charts: 'performance',
  risk: 'risk',
  tax: 'tax'
};

export function fetchDashboardOverview(
  request: AuthenticatedFetch,
  signal?: AbortSignal
) {
  return requestApi<DashboardOverviewData>(
    request,
    DASHBOARD_OVERVIEW_PATH,
    signal
  );
}

function unavailable(
  key: DashboardSectionKey,
  onRetry?: () => void
): DashboardSectionView {
  return {
    errorMessage: `The ${SECTION_NAMES[key]} section could not be loaded`,
    onRetry,
    status: 'error'
  };
}

function toView<T>(
  key: DashboardSectionKey,
  section: OverviewSection<T> | undefined,
  isEmpty: (data: T) => boolean,
  render: (data: T) => ReactNode,
  onRetry?: () => void
): DashboardSectionView {
  if (section?.status !== 'available') {
    return unavailable(key, onRetry);
  }

  if (isEmpty(section.data)) {
    return { status: 'empty' };
  }

  return { content: render(section.data), status: 'ready' };
}

/**
 * Maps the overview response onto the three dashboard cards. An unavailable
 * section becomes an error card with a generic message (never the server text);
 * the other sections still render. The detailed Risk / Tax / Charts cards
 * replace these summaries on Nov 9–10.
 */
export function toDashboardSections(
  overview: DashboardOverviewData,
  onRetry?: () => void
): DashboardSectionViews {
  return {
    charts: toView(
      'charts',
      overview.charts,
      (data) => data.points.length === 0,
      (data) =>
        `${data.points.length} data points · latest ${
          data.points[data.points.length - 1].date
        }`,
      onRetry
    ),
    risk: toView(
      'risk',
      overview.risk,
      (data) => data.stock.buckets.length === 0,
      (data) => `${data.stock.buckets.length} holdings in the risk breakdown`,
      onRetry
    ),
    tax: toView(
      'tax',
      overview.tax,
      (data) => data.sales.length === 0,
      (data) => `${data.sales.length} realized sales (${data.method})`,
      onRetry
    )
  };
}

/** Every card in the same state, for when the whole request fails or loads. */
export function allSections(view: DashboardSectionView): DashboardSectionViews {
  return { charts: view, risk: view, tax: view };
}
