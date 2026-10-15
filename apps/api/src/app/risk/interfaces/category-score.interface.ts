import { RuleScore } from './rule-score.interface';
import { Severity } from './severity.type';

export interface CategoryScore {
  key: string;
  name: string;
  rules: RuleScore[];
  score: number;
  severity: Severity;
  weight: number;
}
