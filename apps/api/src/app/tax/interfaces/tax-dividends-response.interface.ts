/** Public contract for GET /api/v1/tax/dividends?year=YYYY. */
export interface TaxDividendRecordResponse {
  accountId: string | null;
  activityFee: string;
  /** Stored UTC timestamp. The host must agree calendar-date display rules. */
  date: string;
  grossDividend: string;
  netDividend: string | null;
  sourceActivityId: string;
  symbolProfileId: string;
  transactionCurrency: string | null;
  withholdingTax: string | null;
}

export interface TaxDividendsResponse {
  records: TaxDividendRecordResponse[];
}
