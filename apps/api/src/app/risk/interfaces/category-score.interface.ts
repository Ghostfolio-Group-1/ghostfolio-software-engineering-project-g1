import { RuleScore } from './rule-score.interface';

export interface CategoryScore {
  key: string;
  name: string;
  rules: RuleScore[];
  score: number;
  weight: number;
}
