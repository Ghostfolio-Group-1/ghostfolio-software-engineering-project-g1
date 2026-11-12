import { ChartSeriesGranularity } from './chart-series-response.interface';

export interface ReturnComparisonPoint {
  date: string;
  priceReturn: number;
  totalReturn: number;
}

export interface ReturnComparisonResponse {
  endDate: string;
  granularity: ChartSeriesGranularity;
  points: ReturnComparisonPoint[];
  startDate: string;
}
