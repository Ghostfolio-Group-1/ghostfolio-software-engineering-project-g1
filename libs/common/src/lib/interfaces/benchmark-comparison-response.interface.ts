import type { ChartSeriesGranularity } from './chart-series-response.interface';

export interface BenchmarkComparisonPoint {
  date: string;
  portfolioReturn: number;
  benchmarkReturn: number;
}

export interface BenchmarkComparisonResponse {
  granularity: ChartSeriesGranularity;
  startDate: string;
  endDate: string;
  benchmarkSymbol: string;
  benchmarkAvailableFrom: string;
  points: BenchmarkComparisonPoint[];
}
