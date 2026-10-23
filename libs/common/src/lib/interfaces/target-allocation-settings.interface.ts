export type TargetAllocationGroupBy =
  'assetClass' | 'country' | 'currency' | 'sector' | 'symbol';

export interface TargetAllocationEntry {
  key: string;
  percentage: number;
}

export interface TargetAllocationSettings {
  groupBy: TargetAllocationGroupBy;
  isActive: boolean;
  targets: TargetAllocationEntry[];
}
