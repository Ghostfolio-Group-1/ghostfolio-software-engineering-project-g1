import type { ChartSeriesResponse } from '@ghostfolio/common/interfaces/chart-series-response.interface';

import type { RiskConcentrationResponse } from '../../risk/interfaces/risk-concentration-response.interface';
import type { TaxRealizedGainsResponse } from '../../tax/interfaces/tax-realized-gains-response.interface';

export type DashboardSectionName = 'charts' | 'risk' | 'tax';

export interface DashboardSectionError {
  code: string;
  message: string;
}

// A section is either loaded, or marked unavailable so the rest of the
// dashboard still renders. Data keeps its endpoint's own shape: risk and
// charts use numbers, tax uses decimal strings.
export type DashboardSection<T> =
  | { data: T; status: 'available' }
  | { error: DashboardSectionError; status: 'unavailable' };

export interface DashboardOverviewResponse {
  charts: DashboardSection<ChartSeriesResponse>;
  risk: DashboardSection<RiskConcentrationResponse>;
  tax: DashboardSection<TaxRealizedGainsResponse>;
}
