import type { Big } from 'big.js';

import type { TaxYearlySummaryResponse } from './interfaces/tax-yearly-summary-response.interface';
import type { YearlyTaxSummary } from './yearly-tax-summary';

function decimalOrNull(value: Big | null): string | null {
  return value === null ? null : value.toFixed();
}

/** Serialize every domain Big/Date explicitly; never round via JS numbers. */
export function serializeYearlyTaxSummary(
  summary: YearlyTaxSummary
): TaxYearlySummaryResponse {
  return {
    year: summary.year,
    method: summary.method,
    baseCurrency: summary.baseCurrency,
    calculatedAt: summary.calculatedAt.toISOString(),
    grossDividendsBaseCurrency: decimalOrNull(
      summary.grossDividendsBaseCurrency
    ),
    totalWithholdingTaxBaseCurrency: decimalOrNull(
      summary.totalWithholdingTaxBaseCurrency
    ),
    netDividendsBaseCurrency: decimalOrNull(summary.netDividendsBaseCurrency),
    grossProceedsBaseCurrency: decimalOrNull(summary.grossProceedsBaseCurrency),
    grossCostBasisBaseCurrency: decimalOrNull(
      summary.grossCostBasisBaseCurrency
    ),
    grossRealizedGainBaseCurrency: decimalOrNull(
      summary.grossRealizedGainBaseCurrency
    ),
    totalActivityFeesBaseCurrency: decimalOrNull(
      summary.totalActivityFeesBaseCurrency
    ),
    realizedGainAfterActivityFeesBaseCurrency: decimalOrNull(
      summary.realizedGainAfterActivityFeesBaseCurrency
    ),
    dividendCount: summary.dividendCount,
    disposalCount: summary.disposalCount,
    currencySummaries: summary.currencySummaries.map((currencySummary) => ({
      currency: currencySummary.currency,
      totalGrossDividends: currencySummary.totalGrossDividends.toFixed(),
      totalWithholdingTax: decimalOrNull(currencySummary.totalWithholdingTax),
      totalNetDividends: decimalOrNull(currencySummary.totalNetDividends),
      grossProceeds: currencySummary.grossProceeds.toFixed(),
      grossCostBasis: currencySummary.grossCostBasis.toFixed(),
      grossRealizedGain: currencySummary.grossRealizedGain.toFixed(),
      allocatedFees: currencySummary.allocatedFees.toFixed(),
      realizedGainAfterActivityFees:
        currencySummary.realizedGainAfterActivityFees.toFixed()
    })),
    dividendRecords: summary.dividendRecords.map((dividend) => ({
      sourceActivityId: dividend.sourceActivityId,
      accountId: dividend.accountId,
      symbolProfileId: dividend.symbolProfileId,
      date: dividend.date.toISOString(),
      transactionCurrency: dividend.transactionCurrency,
      grossDividend: dividend.grossDividend.toFixed(),
      withholdingTax: decimalOrNull(dividend.withholdingTax),
      netDividend: decimalOrNull(dividend.netDividend),
      activityFee: dividend.activityFee.toFixed(),
      baseCurrency: dividend.baseCurrency,
      grossDividendBaseCurrency: decimalOrNull(
        dividend.grossDividendBaseCurrency
      ),
      withholdingTaxBaseCurrency: decimalOrNull(
        dividend.withholdingTaxBaseCurrency
      ),
      netDividendBaseCurrency: decimalOrNull(dividend.netDividendBaseCurrency),
      activityFeeBaseCurrency: decimalOrNull(dividend.activityFeeBaseCurrency)
    })),
    realizedGains: summary.realizedGains.map((gain) => ({
      accountId: gain.accountId ?? null,
      symbolProfileId: gain.symbolProfileId ?? null,
      sellActivityId: gain.sellActivityId,
      sellDate: gain.sellDate.toISOString(),
      transactionCurrency: gain.transactionCurrency,
      sellQuantity: gain.sellQuantity.toFixed(),
      matchedQuantity: gain.matchedQuantity.toFixed(),
      grossProceeds: gain.grossProceeds.toFixed(),
      grossCostBasis: gain.grossCostBasis.toFixed(),
      grossRealizedGain: gain.grossRealizedGain.toFixed(),
      allocatedAcquisitionFees: gain.allocatedAcquisitionFees.toFixed(),
      allocatedSellFees: gain.allocatedSellFees.toFixed(),
      realizedGainAfterActivityFees:
        gain.realizedGainAfterActivityFees.toFixed(),
      baseCurrency: gain.baseCurrency,
      totalActivityFees: gain.totalActivityFees.toFixed(),
      grossProceedsBaseCurrency: decimalOrNull(gain.grossProceedsBaseCurrency),
      grossCostBasisBaseCurrency: decimalOrNull(
        gain.grossCostBasisBaseCurrency
      ),
      grossRealizedGainBaseCurrency: decimalOrNull(
        gain.grossRealizedGainBaseCurrency
      ),
      totalActivityFeesBaseCurrency: decimalOrNull(
        gain.totalActivityFeesBaseCurrency
      ),
      realizedGainAfterActivityFeesBaseCurrency: decimalOrNull(
        gain.realizedGainAfterActivityFeesBaseCurrency
      )
    })),
    isComplete: summary.isComplete,
    warnings: summary.warnings,
    errors: summary.errors
  };
}
