import { CategoryScore } from './category-score.interface';
import { Severity } from './severity.type';

export interface HealthScore {
  activeWeight: number;
  calculatedAt: Date;
  categories: CategoryScore[];
  grade: string | null;
  score: number | null;
  severity: Severity;
  unavailableReason: string | null;
}

// Input to HealthScoreCalculator: one rule's raw result plus the static
// weight/category it was assigned in docs/sesha-notes/02-health-score-data-model.md.
export interface WeightedRuleResult {
  categoryKey: string;
  categoryName: string;
  categoryWeight: number;
  isActive: boolean;
  key: string;
  message: string;
  name: string;
  passed: boolean;
  weight: number;
}
