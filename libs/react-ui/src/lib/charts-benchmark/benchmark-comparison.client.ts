import { requestApi } from '../data/api-request';
import type { AuthenticatedFetch } from '../data/api-request';

export interface BenchmarkComparisonPoint {
  benchmarkReturn: number;
  date: string;
  portfolioReturn: number;
}

export interface BenchmarkComparison {
  benchmarkAvailableFrom: string;
  benchmarkSymbol: string;
  endDate: string;
  granularity: 'daily' | 'weekly';
  points: BenchmarkComparisonPoint[];
  startDate: string;
}

export interface PortfolioSeriesPoint {
  date: string;
  value: number;
}

export interface PortfolioSeries {
  points: PortfolioSeriesPoint[];
}

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

export function fetchPortfolioSeries(
  request: AuthenticatedFetch,
  range: ChartRange,
  signal?: AbortSignal
) {
  return requestApi<PortfolioSeries>(
    request,
    `/api/v1/charts/series?kind=portfolioValue&range=${range}`,
    signal
  );
}

export function fetchBenchmarkComparison(
  request: AuthenticatedFetch,
  benchmark: string,
  range: ChartRange,
  signal?: AbortSignal
) {
  const params = new URLSearchParams({ benchmark, range });

  return requestApi<BenchmarkComparison>(
    request,
    `/api/v1/charts/benchmark-comparison?${params.toString()}`,
    signal
  );
}
