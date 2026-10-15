import { Severity } from './severity.type';

export interface RuleScore {
  actual: number | null;
  isActive: boolean;
  key: string;
  message: string;
  name: string;
  passed: boolean | null;
  severity: Severity;
  weight: number;
}
