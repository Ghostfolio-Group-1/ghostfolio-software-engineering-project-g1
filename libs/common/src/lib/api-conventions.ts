/**
 * Shared API conventions for the risk, tax, charts and dashboard APIs.
 * Routes follow /api/v1/<feature>/... and every endpoint returns ApiResponse<T>.
 */

export type ApiFeature = 'charts' | 'dashboard' | 'risk' | 'tax';

/** ISO 8601 date or date-time, e.g. 2026-10-06 or 2026-10-06T14:30:00.000Z */
export type IsoDateString = string;

/** Percentage as a decimal fraction: 0.125 means 12.5 % */
export type DecimalPercentage = number;

/** Money is never a formatted string */
export interface MoneyAmount {
  amount: number;
  currency: string;
}

/** Feature-prefixed error code, e.g. TAX_LOT_NOT_FOUND */
export type ApiErrorCode = `${Uppercase<ApiFeature>}_${string}`;

export interface ApiError {
  code: ApiErrorCode;
  message: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

export type ApiMeta = Partial<PaginationMeta>;

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
  meta: ApiMeta;
}

export function createApiErrorCode(
  feature: ApiFeature,
  name: string
): ApiErrorCode {
  return `${feature.toUpperCase()}_${name}` as ApiErrorCode;
}

export function createSuccessResponse<T>(
  data: T,
  meta: ApiMeta = {}
): ApiResponse<T> {
  return { data, error: null, meta };
}

export function createErrorResponse(
  code: ApiErrorCode,
  message: string
): ApiResponse<never> {
  return { data: null, error: { code, message }, meta: {} };
}
