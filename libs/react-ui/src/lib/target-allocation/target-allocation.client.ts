import type { AuthenticatedFetch } from '../data/api-request';
import { requestApi } from '../data/api-request';
import type { RiskApiEnvelope } from '../risk-dashboard/risk-dashboard.client';
import { RiskApiError } from '../risk-dashboard/risk-dashboard.client';
import type { RiskSeverity } from '../risk-indicator/risk-indicator';

export interface TargetAllocationTarget {
  key: string;
  percentage: number;
}

export interface TargetAllocationBucket {
  actual: number;
  deviation: number;
  key: string;
  severity: RiskSeverity;
  target: number;
}

export interface TargetAllocationData {
  buckets: TargetAllocationBucket[];
  groupBy: string | null;
  isSet: boolean;
  targets: TargetAllocationTarget[];
}

const GENERIC_TARGET_ALLOCATION_ERROR_MESSAGE =
  'Could not save the target allocation. Please try again.';

// The 3 codes target-allocation.mapper.ts#validateTargetAllocationInput
// sends deliberately safe, user-actionable message text for - same
// allowlist idiom as what-if-simulator.client.ts's
// SAFE_TO_DISPLAY_ERROR_CODES.
const SAFE_TO_DISPLAY_ERROR_CODES = new Set([
  'RISK_TARGET_DUPLICATE_KEY',
  'RISK_TARGET_INVALID_KEY',
  'RISK_TARGET_INVALID_SUM'
]);

function isTargetAllocationData(data: unknown): data is TargetAllocationData {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const value = data as TargetAllocationData;

  return (
    Array.isArray(value.buckets) &&
    (value.groupBy === null || typeof value.groupBy === 'string') &&
    typeof value.isSet === 'boolean' &&
    Array.isArray(value.targets)
  );
}

export async function fetchTargetAllocation(
  request: AuthenticatedFetch,
  signal?: AbortSignal
): Promise<TargetAllocationData> {
  const data = await requestApi<unknown>(
    request,
    '/api/v1/risk/target-allocation',
    signal
  );

  if (!isTargetAllocationData(data)) {
    throw new RiskApiError(GENERIC_TARGET_ALLOCATION_ERROR_MESSAGE);
  }

  return data;
}

// requestApi (data/api-request.ts) is GET-only, so PUT/DELETE here use the
// host's AuthenticatedFetch directly - same split as
// what-if-simulator.client.ts's createWhatIfPostJson/runWhatIf.
async function sendTargetAllocationRequest(
  request: AuthenticatedFetch,
  method: 'DELETE' | 'PUT',
  body?: unknown
): Promise<TargetAllocationData> {
  const response = await request('/api/v1/risk/target-allocation', {
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    method
  });

  let envelope: RiskApiEnvelope<unknown>;

  try {
    envelope = (await response.json()) as RiskApiEnvelope<unknown>;
  } catch {
    throw new RiskApiError(GENERIC_TARGET_ALLOCATION_ERROR_MESSAGE);
  }

  if (envelope.error) {
    throw new RiskApiError(
      SAFE_TO_DISPLAY_ERROR_CODES.has(envelope.error.code)
        ? envelope.error.message
        : GENERIC_TARGET_ALLOCATION_ERROR_MESSAGE
    );
  }

  if (!isTargetAllocationData(envelope.data)) {
    throw new RiskApiError(GENERIC_TARGET_ALLOCATION_ERROR_MESSAGE);
  }

  return envelope.data;
}

export async function updateTargetAllocation(
  request: AuthenticatedFetch,
  body: { groupBy: string; targets: TargetAllocationTarget[] }
): Promise<TargetAllocationData> {
  return sendTargetAllocationRequest(request, 'PUT', body);
}

export async function clearTargetAllocation(
  request: AuthenticatedFetch
): Promise<TargetAllocationData> {
  return sendTargetAllocationRequest(request, 'DELETE');
}
