export interface RiskWarning {
  actual: number;
  message: string;
  ruleKey: string;
  severity: 'RED' | 'YELLOW';
  subject: {
    type: 'bucket' | 'country' | 'currency' | 'portfolio' | 'sector' | 'stock';
    value: string;
  };
  threshold: number;
}
