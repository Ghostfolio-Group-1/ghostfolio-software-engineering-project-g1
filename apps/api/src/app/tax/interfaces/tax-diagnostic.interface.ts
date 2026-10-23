export const TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY =
  'TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY' as const;

export interface TaxScopeDiagnostic {
  code: typeof TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY;
  message: string;
  affectedSellActivityIds: string[];
  excludedActivityIds: string[];
}

export interface TaxResultCompleteness {
  diagnostics?: TaxScopeDiagnostic[];
  isComplete?: false;
}
