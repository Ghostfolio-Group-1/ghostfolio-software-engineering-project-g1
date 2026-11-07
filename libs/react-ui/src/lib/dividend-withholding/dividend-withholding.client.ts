import type { AuthenticatedFetch } from '../data/api-request';
import { ApiRequestError, requestApi } from '../data/api-request';
import type { DividendWithholdingViewRecord } from './dividend-withholding-table';

export interface TaxDividendsData {
  records: DividendWithholdingViewRecord[];
}

/** Matches the required YYYY parameter of the proposed Tax API contract. */
export function isValidDividendYear(year: number): boolean {
  return Number.isInteger(year) && year >= 1970 && year <= 2100;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isDecimalString = (value: unknown): value is string =>
  typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value);

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

function isDividendRecord(
  value: unknown
): value is DividendWithholdingViewRecord {
  if (!isObject(value)) {
    return false;
  }

  return (
    isNullableString(value.accountId) &&
    isDecimalString(value.activityFee) &&
    typeof value.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}T/.test(value.date) &&
    isDecimalString(value.grossDividend) &&
    (value.netDividend === null || isDecimalString(value.netDividend)) &&
    typeof value.sourceActivityId === 'string' &&
    value.sourceActivityId.length > 0 &&
    typeof value.symbolProfileId === 'string' &&
    value.symbolProfileId.length > 0 &&
    isNullableString(value.transactionCurrency) &&
    (value.withholdingTax === null || isDecimalString(value.withholdingTax))
  );
}

/**
 * Reads authoritative dividend records. The Angular host supplies its
 * authenticated request adapter; this client never reads auth tokens.
 * No numeric conversion, derived net amount or timezone conversion occurs.
 */
export async function fetchDividendWithholding(
  request: AuthenticatedFetch,
  year: number,
  signal?: AbortSignal
): Promise<TaxDividendsData> {
  if (!isValidDividendYear(year)) {
    throw new Error(
      'An integer UTC calendar year between 1970 and 2100 is required'
    );
  }

  const data = await requestApi<unknown>(
    request,
    `/api/v1/tax/dividends?year=${year}`,
    signal
  );

  if (!isObject(data) || !Array.isArray(data.records)) {
    throw new ApiRequestError(
      200,
      'INVALID_RESPONSE',
      'The dividend records response was invalid'
    );
  }

  const records = data.records as unknown[];

  if (!records.every(isDividendRecord)) {
    throw new ApiRequestError(
      200,
      'INVALID_RESPONSE',
      'The dividend records response was invalid'
    );
  }

  return { records };
}
