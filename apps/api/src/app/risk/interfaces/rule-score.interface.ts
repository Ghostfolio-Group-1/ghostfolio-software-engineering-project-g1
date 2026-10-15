export interface RuleScore {
  actual: number | null;
  isActive: boolean;
  key: string;
  message: string;
  name: string;
  passed: boolean | null;
  weight: number;
}
