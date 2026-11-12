import type { TaxCalculationMethod } from '../tax-calculator';
import type {
  YearlyTaxSummaryError,
  YearlyTaxSummaryWarning
} from '../yearly-tax-summary';

export interface TaxYearlyCurrencySummaryResponse {
  currency: string | null;
  totalGrossDividends: string;
  totalWithholdingTax: string | null;
  totalNetDividends: string | null;
  grossProceeds: string;
  grossCostBasis: string;
  grossRealizedGain: string;
  allocatedFees: string;
  realizedGainAfterActivityFees: string;
}

export interface TaxYearlyDividendRecordResponse {
  sourceActivityId: string;
  accountId: string | null;
  symbolProfileId: string;
  date: string;
  transactionCurrency: string | null;
  grossDividend: string;
  withholdingTax: string | null;
  netDividend: string | null;
  activityFee: string;
  baseCurrency: string;
  grossDividendBaseCurrency: string | null;
  withholdingTaxBaseCurrency: string | null;
  netDividendBaseCurrency: string | null;
  activityFeeBaseCurrency: string | null;
}

export interface TaxYearlyRealizedGainResponse {
  accountId: string | null;
  symbolProfileId: string | null;
  sellActivityId: string;
  sellDate: string;
  transactionCurrency: string | null;
  sellQuantity: string;
  matchedQuantity: string;
  grossProceeds: string;
  grossCostBasis: string;
  grossRealizedGain: string;
  allocatedAcquisitionFees: string;
  allocatedSellFees: string;
  realizedGainAfterActivityFees: string;
  baseCurrency: string;
  totalActivityFees: string;
  grossProceedsBaseCurrency: string | null;
  grossCostBasisBaseCurrency: string | null;
  grossRealizedGainBaseCurrency: string | null;
  totalActivityFeesBaseCurrency: string | null;
  realizedGainAfterActivityFeesBaseCurrency: string | null;
}

/** HTTP wire shape; the Tax domain continues to own Big and Date values. */
export interface TaxYearlySummaryResponse {
  year: number;
  method: TaxCalculationMethod;
  baseCurrency: string;
  calculatedAt: string;
  grossDividendsBaseCurrency: string | null;
  totalWithholdingTaxBaseCurrency: string | null;
  netDividendsBaseCurrency: string | null;
  grossProceedsBaseCurrency: string | null;
  grossCostBasisBaseCurrency: string | null;
  grossRealizedGainBaseCurrency: string | null;
  totalActivityFeesBaseCurrency: string | null;
  realizedGainAfterActivityFeesBaseCurrency: string | null;
  dividendCount: number;
  disposalCount: number;
  currencySummaries: TaxYearlyCurrencySummaryResponse[];
  dividendRecords: TaxYearlyDividendRecordResponse[];
  realizedGains: TaxYearlyRealizedGainResponse[];
  isComplete: boolean;
  warnings: YearlyTaxSummaryWarning[];
  errors: YearlyTaxSummaryError[];
}
