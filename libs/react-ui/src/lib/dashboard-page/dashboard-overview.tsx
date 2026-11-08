import { requestApi } from '../data/api-request';
import type { AuthenticatedFetch } from '../data/api-request';
import type {
  DashboardSectionKey,
  DashboardSectionView,
  DashboardSectionViews
} from './dashboard-page';
import { DashboardRiskSummary } from './dashboard-risk-summary';
import type { OverviewRiskBucket } from './dashboard-risk-summary';
import { DashboardTaxSummary } from './dashboard-tax-summary';
import type { OverviewTaxSale } from './dashboard-tax-summary';

export const DASHBOARD_OVERVIEW_PATH = '/api/v1/dashboard/overview';

// Mirrors the GET /api/v1/dashboard/overview contract, kept local so the React
// library does not import from the API app. Only the fields the cards read.
export interface OverviewRiskData {
  stock: { buckets: OverviewRiskBucket[] };
}

export interface OverviewTaxData {
  method: string;
  sales: OverviewTaxSale[];
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
  render: (data: T) => DashboardSectionView['content'],
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
 * the other sections still render. Risk and Tax render their summary cards;
 * the Charts card is completed on Nov 10.
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
      (data) => <DashboardRiskSummary buckets={data.stock.buckets} />,
      onRetry
    ),
    tax: toView(
      'tax',
      overview.tax,
      (data) => data.sales.length === 0,
      (data) => <DashboardTaxSummary method={data.method} sales={data.sales} />,
      onRetry
    )
  };
}

/** Every card in the same state, for when the whole request fails or loads. */
export function allSections(view: DashboardSectionView): DashboardSectionViews {
  return { charts: view, risk: view, tax: view };
}
