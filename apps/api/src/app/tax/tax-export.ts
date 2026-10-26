import { Big } from 'big.js';
import { unparse } from 'papaparse';

import type {
  YearlyTaxSummary,
  YearlyTaxSummaryError,
  YearlyTaxSummaryWarning
} from './yearly-tax-summary';

export const TAX_EXPORT_COLUMNS = [
  'recordType',
  'reportYear',
  'method',
  'baseCurrency',
  'generatedAt',
  'isComplete',

  'sourceActivityId',
  'buyActivityId',
  'sellActivityId',
  'accountId',
  'symbolProfileId',

  'activityDate',
  'acquiredAt',
  'realizedAt',

  'transactionCurrency',
  'assetCurrency',

  'quantity',
  'matchedQuantity',
  'unmatchedQuantity',

  'grossDividendTransactionCurrency',
  'withholdingTaxTransactionCurrency',
  'withholdingTaxRate',
  'netDividendTransactionCurrency',
  'activityFeeTransactionCurrency',
  'activityFeeBaseCurrency',

  'grossDividendBaseCurrency',
  'withholdingTaxBaseCurrency',
  'netDividendBaseCurrency',

  'grossProceedsBaseCurrency',
  'grossCostBasisBaseCurrency',
  'grossRealizedGainBaseCurrency',
  'activityFeesBaseCurrency',
  'realizedGainAfterActivityFeesBaseCurrency',

  'poolQuantityBefore',
  'averageGrossUnitCostBefore',
  'poolQuantityAfter',
  'averageGrossUnitCostAfter',

  'summaryGrossDividends',
  'summaryWithholdingTax',
  'summaryNetDividends',
  'summaryGrossProceeds',
  'summaryGrossCostBasis',
  'summaryGrossRealizedGain',
  'summaryActivityFees',
  'summaryRealizedGainAfterActivityFees',

  'dividendCount',
  'disposalCount',

  'traceId',
  'traceIds',
  'relatedActivityIds',
  'excludedActivityIds',
  'warningCodes',
  'errorCodes',
  'message'
] as const;

export type TaxExportColumn = (typeof TAX_EXPORT_COLUMNS)[number];

export type TaxExportRecordType =
  | 'SUMMARY'
  | 'DIVIDEND'
  | 'REALIZED_GAIN'
  | 'FIFO_MATCH'
  | 'AVERAGE_COST_EVENT'
  | 'WARNING'
  | 'ERROR';

export interface TaxExportFifoMatch {
  traceId: string;

  buyActivityId: string;
  sellActivityId: string;

  acquiredAt: Date;
  realizedAt: Date;

  matchedQuantity: Big;

  grossCostBasisBaseCurrency: Big | null;
  grossProceedsBaseCurrency: Big | null;
  grossRealizedGainBaseCurrency: Big | null;
  activityFeesBaseCurrency: Big | null;
  realizedGainAfterActivityFeesBaseCurrency: Big | null;
}

export interface TaxExportAverageCostEvent {
  traceId: string;

  sourceActivityId: string;
  sellActivityId: string | null;

  activityDate: Date;

  quantity: Big;

  poolQuantityBefore: Big;
  averageGrossUnitCostBefore: Big | null;

  poolQuantityAfter: Big;
  averageGrossUnitCostAfter: Big | null;
}

export type TaxExportTrace =
  | {
      method: 'FIFO';
      matches: readonly TaxExportFifoMatch[];
    }
  | {
      method: 'AVERAGE_COST';
      events: readonly TaxExportAverageCostEvent[];
    };

export interface TaxCsvExportResult {
  format: 'CSV';

  fileName: string;
  contentType: 'text/csv';

  content: string;
}

type TaxExportRow = Record<TaxExportColumn, string>;

export class TaxExport {
  public static generate({
    generatedAt,
    summary,
    trace
  }: {
    generatedAt?: Date;
    summary: YearlyTaxSummary;
    trace: TaxExportTrace;
  }): TaxCsvExportResult {
    TaxExport.assertTraceMatchesMethod({
      summary,
      trace
    });

    const exportGeneratedAt = generatedAt ?? summary.calculatedAt;

    const rows: TaxExportRow[] = [
      TaxExport.createSummaryRow({
        generatedAt: exportGeneratedAt,
        summary
      }),

      ...TaxExport.createDividendRows({
        generatedAt: exportGeneratedAt,
        summary
      }),

      ...TaxExport.createRealizedGainRows({
        generatedAt: exportGeneratedAt,
        summary,
        trace
      }),

      ...TaxExport.createTraceRows({
        generatedAt: exportGeneratedAt,
        summary,
        trace
      }),

      ...TaxExport.createWarningRows({
        generatedAt: exportGeneratedAt,
        summary
      }),

      ...TaxExport.createErrorRows({
        generatedAt: exportGeneratedAt,
        summary
      })
    ];

    const content = unparse(
      {
        fields: [...TAX_EXPORT_COLUMNS],
        data: rows.map((row) => {
          return TAX_EXPORT_COLUMNS.map((column) => row[column]);
        })
      },
      {
        delimiter: ',',
        header: true,
        newline: '\r\n',
        quotes: false,
        skipEmptyLines: false
      }
    );

    return {
      format: 'CSV',
      fileName: `ghostfolio-tax-${summary.year}-${TaxExport.getMethodSlug(
        summary.method
      )}.csv`,
      contentType: 'text/csv',
      content
    };
  }

  private static createSummaryRow({
    generatedAt,
    summary
  }: {
    generatedAt: Date;
    summary: YearlyTaxSummary;
  }): TaxExportRow {
    const row = TaxExport.createCommonRow({
      generatedAt,
      recordType: 'SUMMARY',
      summary
    });

    row.summaryGrossDividends = TaxExport.decimalOrEmpty(
      summary.grossDividendsBaseCurrency
    );

    row.summaryWithholdingTax = TaxExport.decimalOrEmpty(
      summary.totalWithholdingTaxBaseCurrency
    );

    row.summaryNetDividends = TaxExport.decimalOrEmpty(
      summary.netDividendsBaseCurrency
    );

    row.summaryGrossProceeds = TaxExport.decimalOrEmpty(
      summary.grossProceedsBaseCurrency
    );

    row.summaryGrossCostBasis = TaxExport.decimalOrEmpty(
      summary.grossCostBasisBaseCurrency
    );

    row.summaryGrossRealizedGain = TaxExport.decimalOrEmpty(
      summary.grossRealizedGainBaseCurrency
    );

    row.summaryActivityFees = TaxExport.decimalOrEmpty(
      summary.totalActivityFeesBaseCurrency
    );

    row.summaryRealizedGainAfterActivityFees = TaxExport.decimalOrEmpty(
      summary.realizedGainAfterActivityFeesBaseCurrency
    );

    row.dividendCount = summary.dividendCount.toString();
    row.disposalCount = summary.disposalCount.toString();

    row.warningCodes = TaxExport.joinTextValues(
      summary.warnings
        .map(({ code }) => code)
        .sort((left, right) => TaxExport.compareText(left, right))
    );

    row.errorCodes = TaxExport.joinTextValues(
      summary.errors
        .map(({ code }) => code)
        .sort((left, right) => TaxExport.compareText(left, right))
    );

    return row;
  }

  private static createDividendRows({
    generatedAt,
    summary
  }: {
    generatedAt: Date;
    summary: YearlyTaxSummary;
  }): TaxExportRow[] {
    return [...summary.dividendRecords]
      .sort((left, right) => {
        const dateDifference = left.date.getTime() - right.date.getTime();

        if (dateDifference !== 0) {
          return dateDifference;
        }

        return TaxExport.compareText(
          left.sourceActivityId,
          right.sourceActivityId
        );
      })
      .map((record) => {
        const row = TaxExport.createCommonRow({
          generatedAt,
          recordType: 'DIVIDEND',
          summary
        });

        row.sourceActivityId = TaxExport.safeText(record.sourceActivityId);

        row.accountId = TaxExport.safeTextOrEmpty(record.accountId);

        row.symbolProfileId = TaxExport.safeText(record.symbolProfileId);

        row.activityDate = record.date.toISOString();

        row.transactionCurrency = TaxExport.safeTextOrEmpty(
          record.transactionCurrency
        );

        /*
         * assetCurrency is intentionally left empty because
         * YearlyTaxSummary does not currently expose an authoritative
         * asset-currency value. Populating it belongs in the upstream
         * tax-domain identity contract rather than this serializer.
         */

        row.grossDividendTransactionCurrency = TaxExport.decimal(
          record.grossDividend
        );

        row.withholdingTaxTransactionCurrency = TaxExport.decimalOrEmpty(
          record.withholdingTax
        );

        /*
         * YearlyTaxSummary currently stores withholding amount rather than an
         * authoritative withholding rate. The export must not derive a new tax
         * value, so withholdingTaxRate remains empty until such a source value
         * is part of the tax-domain contract.
         */

        row.netDividendTransactionCurrency = TaxExport.decimalOrEmpty(
          record.netDividend
        );

        row.activityFeeTransactionCurrency = TaxExport.decimal(
          record.activityFee
        );

        row.activityFeeBaseCurrency = TaxExport.decimalOrEmpty(
          record.activityFeeBaseCurrency
        );

        row.grossDividendBaseCurrency = TaxExport.decimalOrEmpty(
          record.grossDividendBaseCurrency
        );

        row.withholdingTaxBaseCurrency = TaxExport.decimalOrEmpty(
          record.withholdingTaxBaseCurrency
        );

        row.netDividendBaseCurrency = TaxExport.decimalOrEmpty(
          record.netDividendBaseCurrency
        );

        row.warningCodes = TaxExport.getRelatedWarningCodes({
          activityId: record.sourceActivityId,
          summary
        });

        row.errorCodes = TaxExport.getRelatedErrorCodes({
          activityId: record.sourceActivityId,
          summary
        });

        return row;
      });
  }

  private static createRealizedGainRows({
    generatedAt,
    summary,
    trace
  }: {
    generatedAt: Date;
    summary: YearlyTaxSummary;
    trace: TaxExportTrace;
  }): TaxExportRow[] {
    return [...summary.realizedGains]
      .sort((left, right) => {
        const dateDifference =
          left.sellDate.getTime() - right.sellDate.getTime();

        if (dateDifference !== 0) {
          return dateDifference;
        }

        return TaxExport.compareText(left.sellActivityId, right.sellActivityId);
      })
      .map((record) => {
        const row = TaxExport.createCommonRow({
          generatedAt,
          recordType: 'REALIZED_GAIN',
          summary
        });

        row.sellActivityId = TaxExport.safeText(record.sellActivityId);

        row.realizedAt = record.sellDate.toISOString();

        row.transactionCurrency = TaxExport.safeTextOrEmpty(
          record.transactionCurrency
        );

        row.quantity = TaxExport.decimal(record.sellQuantity);

        row.matchedQuantity = TaxExport.decimal(record.matchedQuantity);

        /*
         * unmatchedQuantity is a presentation-only identity derived from two
         * already-calculated quantities. No cost basis, gain, withholding, FX,
         * or yearly total is recalculated here.
         */
        row.unmatchedQuantity = TaxExport.decimal(
          record.sellQuantity.minus(record.matchedQuantity)
        );

        row.grossProceedsBaseCurrency = TaxExport.decimalOrEmpty(
          record.grossProceedsBaseCurrency
        );

        row.grossCostBasisBaseCurrency = TaxExport.decimalOrEmpty(
          record.grossCostBasisBaseCurrency
        );

        row.grossRealizedGainBaseCurrency = TaxExport.decimalOrEmpty(
          record.grossRealizedGainBaseCurrency
        );

        row.activityFeesBaseCurrency = TaxExport.decimalOrEmpty(
          record.totalActivityFeesBaseCurrency
        );

        row.realizedGainAfterActivityFeesBaseCurrency =
          TaxExport.decimalOrEmpty(
            record.realizedGainAfterActivityFeesBaseCurrency
          );

        row.traceIds = TaxExport.joinTextValues(
          TaxExport.getTraceIdsForSale({
            sellActivityId: record.sellActivityId,
            trace
          })
        );

        row.warningCodes = TaxExport.getRelatedWarningCodes({
          activityId: record.sellActivityId,
          summary
        });

        row.errorCodes = TaxExport.getRelatedErrorCodes({
          activityId: record.sellActivityId,
          summary
        });

        return row;
      });
  }

  private static createTraceRows({
    generatedAt,
    summary,
    trace
  }: {
    generatedAt: Date;
    summary: YearlyTaxSummary;
    trace: TaxExportTrace;
  }): TaxExportRow[] {
    if (trace.method === 'FIFO') {
      return [...trace.matches]
        .sort((left, right) => {
          const realizedDifference =
            left.realizedAt.getTime() - right.realizedAt.getTime();

          if (realizedDifference !== 0) {
            return realizedDifference;
          }

          const sellDifference = TaxExport.compareText(
            left.sellActivityId,
            right.sellActivityId
          );

          if (sellDifference !== 0) {
            return sellDifference;
          }

          const acquiredDifference =
            left.acquiredAt.getTime() - right.acquiredAt.getTime();

          if (acquiredDifference !== 0) {
            return acquiredDifference;
          }

          const buyDifference = TaxExport.compareText(
            left.buyActivityId,
            right.buyActivityId
          );

          if (buyDifference !== 0) {
            return buyDifference;
          }

          return TaxExport.compareText(left.traceId, right.traceId);
        })
        .map((match) => {
          const row = TaxExport.createCommonRow({
            generatedAt,
            recordType: 'FIFO_MATCH',
            summary
          });

          row.traceId = TaxExport.safeText(match.traceId);

          row.buyActivityId = TaxExport.safeText(match.buyActivityId);
          row.sellActivityId = TaxExport.safeText(match.sellActivityId);

          row.acquiredAt = match.acquiredAt.toISOString();
          row.realizedAt = match.realizedAt.toISOString();

          row.matchedQuantity = TaxExport.decimal(match.matchedQuantity);

          row.grossCostBasisBaseCurrency = TaxExport.decimalOrEmpty(
            match.grossCostBasisBaseCurrency
          );

          row.grossProceedsBaseCurrency = TaxExport.decimalOrEmpty(
            match.grossProceedsBaseCurrency
          );

          row.grossRealizedGainBaseCurrency = TaxExport.decimalOrEmpty(
            match.grossRealizedGainBaseCurrency
          );

          row.activityFeesBaseCurrency = TaxExport.decimalOrEmpty(
            match.activityFeesBaseCurrency
          );

          row.realizedGainAfterActivityFeesBaseCurrency =
            TaxExport.decimalOrEmpty(
              match.realizedGainAfterActivityFeesBaseCurrency
            );

          return row;
        });
    }

    return [...trace.events]
      .sort((left, right) => {
        const dateDifference =
          left.activityDate.getTime() - right.activityDate.getTime();

        if (dateDifference !== 0) {
          return dateDifference;
        }

        const activityDifference = TaxExport.compareText(
          left.sourceActivityId,
          right.sourceActivityId
        );

        if (activityDifference !== 0) {
          return activityDifference;
        }

        return TaxExport.compareText(left.traceId, right.traceId);
      })
      .map((event) => {
        const row = TaxExport.createCommonRow({
          generatedAt,
          recordType: 'AVERAGE_COST_EVENT',
          summary
        });

        row.traceId = TaxExport.safeText(event.traceId);

        row.sourceActivityId = TaxExport.safeText(event.sourceActivityId);

        row.sellActivityId = TaxExport.safeTextOrEmpty(event.sellActivityId);

        row.activityDate = event.activityDate.toISOString();

        row.quantity = TaxExport.decimal(event.quantity);

        row.poolQuantityBefore = TaxExport.decimal(event.poolQuantityBefore);

        row.averageGrossUnitCostBefore = TaxExport.decimalOrEmpty(
          event.averageGrossUnitCostBefore
        );

        row.poolQuantityAfter = TaxExport.decimal(event.poolQuantityAfter);

        row.averageGrossUnitCostAfter = TaxExport.decimalOrEmpty(
          event.averageGrossUnitCostAfter
        );

        return row;
      });
  }

  private static createWarningRows({
    generatedAt,
    summary
  }: {
    generatedAt: Date;
    summary: YearlyTaxSummary;
  }): TaxExportRow[] {
    return [...summary.warnings]
      .sort((left, right) => {
        const codeDifference = TaxExport.compareText(left.code, right.code);

        if (codeDifference !== 0) {
          return codeDifference;
        }

        return TaxExport.compareText(left.message, right.message);
      })
      .map((warning) => {
        const row = TaxExport.createCommonRow({
          generatedAt,
          recordType: 'WARNING',
          summary
        });

        row.relatedActivityIds = TaxExport.joinTextValues(
          TaxExport.getDiagnosticRelatedActivityIds(warning)
        );

        row.excludedActivityIds = TaxExport.joinTextValues(
          TaxExport.getDiagnosticExcludedActivityIds(warning)
        );

        row.warningCodes = TaxExport.safeText(warning.code);
        row.message = TaxExport.safeText(warning.message);

        return row;
      });
  }

  private static createErrorRows({
    generatedAt,
    summary
  }: {
    generatedAt: Date;
    summary: YearlyTaxSummary;
  }): TaxExportRow[] {
    return [...summary.errors]
      .sort((left, right) => {
        const codeDifference = TaxExport.compareText(left.code, right.code);

        if (codeDifference !== 0) {
          return codeDifference;
        }

        return TaxExport.compareText(left.message, right.message);
      })
      .map((error) => {
        const row = TaxExport.createCommonRow({
          generatedAt,
          recordType: 'ERROR',
          summary
        });

        row.relatedActivityIds = TaxExport.joinTextValues(
          TaxExport.getDiagnosticRelatedActivityIds(error)
        );

        row.excludedActivityIds = TaxExport.joinTextValues(
          TaxExport.getDiagnosticExcludedActivityIds(error)
        );

        row.errorCodes = TaxExport.safeText(error.code);
        row.message = TaxExport.safeText(error.message);

        return row;
      });
  }

  private static createCommonRow({
    generatedAt,
    recordType,
    summary
  }: {
    generatedAt: Date;
    recordType: TaxExportRecordType;
    summary: YearlyTaxSummary;
  }): TaxExportRow {
    const row = TaxExport.createEmptyRow();

    row.recordType = recordType;

    row.reportYear = summary.year.toString();

    row.method = TaxExport.safeText(summary.method);

    row.baseCurrency = TaxExport.safeText(summary.baseCurrency);

    row.generatedAt = generatedAt.toISOString();

    row.isComplete = summary.isComplete ? 'true' : 'false';

    return row;
  }

  private static createEmptyRow(): TaxExportRow {
    return Object.fromEntries(
      TAX_EXPORT_COLUMNS.map((column) => [column, ''])
    ) as TaxExportRow;
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
        `Tax export trace method ${trace.method} does not match yearly summary method ${summary.method}.`
      );
    }
  }

  private static getTraceIdsForSale({
    sellActivityId,
    trace
  }: {
    sellActivityId: string;
    trace: TaxExportTrace;
  }): string[] {
    if (trace.method === 'FIFO') {
      return trace.matches
        .filter((match) => match.sellActivityId === sellActivityId)
        .map(({ traceId }) => traceId)
        .sort((left, right) => TaxExport.compareText(left, right));
    }

    return trace.events
      .filter((event) => event.sellActivityId === sellActivityId)
      .map(({ traceId }) => traceId)
      .sort((left, right) => TaxExport.compareText(left, right));
  }

  private static getRelatedWarningCodes({
    activityId,
    summary
  }: {
    activityId: string;
    summary: YearlyTaxSummary;
  }): string {
    return TaxExport.joinTextValues(
      summary.warnings
        .filter((warning) => {
          return TaxExport.getDiagnosticActivityIds(warning).includes(
            activityId
          );
        })
        .map(({ code }) => code)
        .sort((left, right) => TaxExport.compareText(left, right))
    );
  }

  private static getRelatedErrorCodes({
    activityId,
    summary
  }: {
    activityId: string;
    summary: YearlyTaxSummary;
  }): string {
    return TaxExport.joinTextValues(
      summary.errors
        .filter((error) => {
          return TaxExport.getDiagnosticActivityIds(error).includes(activityId);
        })
        .map(({ code }) => code)
        .sort((left, right) => TaxExport.compareText(left, right))
    );
  }

  private static getDiagnosticActivityIds(
    diagnostic: YearlyTaxSummaryWarning | YearlyTaxSummaryError
  ): string[] {
    return [
      ...TaxExport.getDiagnosticRelatedActivityIds(diagnostic),
      ...TaxExport.getDiagnosticExcludedActivityIds(diagnostic)
    ]
      .filter(
        (activityId, index, values) => values.indexOf(activityId) === index
      )
      .sort((left, right) => TaxExport.compareText(left, right));
  }

  private static getDiagnosticRelatedActivityIds(
    diagnostic: YearlyTaxSummaryWarning | YearlyTaxSummaryError
  ): string[] {
    let activityIds: string[];

    if ('sourceActivityIds' in diagnostic) {
      activityIds = diagnostic.sourceActivityIds;
    } else if ('sellActivityIds' in diagnostic) {
      activityIds = diagnostic.sellActivityIds;
    } else {
      activityIds = diagnostic.affectedSellActivityIds;
    }

    return [...new Set(activityIds)].sort((left, right) =>
      TaxExport.compareText(left, right)
    );
  }

  private static getDiagnosticExcludedActivityIds(
    diagnostic: YearlyTaxSummaryWarning | YearlyTaxSummaryError
  ): string[] {
    if (!('excludedActivityIds' in diagnostic)) {
      return [];
    }

    return [...new Set(diagnostic.excludedActivityIds)].sort((left, right) =>
      TaxExport.compareText(left, right)
    );
  }

  private static compareText(left: string, right: string): number {
    if (left < right) {
      return -1;
    }

    if (left > right) {
      return 1;
    }

    return 0;
  }

  private static getMethodSlug(method: YearlyTaxSummary['method']): string {
    if (method === 'AVERAGE_COST') {
      return 'average-cost';
    }

    return 'fifo';
  }

  /*
   * Big#toFixed() is intentionally used instead of Big#toString().
   *
   * Big#toString() can use exponential notation for sufficiently small or
   * large values. The export contract requires plain decimal strings.
   */
  private static decimal(value: Big): string {
    return value.toFixed();
  }

  private static decimalOrEmpty(value: Big | null): string {
    if (value === null) {
      return '';
    }

    return TaxExport.decimal(value);
  }

  private static safeTextOrEmpty(value: string | null): string {
    if (value === null) {
      return '';
    }

    return TaxExport.safeText(value);
  }

  /*
   * Spreadsheet applications can interpret text beginning with =, +, -, or @
   * as a formula. Only textual fields pass through this function.
   *
   * Numeric values are serialized separately through decimal()/toFixed(), so
   * legitimate negative financial values remain numeric rather than being
   * escaped as text.
   */
  private static safeText(value: string): string {
    if (/^[=+\-@\t\r]/.test(value)) {
      return `'${value}`;
    }

    return value;
  }

  private static joinTextValues(values: readonly string[]): string {
    return values.map((value) => TaxExport.safeText(value)).join('|');
  }
}
