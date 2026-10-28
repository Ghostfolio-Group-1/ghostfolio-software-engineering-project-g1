import type { ChartSeriesGranularity } from './chart-series-response.interface';

export interface DrawdownPoint {
  date: string;
  drawdown: number;
  isNewPeak: boolean;
}

export interface DrawdownResponse {
  granularity: ChartSeriesGranularity;
  startDate: string;
  endDate: string;
  maxDrawdown: number;
  maxDrawdownDate: string;
  points: DrawdownPoint[];
}
