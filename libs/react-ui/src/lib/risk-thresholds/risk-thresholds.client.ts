import type { AuthenticatedFetch } from '../data/api-request';
import { requestApi } from '../data/api-request';
import type { RiskApiEnvelope } from '../risk-dashboard/risk-dashboard.client';
import { RiskApiError } from '../risk-dashboard/risk-dashboard.client';

export type ThresholdShape = 'band' | 'ceiling';

export interface RiskThresholdValues {
  max?: number;
  min?: number;
  redMax?: number;
  redMin?: number;
}

export interface RiskThresholdItem {
  defaults: RiskThresholdValues;
  isActive: boolean;
  isCustomized: boolean;
  name: string;
  ruleKey: string;
  shape: ThresholdShape;
  thresholds: RiskThresholdValues;
}

export interface UpdateRiskThresholdBody {
  isActive?: boolean;
  thresholds?: RiskThresholdValues;
}

const GENERIC_THRESHOLDS_ERROR_MESSAGE =
  'Could not save the threshold. Please try again.';

// The 3 codes risk-threshold.mapper.ts#validateThresholdUpdateInput sends
// deliberately safe, user-actionable message text for - same allowlist
// idiom as what-if-simulator.client.ts's SAFE_TO_DISPLAY_ERROR_CODES.
// RISK_FORBIDDEN (risk.controller.ts's
// rejectIfNoSettingsPermission/rejectIfImpersonating) is included too, so
// a DEMO user (portfolio:read but not updateUserSettings) sees why their
// save/reset was rejected instead of a generic failure message.
const SAFE_TO_DISPLAY_ERROR_CODES = new Set([
  'RISK_FORBIDDEN',
  'RISK_RULE_NOT_FOUND',
  'RISK_THRESHOLD_INVALID_ORDER',
  'RISK_THRESHOLD_OUT_OF_RANGE'
]);

function isRiskThresholdItem(data: unknown): data is RiskThresholdItem {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const value = data as RiskThresholdItem;

  return (
    typeof value.ruleKey === 'string' &&
    typeof value.name === 'string' &&
    (value.shape === 'band' || value.shape === 'ceiling') &&
    typeof value.isActive === 'boolean' &&
    typeof value.isCustomized === 'boolean' &&
    typeof value.defaults === 'object' &&
    typeof value.thresholds === 'object'
  );
}

function isRiskThresholdList(data: unknown): data is RiskThresholdItem[] {
  return Array.isArray(data) && data.every(isRiskThresholdItem);
}

export async function fetchRiskThresholds(
  request: AuthenticatedFetch,
  signal?: AbortSignal
): Promise<RiskThresholdItem[]> {
  const data = await requestApi<unknown>(
    request,
    '/api/v1/risk/thresholds',
    signal
  );

  if (!isRiskThresholdList(data)) {
    throw new RiskApiError(GENERIC_THRESHOLDS_ERROR_MESSAGE);
  }

  return data;
}

// requestApi (data/api-request.ts) is GET-only, so PUT/DELETE here use the
// host's AuthenticatedFetch directly - same split as
// target-allocation.client.ts's sendTargetAllocationRequest.
async function sendThresholdRequest(
  request: AuthenticatedFetch,
  ruleKey: string,
  method: 'DELETE' | 'PUT',
  body?: unknown
): Promise<RiskThresholdItem> {
  const response = await request(`/api/v1/risk/thresholds/${ruleKey}`, {
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
    throw new RiskApiError(GENERIC_THRESHOLDS_ERROR_MESSAGE);
  }

  if (envelope.error) {
    throw new RiskApiError(
      SAFE_TO_DISPLAY_ERROR_CODES.has(envelope.error.code)
        ? envelope.error.message
        : GENERIC_THRESHOLDS_ERROR_MESSAGE
    );
  }

  if (!isRiskThresholdItem(envelope.data)) {
    throw new RiskApiError(GENERIC_THRESHOLDS_ERROR_MESSAGE);
  }

  return envelope.data;
}

export async function updateRiskThreshold(
  request: AuthenticatedFetch,
  ruleKey: string,
  body: UpdateRiskThresholdBody
): Promise<RiskThresholdItem> {
  return sendThresholdRequest(request, ruleKey, 'PUT', body);
}

export async function resetRiskThreshold(
  request: AuthenticatedFetch,
  ruleKey: string
): Promise<RiskThresholdItem> {
  return sendThresholdRequest(request, ruleKey, 'DELETE');
}
