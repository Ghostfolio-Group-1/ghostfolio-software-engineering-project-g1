import type { Big } from 'big.js';

import type {
  TaxExportAverageCostEvent,
  TaxExportFifoMatch,
  TaxExportTrace
} from './tax-export';
import type {
  YearlyTaxSummary,
  YearlyTaxSummaryError,
  YearlyTaxSummaryWarning
} from './yearly-tax-summary';

export const TAX_PDF_TITLE = 'Ghostfolio Tax Analytics';
export const TAX_PDF_NOT_AVAILABLE = 'Not available';

export interface TaxPdfMetadata {
  title: typeof TAX_PDF_TITLE;
  reportYear: number;
  method: YearlyTaxSummary['method'];
  baseCurrency: string;
  generatedAt: Date;
  generatedAtIso: string;
  status: 'Complete' | 'Incomplete';
}

export interface TaxPdfAnnualSummary {
  grossDividends: string;
  withholdingTax: string;
  netDividends: string;
  grossProceeds: string;
  grossCostBasis: string;
  grossRealizedGain: string;
  activityFees: string;
  realizedGainAfterActivityFees: string;
  dividendCount: string;
  disposalCount: string;
}

export interface TaxPdfDividendRow {
  sourceActivityId: string;
  accountId: string;
  symbolProfileId: string;
  activityDate: string;
  transactionCurrency: string;
  grossDividendTransactionCurrency: string;
  withholdingTaxTransactionCurrency: string;
  netDividendTransactionCurrency: string;
  activityFeeTransactionCurrency: string;
  grossDividendBaseCurrency: string;
  withholdingTaxBaseCurrency: string;
  netDividendBaseCurrency: string;
  activityFeeBaseCurrency: string;
}

export interface TaxPdfRealizedGainRow {
  sellActivityId: string;
  realizedAt: string;
  transactionCurrency: string;
  sellQuantity: string;
  matchedQuantity: string;
  grossProceedsBaseCurrency: string;
  grossCostBasisBaseCurrency: string;
  grossRealizedGainBaseCurrency: string;
  activityFeesBaseCurrency: string;
  realizedGainAfterActivityFeesBaseCurrency: string;
}

export interface TaxPdfFifoMatchRow {
  traceId: string;
  buyActivityId: string;
  sellActivityId: string;
  acquiredAt: string;
  realizedAt: string;
  matchedQuantity: string;
  grossCostBasisBaseCurrency: string;
  grossProceedsBaseCurrency: string;
  grossRealizedGainBaseCurrency: string;
  activityFeesBaseCurrency: string;
  realizedGainAfterActivityFeesBaseCurrency: string;
}

export interface TaxPdfAverageCostEventRow {
  traceId: string;
  sourceActivityId: string;
  sellActivityId: string;
  activityDate: string;
  quantity: string;
  poolQuantityBefore: string;
  averageGrossUnitCostBefore: string;
  poolQuantityAfter: string;
  averageGrossUnitCostAfter: string;
}

export type TaxPdfTrace =
  | {
      method: 'FIFO';
      matches: TaxPdfFifoMatchRow[];
    }
  | {
      method: 'AVERAGE_COST';
      events: TaxPdfAverageCostEventRow[];
    };

export interface TaxPdfDiagnosticRow {
  code: string;
  message: string;
  relatedActivityIds: string[];
  excludedActivityIds: string[];
}

export interface TaxPdfReport {
  metadata: TaxPdfMetadata;
  annualSummary: TaxPdfAnnualSummary;
  dividends: TaxPdfDividendRow[];
  realizedGains: TaxPdfRealizedGainRow[];
  trace: TaxPdfTrace;
  warnings: TaxPdfDiagnosticRow[];
  errors: TaxPdfDiagnosticRow[];
  incompleteNotice: string | null;
  reportNote: string;
}

export class TaxPdfReportBuilder {
  public static build({
    generatedAt,
    summary,
    trace
  }: {
    generatedAt?: Date;
    summary: YearlyTaxSummary;
    trace: TaxExportTrace;
  }): TaxPdfReport {
    TaxPdfReportBuilder.assertTraceMatchesMethod({
      summary,
      trace
    });

    const exportGeneratedAt = generatedAt ?? summary.calculatedAt;

    return {
      metadata: {
        title: TAX_PDF_TITLE,
        reportYear: summary.year,
        method: summary.method,
        baseCurrency: summary.baseCurrency,
        generatedAt: exportGeneratedAt,
        generatedAtIso: exportGeneratedAt.toISOString(),
        status: summary.isComplete ? 'Complete' : 'Incomplete'
      },
      annualSummary: {
        grossDividends: TaxPdfReportBuilder.decimalOrUnavailable(
          summary.grossDividendsBaseCurrency
        ),
        withholdingTax: TaxPdfReportBuilder.decimalOrUnavailable(
          summary.totalWithholdingTaxBaseCurrency
        ),
        netDividends: TaxPdfReportBuilder.decimalOrUnavailable(
          summary.netDividendsBaseCurrency
        ),
        grossProceeds: TaxPdfReportBuilder.decimalOrUnavailable(
          summary.grossProceedsBaseCurrency
        ),
        grossCostBasis: TaxPdfReportBuilder.decimalOrUnavailable(
          summary.grossCostBasisBaseCurrency
        ),
        grossRealizedGain: TaxPdfReportBuilder.decimalOrUnavailable(
          summary.grossRealizedGainBaseCurrency
        ),
        activityFees: TaxPdfReportBuilder.decimalOrUnavailable(
          summary.totalActivityFeesBaseCurrency
        ),
        realizedGainAfterActivityFees: TaxPdfReportBuilder.decimalOrUnavailable(
          summary.realizedGainAfterActivityFeesBaseCurrency
        ),
        dividendCount: summary.dividendCount.toString(),
        disposalCount: summary.disposalCount.toString()
      },
      dividends: [...summary.dividendRecords]
        .sort((left, right) => {
          const dateComparison = left.date.getTime() - right.date.getTime();

          if (dateComparison !== 0) {
            return dateComparison;
          }

          return TaxPdfReportBuilder.compareText(
            left.sourceActivityId,
            right.sourceActivityId
          );
        })
        .map((record) => {
          return {
            sourceActivityId: record.sourceActivityId,
            accountId: record.accountId,
            symbolProfileId: record.symbolProfileId,
            activityDate: record.date.toISOString(),
            transactionCurrency:
              record.transactionCurrency ?? TAX_PDF_NOT_AVAILABLE,
            grossDividendTransactionCurrency: record.grossDividend.toString(),
            withholdingTaxTransactionCurrency:
              TaxPdfReportBuilder.decimalOrUnavailable(record.withholdingTax),
            netDividendTransactionCurrency:
              TaxPdfReportBuilder.decimalOrUnavailable(record.netDividend),
            activityFeeTransactionCurrency: record.activityFee.toString(),
            grossDividendBaseCurrency: TaxPdfReportBuilder.decimalOrUnavailable(
              record.grossDividendBaseCurrency
            ),
            withholdingTaxBaseCurrency:
              TaxPdfReportBuilder.decimalOrUnavailable(
                record.withholdingTaxBaseCurrency
              ),
            netDividendBaseCurrency: TaxPdfReportBuilder.decimalOrUnavailable(
              record.netDividendBaseCurrency
            ),
            activityFeeBaseCurrency: TaxPdfReportBuilder.decimalOrUnavailable(
              record.activityFeeBaseCurrency
            )
          };
        }),
      realizedGains: [...summary.realizedGains]
        .sort((left, right) => {
          const dateComparison =
            left.sellDate.getTime() - right.sellDate.getTime();

          if (dateComparison !== 0) {
            return dateComparison;
          }

          return TaxPdfReportBuilder.compareText(
            left.sellActivityId,
            right.sellActivityId
          );
        })
        .map((record) => {
          return {
            sellActivityId: record.sellActivityId,
            realizedAt: record.sellDate.toISOString(),
            transactionCurrency:
              record.transactionCurrency ?? TAX_PDF_NOT_AVAILABLE,
            sellQuantity: record.sellQuantity.toString(),
            matchedQuantity: record.matchedQuantity.toString(),
            grossProceedsBaseCurrency: TaxPdfReportBuilder.decimalOrUnavailable(
              record.grossProceedsBaseCurrency
            ),
            grossCostBasisBaseCurrency:
              TaxPdfReportBuilder.decimalOrUnavailable(
                record.grossCostBasisBaseCurrency
              ),
            grossRealizedGainBaseCurrency:
              TaxPdfReportBuilder.decimalOrUnavailable(
                record.grossRealizedGainBaseCurrency
              ),
            activityFeesBaseCurrency: TaxPdfReportBuilder.decimalOrUnavailable(
              record.totalActivityFeesBaseCurrency
            ),
            realizedGainAfterActivityFeesBaseCurrency:
              TaxPdfReportBuilder.decimalOrUnavailable(
                record.realizedGainAfterActivityFeesBaseCurrency
              )
          };
        }),
      trace: TaxPdfReportBuilder.buildTrace(trace),
      warnings: TaxPdfReportBuilder.buildDiagnostics(summary.warnings),
      errors: TaxPdfReportBuilder.buildDiagnostics(summary.errors),
      incompleteNotice: summary.isComplete
        ? null
        : 'Incomplete report: one or more tax values are unavailable. Review the warnings and errors before relying on the report.',
      reportNote:
        'This report is for tax analytics and record review. It is not an official tax return, filing form, or personal tax advice.'
    };
  }

  private static buildTrace(trace: TaxExportTrace): TaxPdfTrace {
    if (trace.method === 'FIFO') {
      return {
        method: 'FIFO',
        matches: [...trace.matches]
          .sort((left, right) => {
            const realizedComparison =
              left.realizedAt.getTime() - right.realizedAt.getTime();

            if (realizedComparison !== 0) {
              return realizedComparison;
            }

            const sellComparison = TaxPdfReportBuilder.compareText(
              left.sellActivityId,
              right.sellActivityId
            );

            if (sellComparison !== 0) {
              return sellComparison;
            }

            const acquiredComparison =
              left.acquiredAt.getTime() - right.acquiredAt.getTime();

            if (acquiredComparison !== 0) {
              return acquiredComparison;
            }

            return TaxPdfReportBuilder.compareText(left.traceId, right.traceId);
          })
          .map((match) => TaxPdfReportBuilder.buildFifoMatchRow(match))
      };
    }

    return {
      method: 'AVERAGE_COST',
      events: [...trace.events]
        .sort((left, right) => {
          const dateComparison =
            left.activityDate.getTime() - right.activityDate.getTime();

          if (dateComparison !== 0) {
            return dateComparison;
          }

          return TaxPdfReportBuilder.compareText(left.traceId, right.traceId);
        })
        .map((event) => TaxPdfReportBuilder.buildAverageCostEventRow(event))
    };
  }

  private static buildFifoMatchRow(
    match: TaxExportFifoMatch
  ): TaxPdfFifoMatchRow {
    return {
      traceId: match.traceId,
      buyActivityId: match.buyActivityId,
      sellActivityId: match.sellActivityId,
      acquiredAt: match.acquiredAt.toISOString(),
      realizedAt: match.realizedAt.toISOString(),
      matchedQuantity: match.matchedQuantity.toString(),
      grossCostBasisBaseCurrency: TaxPdfReportBuilder.decimalOrUnavailable(
        match.grossCostBasisBaseCurrency
      ),
      grossProceedsBaseCurrency: TaxPdfReportBuilder.decimalOrUnavailable(
        match.grossProceedsBaseCurrency
      ),
      grossRealizedGainBaseCurrency: TaxPdfReportBuilder.decimalOrUnavailable(
        match.grossRealizedGainBaseCurrency
      ),
      activityFeesBaseCurrency: TaxPdfReportBuilder.decimalOrUnavailable(
        match.activityFeesBaseCurrency
      ),
      realizedGainAfterActivityFeesBaseCurrency:
        TaxPdfReportBuilder.decimalOrUnavailable(
          match.realizedGainAfterActivityFeesBaseCurrency
        )
    };
  }

  private static buildAverageCostEventRow(
    event: TaxExportAverageCostEvent
  ): TaxPdfAverageCostEventRow {
    return {
      traceId: event.traceId,
      sourceActivityId: event.sourceActivityId,
      sellActivityId: event.sellActivityId ?? TAX_PDF_NOT_AVAILABLE,
      activityDate: event.activityDate.toISOString(),
      quantity: event.quantity.toString(),
      poolQuantityBefore: event.poolQuantityBefore.toString(),
      averageGrossUnitCostBefore: TaxPdfReportBuilder.decimalOrUnavailable(
        event.averageGrossUnitCostBefore
      ),
      poolQuantityAfter: event.poolQuantityAfter.toString(),
      averageGrossUnitCostAfter: TaxPdfReportBuilder.decimalOrUnavailable(
        event.averageGrossUnitCostAfter
      )
    };
  }

  private static buildDiagnostics(
    diagnostics: readonly (YearlyTaxSummaryWarning | YearlyTaxSummaryError)[]
  ): TaxPdfDiagnosticRow[] {
    return [...diagnostics]
      .sort((left, right) => {
        const codeComparison = TaxPdfReportBuilder.compareText(
          left.code,
          right.code
        );

        if (codeComparison !== 0) {
          return codeComparison;
        }

        return TaxPdfReportBuilder.compareText(left.message, right.message);
      })
      .map((diagnostic) => {
        return {
          code: diagnostic.code,
          message: diagnostic.message,
          relatedActivityIds:
            TaxPdfReportBuilder.getRelatedActivityIds(diagnostic),
          excludedActivityIds:
            TaxPdfReportBuilder.getExcludedActivityIds(diagnostic)
        };
      });
  }

  private static getRelatedActivityIds(
    diagnostic: YearlyTaxSummaryWarning | YearlyTaxSummaryError
  ): string[] {
    if ('sourceActivityIds' in diagnostic) {
      return [...diagnostic.sourceActivityIds].sort(
        TaxPdfReportBuilder.compareText
      );
    }

    if ('sellActivityIds' in diagnostic) {
      return [...diagnostic.sellActivityIds].sort(
        TaxPdfReportBuilder.compareText
      );
    }

    if ('affectedSellActivityIds' in diagnostic) {
      return [...diagnostic.affectedSellActivityIds].sort(
        TaxPdfReportBuilder.compareText
      );
    }

    return [];
  }

  private static getExcludedActivityIds(
    diagnostic: YearlyTaxSummaryWarning | YearlyTaxSummaryError
  ): string[] {
    if ('excludedActivityIds' in diagnostic) {
      return [...diagnostic.excludedActivityIds].sort(
        TaxPdfReportBuilder.compareText
      );
    }

    return [];
  }

  private static decimalOrUnavailable(value: Big | null): string {
    return value === null ? TAX_PDF_NOT_AVAILABLE : value.toString();
  }

  private static compareText(this: void, left: string, right: string): number {
    if (left < right) {
      return -1;
    }

    if (left > right) {
      return 1;
    }

    return 0;
  }

  private static assertTraceMatchesMethod({
    summary,
    trace
  }: {
    summary: YearlyTaxSummary;
    trace: TaxExportTrace;
  }): void {
    if (summary.method !== trace.method) {
      throw new Error(
        `Tax PDF trace method ${trace.method} does not match yearly summary method ${summary.method}.`
      );
    }
  }
}
