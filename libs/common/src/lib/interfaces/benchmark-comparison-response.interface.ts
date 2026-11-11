import type { ChartSeriesGranularity } from './chart-series-response.interface';

export interface BenchmarkComparisonPoint {
  benchmarkReturn: number;
  date: string;
  portfolioReturn: number;
}

export interface BenchmarkComparisonResponse {
  benchmarkAvailableFrom: string;
  benchmarkSymbol: string;
  endDate: string;
  granularity: ChartSeriesGranularity;
  points: BenchmarkComparisonPoint[];
  startDate: string;
}
