import { requestApi } from '../data/api-request';
import type { AuthenticatedFetch } from '../data/api-request';

export const CHART_RANGES = [
  '1d',
  'wtd',
  'mtd',
  'ytd',
  '1y',
  '5y',
  'max'
] as const;

export type ChartRange = (typeof CHART_RANGES)[number];

export interface ReturnComparisonPoint {
  date: string;
  priceReturn: number;
  totalReturn: number;
}

export interface ReturnComparison {
  endDate: string;
  granularity: 'daily' | 'weekly';
  points: ReturnComparisonPoint[];
  startDate: string;
}

export function fetchReturnComparison(
  request: AuthenticatedFetch,
  range: ChartRange,
  symbol: string,
  signal?: AbortSignal
) {
  const params = new URLSearchParams({ range });
  const named = symbol.trim();

  if (named) {
    params.set('symbol', named);
  }

  return requestApi<ReturnComparison>(
    request,
    `/api/v1/charts/return-comparison?${params.toString()}`,
    signal
  );
}
