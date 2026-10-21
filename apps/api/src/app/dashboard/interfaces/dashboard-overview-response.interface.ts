import type { ChartSeriesResponse } from '@ghostfolio/common/interfaces/chart-series-response.interface';

import type { RiskConcentrationResponse } from '../../risk/interfaces/risk-concentration-response.interface';
import type { TaxRealizedGainsResponse } from '../../tax/interfaces/tax-realized-gains-response.interface';

// One section per endpoint. Each section keeps its endpoint's own data shape:
// risk and charts use numbers, tax uses decimal strings.
export interface DashboardOverviewResponse {
  charts: ChartSeriesResponse;
  risk: RiskConcentrationResponse;
  tax: TaxRealizedGainsResponse;
}
