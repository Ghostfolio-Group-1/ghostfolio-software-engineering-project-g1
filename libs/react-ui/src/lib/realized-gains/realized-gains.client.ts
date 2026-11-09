import type { AuthenticatedFetch } from '../data/api-request';
import { ApiRequestError, requestApi } from '../data/api-request';

export type RealizedGainsMethod = 'FIFO' | 'AVERAGE_COST';

export interface RealizedGainSale {
  sellActivityId: string;
  sellDate: string;
  currency: string | null;
  sellQuantity: string;
  matchedQuantity: string;
  grossProceeds: string;
  grossCostBasis: string;
  grossRealizedGain: string;
  allocatedAcquisitionFees: string;
  sellFee: string;
  allocatedSellFee: string;
  realizedGainAfterActivityFees: string;
}

export interface FifoGainMatch {
  lotId: string;
  buyActivityId: string;
  sellActivityId: string;
  matchedQuantity: string;
  grossAcquisitionValue: string;
  grossProceeds: string;
  grossRealizedGain: string;
  buyFeeAllocated: string;
  sellFeeAllocated: string;
  realizedGainAfterActivityFees: string;
}

export interface FifoGainSale extends RealizedGainSale {
  allocatedBuyFees: string;
  matches: FifoGainMatch[];
}

export interface AverageCostPool {
  quantity: string;
  grossCost: string;
  acquisitionFeePool: string;
}

export interface AverageCostGainSale extends RealizedGainSale {
  poolBefore: AverageCostPool;
  poolAfter: AverageCostPool;
}

export interface RealizedGainsDiagnostic {
  code: 'TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY';
  message: string;
  affectedSellActivityIds: string[];
  excludedActivityIds: string[];
}

interface Completeness {
  diagnostics?: RealizedGainsDiagnostic[];
  isComplete?: false;
}

export type RealizedGainsData = (
  | { method: 'FIFO'; sales: FifoGainSale[] }
  | { method: 'AVERAGE_COST'; sales: AverageCostGainSale[] }
) &
  Completeness;

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

// Match the backend's JSON schema: only plain decimal text, never JSON numbers.
const isDecimalString = (value: unknown): value is string =>
  typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

function isGainSale(value: unknown): value is RealizedGainSale {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.sellActivityId === 'string' &&
    value.sellActivityId.length > 0 &&
    typeof value.sellDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}T/.test(value.sellDate) &&
    isNullableString(value.currency) &&
    isDecimalString(value.sellQuantity) &&
    isDecimalString(value.matchedQuantity) &&
    isDecimalString(value.grossProceeds) &&
    isDecimalString(value.grossCostBasis) &&
    isDecimalString(value.grossRealizedGain) &&
    isDecimalString(value.allocatedAcquisitionFees) &&
    isDecimalString(value.sellFee) &&
    isDecimalString(value.allocatedSellFee) &&
    isDecimalString(value.realizedGainAfterActivityFees)
  );
}

function isFifoMatch(value: unknown): value is FifoGainMatch {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.lotId === 'string' &&
    value.lotId.length > 0 &&
    typeof value.buyActivityId === 'string' &&
    value.buyActivityId.length > 0 &&
    typeof value.sellActivityId === 'string' &&
    value.sellActivityId.length > 0 &&
    isDecimalString(value.matchedQuantity) &&
    isDecimalString(value.grossAcquisitionValue) &&
    isDecimalString(value.grossProceeds) &&
    isDecimalString(value.grossRealizedGain) &&
    isDecimalString(value.buyFeeAllocated) &&
    isDecimalString(value.sellFeeAllocated) &&
    isDecimalString(value.realizedGainAfterActivityFees)
  );
}

function isAverageCostPool(value: unknown): value is AverageCostPool {
  return (
    isObject(value) &&
    isDecimalString(value.quantity) &&
    isDecimalString(value.grossCost) &&
    isDecimalString(value.acquisitionFeePool)
  );
}

function isDiagnostic(value: unknown): value is RealizedGainsDiagnostic {
  return (
    isObject(value) &&
    value.code === 'TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY' &&
    typeof value.message === 'string' &&
    value.message.length > 0 &&
    isStringArray(value.affectedSellActivityIds) &&
    isStringArray(value.excludedActivityIds)
  );
}

function isRealizedGainsData(
  value: unknown,
  method: RealizedGainsMethod
): value is RealizedGainsData {
  if (
    !isObject(value) ||
    value.method !== method ||
    !Array.isArray(value.sales) ||
    (value.isComplete !== undefined && value.isComplete !== false) ||
    (value.diagnostics === undefined) !== (value.isComplete === undefined) ||
    (value.diagnostics !== undefined &&
      (!Array.isArray(value.diagnostics) ||
        value.diagnostics.length === 0 ||
        !value.diagnostics.every(isDiagnostic)))
  ) {
    return false;
  }

  return value.sales.every((sale: unknown) => {
    if (!isGainSale(sale)) {
      return false;
    }

    const fields = sale as unknown as Record<string, unknown>;
    if (method === 'FIFO') {
      return (
        isDecimalString(fields.allocatedBuyFees) &&
        Array.isArray(fields.matches) &&
        fields.matches.every(isFifoMatch)
      );
    }

    return (
      isAverageCostPool(fields.poolBefore) &&
      isAverageCostPool(fields.poolAfter)
    );
  });
}

/**
 * The host supplies the authenticated adapter; never use raw fetch or parse
 * monetary amounts into JS numbers. Method selection is server-authoritative.
 */
export async function fetchRealizedGains(
  request: AuthenticatedFetch,
  method: RealizedGainsMethod,
  signal?: AbortSignal
): Promise<RealizedGainsData> {
  if (method !== 'FIFO' && method !== 'AVERAGE_COST') {
    throw new Error('Unsupported realized-gains calculation method');
  }

  const data = await requestApi<unknown>(
    request,
    `/api/v1/tax/realized-gains?method=${method}`,
    signal
  );

  if (!isRealizedGainsData(data, method)) {
    throw new ApiRequestError(
      200,
      'INVALID_RESPONSE',
      'The realized-gains response was invalid'
    );
  }

  return data;
}
