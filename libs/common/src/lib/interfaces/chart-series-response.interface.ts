export const CHART_SERIES_KINDS = [
  'portfolioValue',
  'investedCapital',
  'cash'
] as const;

export type ChartSeriesKind = (typeof CHART_SERIES_KINDS)[number];

export type ChartSeriesGranularity = 'daily' | 'weekly';

export interface ChartSeriesPoint {
  date: string;
  value: number;
}

export interface ChartSeriesResponse {
  endDate: string;
  granularity: ChartSeriesGranularity;
  kind: ChartSeriesKind;
  points: ChartSeriesPoint[];
  startDate: string;
}
