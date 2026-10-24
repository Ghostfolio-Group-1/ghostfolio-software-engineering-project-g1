import { Big } from 'big.js';

import type { DividendRecord } from './dividend-record';
import type { TaxScopeDiagnostic } from './interfaces/tax-diagnostic.interface';
import type { TaxCalculationMethod } from './tax-calculator';

export const UNKNOWN_DIVIDEND_WITHHOLDING =
  'UNKNOWN_DIVIDEND_WITHHOLDING' as const;

export const MISSING_DIVIDEND_BASE_CURRENCY_CONVERSION =
  'MISSING_DIVIDEND_BASE_CURRENCY_CONVERSION' as const;

export const MISSING_REALIZED_GAIN_BASE_CURRENCY_CONVERSION =
  'MISSING_REALIZED_GAIN_BASE_CURRENCY_CONVERSION' as const;

export const PARTIAL_REALIZED_GAIN_RESULT =
  'PARTIAL_REALIZED_GAIN_RESULT' as const;

export interface YearlyRealizedGainSource {
  sellActivityId: string;
  sellDate: Date;
  transactionCurrency: string | null;

  sellQuantity: Big;
  matchedQuantity: Big;

  grossProceeds: Big;
  grossCostBasis: Big;
  grossRealizedGain: Big;

  allocatedAcquisitionFees: Big;
  allocatedSellFees: Big;

  realizedGainAfterActivityFees: Big;
}

export interface YearlyDividendRecord extends DividendRecord {
  baseCurrency: string;

  grossDividendBaseCurrency: Big | null;
  withholdingTaxBaseCurrency: Big | null;
  netDividendBaseCurrency: Big | null;
  activityFeeBaseCurrency: Big | null;
}

export interface YearlyRealizedGainRecord extends YearlyRealizedGainSource {
  baseCurrency: string;

  totalActivityFees: Big;

  grossProceedsBaseCurrency: Big | null;
  grossCostBasisBaseCurrency: Big | null;
  grossRealizedGainBaseCurrency: Big | null;
  totalActivityFeesBaseCurrency: Big | null;
  realizedGainAfterActivityFeesBaseCurrency: Big | null;
}

export interface YearlyTaxCurrencySummary {
  currency: string | null;

  totalGrossDividends: Big;
  totalWithholdingTax: Big | null;
  totalNetDividends: Big | null;

  grossProceeds: Big;
  grossCostBasis: Big;
  grossRealizedGain: Big;

  allocatedFees: Big;
  realizedGainAfterActivityFees: Big;
}

export interface UnknownDividendWithholdingWarning {
  code: typeof UNKNOWN_DIVIDEND_WITHHOLDING;
  message: string;
  sourceActivityIds: string[];
}

export interface PartialRealizedGainWarning {
  code: typeof PARTIAL_REALIZED_GAIN_RESULT;
  message: string;
  sellActivityIds: string[];
}

export type YearlyTaxSummaryWarning =
  | TaxScopeDiagnostic
  | UnknownDividendWithholdingWarning
  | PartialRealizedGainWarning;

export interface MissingDividendFxError {
  code: typeof MISSING_DIVIDEND_BASE_CURRENCY_CONVERSION;
  message: string;
  sourceActivityIds: string[];
}

export interface MissingRealizedGainFxError {
  code: typeof MISSING_REALIZED_GAIN_BASE_CURRENCY_CONVERSION;
  message: string;
  sellActivityIds: string[];
}

export type YearlyTaxSummaryError =
  MissingDividendFxError | MissingRealizedGainFxError;

export interface YearlyTaxSummary {
  year: number;
  method: TaxCalculationMethod;

  baseCurrency: string;
  calculatedAt: Date;

  grossDividendsBaseCurrency: Big | null;
  totalWithholdingTaxBaseCurrency: Big | null;
  netDividendsBaseCurrency: Big | null;

  grossProceedsBaseCurrency: Big | null;
  grossCostBasisBaseCurrency: Big | null;
  grossRealizedGainBaseCurrency: Big | null;

  totalActivityFeesBaseCurrency: Big | null;
  realizedGainAfterActivityFeesBaseCurrency: Big | null;

  dividendCount: number;
  disposalCount: number;

  currencySummaries: YearlyTaxCurrencySummary[];

  dividendRecords: YearlyDividendRecord[];
  realizedGains: YearlyRealizedGainRecord[];

  isComplete: boolean;

  warnings: YearlyTaxSummaryWarning[];
  errors: YearlyTaxSummaryError[];
}

export type BaseCurrencyRateResolver = ({
  baseCurrency,
  currency,
  date
}: {
  baseCurrency: string;
  currency: string | null;
  date: Date;
}) => Promise<Big | null>;

export async function calculateYearlyTaxSummary({
  baseCurrency,
  calculatedAt = new Date(),
  dividendRecords,
  getBaseCurrencyRate,
  method,
  realizedGains,
  sourceDiagnostics = [],
  year
}: {
  baseCurrency: string;
  calculatedAt?: Date;
  dividendRecords: readonly DividendRecord[];
  getBaseCurrencyRate: BaseCurrencyRateResolver;
  method: TaxCalculationMethod;
  realizedGains: readonly YearlyRealizedGainSource[];
  sourceDiagnostics?: readonly TaxScopeDiagnostic[];
  year: number;
}): Promise<YearlyTaxSummary> {
  if (!Number.isInteger(year)) {
    throw new Error('Yearly tax summary requires an integer year.');
  }

  const yearlyDividendRecords = dividendRecords.filter(({ date }) =>
    isInUtcYear(date, year)
  );

  const yearlyRealizedGains = realizedGains.filter(({ sellDate }) =>
    isInUtcYear(sellDate, year)
  );

  const unknownWithholdingActivityIds: string[] = [];
  const missingDividendFxActivityIds: string[] = [];
  const missingRealizedGainFxActivityIds: string[] = [];
  const partialRealizedGainSellActivityIds: string[] = [];

  const convertedDividendRecords: YearlyDividendRecord[] = [];

  /*
   * Base-currency conversion convention:
   *
   * - Dividend rows use the source DIVIDEND activity date.
   * - Realized-gain rows are sale-level analytics records, so all
   *   base-currency fields on one realized-gain row use that row's SELL date.
   *
   * This keeps each converted row internally reconcilable and avoids
   * introducing a jurisdiction-specific acquisition-date FX rule.
   *
   * Transaction-currency values remain the authoritative calculated values.
   *
   * If the historical rate for a required date is unavailable, the affected
   * base-currency values remain null and the yearly summary is incomplete.
   */

  for (const record of yearlyDividendRecords) {
    const rate = await getBaseCurrencyRate({
      baseCurrency,
      currency: record.transactionCurrency,
      date: record.date
    });

    if (record.withholdingTax === null) {
      unknownWithholdingActivityIds.push(record.sourceActivityId);
    }

    if (rate === null) {
      missingDividendFxActivityIds.push(record.sourceActivityId);
    }

    convertedDividendRecords.push({
      ...record,
      baseCurrency,
      grossDividendBaseCurrency: multiplyOrNull(record.grossDividend, rate),
      withholdingTaxBaseCurrency: multiplyOrNull(record.withholdingTax, rate),
      netDividendBaseCurrency: multiplyOrNull(record.netDividend, rate),
      activityFeeBaseCurrency: multiplyOrNull(record.activityFee, rate)
    });
  }

  const convertedRealizedGains: YearlyRealizedGainRecord[] = [];

  for (const record of yearlyRealizedGains) {
    const rate = await getBaseCurrencyRate({
      baseCurrency,
      currency: record.transactionCurrency,
      date: record.sellDate
    });

    if (rate === null) {
      missingRealizedGainFxActivityIds.push(record.sellActivityId);
    }

    if (!record.matchedQuantity.eq(record.sellQuantity)) {
      partialRealizedGainSellActivityIds.push(record.sellActivityId);
    }

    const totalActivityFees = record.allocatedAcquisitionFees.plus(
      record.allocatedSellFees
    );

    convertedRealizedGains.push({
      ...record,
      baseCurrency,
      totalActivityFees,

      grossProceedsBaseCurrency: multiplyOrNull(record.grossProceeds, rate),

      grossCostBasisBaseCurrency: multiplyOrNull(record.grossCostBasis, rate),

      grossRealizedGainBaseCurrency: multiplyOrNull(
        record.grossRealizedGain,
        rate
      ),

      totalActivityFeesBaseCurrency: multiplyOrNull(totalActivityFees, rate),

      realizedGainAfterActivityFeesBaseCurrency: multiplyOrNull(
        record.realizedGainAfterActivityFees,
        rate
      )
    });
  }

  const warnings: YearlyTaxSummaryWarning[] = [...sourceDiagnostics];
  const errors: YearlyTaxSummaryError[] = [];

  if (unknownWithholdingActivityIds.length > 0) {
    warnings.push({
      code: UNKNOWN_DIVIDEND_WITHHOLDING,
      message:
        'One or more dividend activities have unknown withholding tax, so complete withholding and net-dividend totals are unavailable.',
      sourceActivityIds: unknownWithholdingActivityIds
    });
  }

  if (partialRealizedGainSellActivityIds.length > 0) {
    warnings.push({
      code: PARTIAL_REALIZED_GAIN_RESULT,
      message:
        'One or more SELL activities were only partially matched to acquisition basis, so complete realized-gain totals are unavailable.',
      sellActivityIds: partialRealizedGainSellActivityIds
    });
  }

  if (missingDividendFxActivityIds.length > 0) {
    errors.push({
      code: MISSING_DIVIDEND_BASE_CURRENCY_CONVERSION,
      message:
        'Historical base-currency conversion is unavailable for one or more dividend activities.',
      sourceActivityIds: missingDividendFxActivityIds
    });
  }

  if (missingRealizedGainFxActivityIds.length > 0) {
    errors.push({
      code: MISSING_REALIZED_GAIN_BASE_CURRENCY_CONVERSION,
      message:
        'Historical base-currency conversion is unavailable for one or more realized-gain activities.',
      sellActivityIds: missingRealizedGainFxActivityIds
    });
  }

  const hasPartialRealizedGain = partialRealizedGainSellActivityIds.length > 0;

  let grossProceedsBaseCurrency = sumNullable(
    convertedRealizedGains.map(({ grossProceedsBaseCurrency }) => {
      return grossProceedsBaseCurrency;
    })
  );

  let grossCostBasisBaseCurrency = sumNullable(
    convertedRealizedGains.map(({ grossCostBasisBaseCurrency }) => {
      return grossCostBasisBaseCurrency;
    })
  );

  let grossRealizedGainBaseCurrency = sumNullable(
    convertedRealizedGains.map(({ grossRealizedGainBaseCurrency }) => {
      return grossRealizedGainBaseCurrency;
    })
  );

  let totalActivityFeesBaseCurrency = sumNullable(
    convertedRealizedGains.map(({ totalActivityFeesBaseCurrency }) => {
      return totalActivityFeesBaseCurrency;
    })
  );

  let realizedGainAfterActivityFeesBaseCurrency = sumNullable(
    convertedRealizedGains.map(
      ({ realizedGainAfterActivityFeesBaseCurrency }) => {
        return realizedGainAfterActivityFeesBaseCurrency;
      }
    )
  );

  if (hasPartialRealizedGain) {
    grossProceedsBaseCurrency = null;
    grossCostBasisBaseCurrency = null;
    grossRealizedGainBaseCurrency = null;
    totalActivityFeesBaseCurrency = null;
    realizedGainAfterActivityFeesBaseCurrency = null;
  }

  return {
    year,
    method,
    baseCurrency,
    calculatedAt: new Date(calculatedAt.getTime()),

    grossDividendsBaseCurrency: sumNullable(
      convertedDividendRecords.map(({ grossDividendBaseCurrency }) => {
        return grossDividendBaseCurrency;
      })
    ),

    totalWithholdingTaxBaseCurrency: sumNullable(
      convertedDividendRecords.map(({ withholdingTaxBaseCurrency }) => {
        return withholdingTaxBaseCurrency;
      })
    ),

    netDividendsBaseCurrency: sumNullable(
      convertedDividendRecords.map(({ netDividendBaseCurrency }) => {
        return netDividendBaseCurrency;
      })
    ),

    grossProceedsBaseCurrency,
    grossCostBasisBaseCurrency,
    grossRealizedGainBaseCurrency,
    totalActivityFeesBaseCurrency,
    realizedGainAfterActivityFeesBaseCurrency,

    dividendCount: convertedDividendRecords.length,
    disposalCount: convertedRealizedGains.length,

    currencySummaries: buildCurrencySummaries({
      dividendRecords: yearlyDividendRecords,
      realizedGains: yearlyRealizedGains
    }),

    dividendRecords: convertedDividendRecords,
    realizedGains: convertedRealizedGains,

    isComplete: warnings.length === 0 && errors.length === 0,

    warnings,
    errors
  };
}

function buildCurrencySummaries({
  dividendRecords,
  realizedGains
}: {
  dividendRecords: readonly DividendRecord[];
  realizedGains: readonly YearlyRealizedGainSource[];
}): YearlyTaxCurrencySummary[] {
  const summaries = new Map<string | null, YearlyTaxCurrencySummary>();

  const getSummary = (currency: string | null): YearlyTaxCurrencySummary => {
    const existing = summaries.get(currency);

    if (existing) {
      return existing;
    }

    const summary: YearlyTaxCurrencySummary = {
      currency,

      totalGrossDividends: new Big(0),
      totalWithholdingTax: new Big(0),
      totalNetDividends: new Big(0),

      grossProceeds: new Big(0),
      grossCostBasis: new Big(0),
      grossRealizedGain: new Big(0),

      allocatedFees: new Big(0),
      realizedGainAfterActivityFees: new Big(0)
    };

    summaries.set(currency, summary);

    return summary;
  };

  for (const record of dividendRecords) {
    const summary = getSummary(record.transactionCurrency);

    summary.totalGrossDividends = summary.totalGrossDividends.plus(
      record.grossDividend
    );

    if (record.withholdingTax === null) {
      summary.totalWithholdingTax = null;
    } else if (summary.totalWithholdingTax !== null) {
      summary.totalWithholdingTax = summary.totalWithholdingTax.plus(
        record.withholdingTax
      );
    }

    if (record.netDividend === null) {
      summary.totalNetDividends = null;
    } else if (summary.totalNetDividends !== null) {
      summary.totalNetDividends = summary.totalNetDividends.plus(
        record.netDividend
      );
    }
  }

  for (const record of realizedGains) {
    const summary = getSummary(record.transactionCurrency);

    summary.grossProceeds = summary.grossProceeds.plus(record.grossProceeds);

    summary.grossCostBasis = summary.grossCostBasis.plus(record.grossCostBasis);

    summary.grossRealizedGain = summary.grossRealizedGain.plus(
      record.grossRealizedGain
    );

    summary.allocatedFees = summary.allocatedFees
      .plus(record.allocatedAcquisitionFees)
      .plus(record.allocatedSellFees);

    summary.realizedGainAfterActivityFees =
      summary.realizedGainAfterActivityFees.plus(
        record.realizedGainAfterActivityFees
      );
  }

  return [...summaries.values()].sort((left, right) => {
    if (left.currency === right.currency) {
      return 0;
    }

    if (left.currency === null) {
      return 1;
    }

    if (right.currency === null) {
      return -1;
    }

    return left.currency.localeCompare(right.currency);
  });
}

function isInUtcYear(date: Date, year: number): boolean {
  return date.getUTCFullYear() === year;
}

function multiplyOrNull(value: Big | null, rate: Big | null): Big | null {
  if (value === null || rate === null) {
    return null;
  }

  return value.times(rate);
}

function sumNullable(values: readonly (Big | null)[]): Big | null {
  if (values.some((value) => value === null)) {
    return null;
  }

  return values.reduce<Big>(
    (total, value) => total.plus(value as Big),
    new Big(0)
  );
}
