import { ThresholdShape } from '../warning-threshold.model';
import { RiskThresholds } from './risk-concentration-response.interface';

// Response shape for GET/PUT/DELETE /api/v1/risk/thresholds[/:ruleKey].
// Source: docs/sesha-notes/10-risk-api-contract.md, Sections 6.8-6.10.
export interface RiskThresholdItem {
  defaults: RiskThresholds;
  isActive: boolean;
  isCustomized: boolean;
  name: string;
  ruleKey: string;
  shape: ThresholdShape;
  thresholds: RiskThresholds;
}
