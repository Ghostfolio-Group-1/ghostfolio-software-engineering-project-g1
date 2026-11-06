import { TargetAllocationGroupBy } from '@ghostfolio/common/interfaces';

import { RiskThresholds } from './risk-concentration-response.interface';
import { Severity } from './severity.type';

// Response shape for GET/PUT/DELETE /api/v1/risk/target-allocation.
// Source: docs/sesha-notes/10-risk-api-contract.md, Sections 6.5-6.7.
export interface TargetAllocationTarget {
  key: string;
  percentage: number;
}

export interface TargetAllocationBucket {
  actual: number;
  deviation: number;
  key: string;
  severity: Severity;
  target: number;
}

export interface TargetAllocationResponse {
  buckets: TargetAllocationBucket[];
  groupBy: TargetAllocationGroupBy | null;
  isSet: boolean;
  targets: TargetAllocationTarget[];
  thresholds: RiskThresholds | null;
}
