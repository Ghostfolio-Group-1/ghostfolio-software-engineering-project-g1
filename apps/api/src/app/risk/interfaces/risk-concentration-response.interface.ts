export type RiskSeverity = 'GREEN' | 'NO_DATA' | 'RED' | 'YELLOW';

export interface RiskThresholds {
  max?: number;
  min?: number;
  redMax?: number;
  redMin?: number;
}

export interface RiskConcentrationBucket {
  name: string;
  percentage: number;
  severity: RiskSeverity;
  value: string;
}

export interface RiskConcentrationGroup {
  buckets: RiskConcentrationBucket[];
  thresholds: RiskThresholds | null;
}

export interface RiskConcentrationResponse {
  country: RiskConcentrationGroup;
  currency: RiskConcentrationGroup;
  sector: RiskConcentrationGroup;
  stock: RiskConcentrationGroup;
}
