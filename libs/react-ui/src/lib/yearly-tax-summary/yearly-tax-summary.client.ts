import type { AuthenticatedFetch } from '../data/api-request';
import { ApiRequestError, requestApi } from '../data/api-request';

/** These methods are supported by the existing TaxService calculation engine. */
export type YearlyCostBasisMethod = 'FIFO' | 'AVERAGE_COST';

export interface YearlySummarySelection {
  method: YearlyCostBasisMethod;
  signal: AbortSignal;
  year: number;
}

export type YearlySummaryLoader = (
  selection: YearlySummarySelection
) => Promise<unknown>;

export interface YearlySummaryDiagnostic {
  code: string;
  message: string;
  affectedSellActivityIds?: string[];
  excludedActivityIds?: string[];
  sellActivityIds?: string[];
  sourceActivityIds?: string[];
}

export interface YearlyCurrencySummary {
  allocatedFees: string;
  currency: string | null;
  grossCostBasis: string;
  grossProceeds: string;
  grossRealizedGain: string;
  realizedGainAfterActivityFees: string;
  totalGrossDividends: string;
  totalNetDividends: string | null;
  totalWithholdingTax: string | null;
}

/** Agreed HTTP representation of TaxService.getYearlySummary(). Big and Date
 * values are serialized by the backend; React does not recalculate them.
 */
export interface YearlyTaxSummaryData {
  baseCurrency: string;
  calculatedAt: string;
  currencySummaries: YearlyCurrencySummary[];
  dividendCount: number;
  dividendRecords: unknown[];
  disposalCount: number;
  errors: YearlySummaryDiagnostic[];
  grossCostBasisBaseCurrency: string | null;
  grossDividendsBaseCurrency: string | null;
  grossProceedsBaseCurrency: string | null;
  grossRealizedGainBaseCurrency: string | null;
  isComplete: boolean;
  method: YearlyCostBasisMethod;
  netDividendsBaseCurrency: string | null;
  realizedGainAfterActivityFeesBaseCurrency: string | null;
  realizedGains: unknown[];
  totalActivityFeesBaseCurrency: string | null;
  totalWithholdingTaxBaseCurrency: string | null;
  warnings: YearlySummaryDiagnostic[];
  year: number;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isDecimal = (value: unknown): value is string =>
  typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value);

const isNullableDecimal = (value: unknown): value is string | null =>
  value === null || isDecimal(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

function isDiagnostic(value: unknown): value is YearlySummaryDiagnostic {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.code === 'string' &&
    value.code.length > 0 &&
    typeof value.message === 'string' &&
    [
      'sourceActivityIds',
      'sellActivityIds',
      'excludedActivityIds',
      'affectedSellActivityIds'
    ].every((key) => value[key] === undefined || isStringArray(value[key]))
  );
}

function isCurrencySummary(value: unknown): value is YearlyCurrencySummary {
  if (!isObject(value)) {
    return false;
  }

  return (
    (value.currency === null || typeof value.currency === 'string') &&
    isDecimal(value.totalGrossDividends) &&
    isNullableDecimal(value.totalWithholdingTax) &&
    isNullableDecimal(value.totalNetDividends) &&
    isDecimal(value.grossProceeds) &&
    isDecimal(value.grossCostBasis) &&
    isDecimal(value.grossRealizedGain) &&
    isDecimal(value.allocatedFees) &&
    isDecimal(value.realizedGainAfterActivityFees)
  );
}

/** Reject unapproved API shapes, numbers, and lost null values. */
export function parseYearlyTaxSummary(
  input: unknown,
  expectedYear: number,
  expectedMethod: YearlyCostBasisMethod
): YearlyTaxSummaryData {
  if (!isObject(input)) {
    return invalidResponse();
  }

  const baseTotals = [
    'grossDividendsBaseCurrency',
    'totalWithholdingTaxBaseCurrency',
    'netDividendsBaseCurrency',
    'grossProceedsBaseCurrency',
    'grossCostBasisBaseCurrency',
    'grossRealizedGainBaseCurrency',
    'totalActivityFeesBaseCurrency',
    'realizedGainAfterActivityFeesBaseCurrency'
  ];

  if (
    input.year !== expectedYear ||
    input.method !== expectedMethod ||
    typeof input.baseCurrency !== 'string' ||
    input.baseCurrency.length === 0 ||
    typeof input.calculatedAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T/.test(input.calculatedAt) ||
    typeof input.isComplete !== 'boolean' ||
    !Number.isSafeInteger(input.dividendCount) ||
    (input.dividendCount as number) < 0 ||
    !Number.isSafeInteger(input.disposalCount) ||
    (input.disposalCount as number) < 0 ||
    !baseTotals.every((field) => isNullableDecimal(input[field])) ||
    !Array.isArray(input.currencySummaries) ||
    !input.currencySummaries.every(isCurrencySummary) ||
    !Array.isArray(input.warnings) ||
    !input.warnings.every(isDiagnostic) ||
    !Array.isArray(input.errors) ||
    !input.errors.every(isDiagnostic) ||
    !Array.isArray(input.dividendRecords) ||
    !Array.isArray(input.realizedGains)
  ) {
    return invalidResponse();
  }

  return input as unknown as YearlyTaxSummaryData;
}

function invalidResponse(): never {
  throw new ApiRequestError(
    200,
    'INVALID_RESPONSE',
    'The yearly Tax summary response did not match its expected contract'
  );
}

/** Uses the agreed Tax HTTP route; the host supplies authenticated fetch. */
export function createYearlyTaxSummaryLoader(
  request: AuthenticatedFetch
): YearlySummaryLoader {
  return ({ method, signal, year }) =>
    requestApi<unknown>(
      request,
      `/api/v1/tax/yearly-summary?year=${year}&method=${method}`,
      signal
    );
}
