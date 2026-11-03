import { RiskThresholds } from './risk-concentration-response.interface';
import { Severity } from './severity.type';

// Response shape for GET /api/v1/risk/score.
// Source: docs/sesha-notes/10-risk-api-contract.md, Section 6.2.
export interface RiskScoreRuleResult {
  actual: number | null;
  isActive: boolean;
  key: string;
  message: string;
  name: string;
  passed: boolean | null;
  severity: Severity;
  thresholds: RiskThresholds | null;
  weight: number;
}

export interface RiskScoreCategory {
  key: string;
  name: string;
  // null for restricted-view/Basic-subscriber users (Section 6.2, Section 4) -
  // not produced by the mapper today, reserved for when that gating lands.
  rules: RiskScoreRuleResult[] | null;
  score: number | null;
  severity: Severity;
  weight: number;
}

export interface RiskScoreExcludedCategory {
  key: string;
  reason: string;
}

export interface RiskScoreResponse {
  activeWeight: number;
  calculatedAt: Date;
  categories: RiskScoreCategory[];
  excluded: RiskScoreExcludedCategory[];
  grade: string | null;
  score: number | null;
  severity: Severity;
  unavailableReason: string | null;
}
