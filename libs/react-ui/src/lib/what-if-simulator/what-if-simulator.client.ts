import type { AuthenticatedFetch } from '../data/api-request';
import type { RiskApiEnvelope } from '../risk-dashboard/risk-dashboard.client';
import { RiskApiError } from '../risk-dashboard/risk-dashboard.client';
import type {
  RunWhatIfRequest,
  WhatIfHoldingOption
} from './what-if-form.model';
import type {
  WhatIfMoneyAmount,
  WhatIfResultSummary,
  WhatIfWarningSummary
} from './what-if-result-panel';

export type PostJson = (
  url: string,
  body: unknown
) => Promise<RiskApiEnvelope<unknown>>;

const GENERIC_WHAT_IF_ERROR_MESSAGE =
  'Could not run the simulation. Please try again.';

const GENERIC_HOLDINGS_ERROR_MESSAGE = 'Could not load your holdings.';

// The only two codes risk.controller.ts#postWhatIf deliberately sends
// safe, user-actionable message text for (see RiskApiEnvelope's module
// comment on risk-dashboard.client.ts). Any other code - including ones
// that don't exist yet - gets the generic fallback instead of displaying
// server text that was never written with an end user in mind.
const SAFE_TO_DISPLAY_ERROR_CODES = new Set([
  'RISK_WHATIF_HOLDING_NOT_FOUND',
  'RISK_WHATIF_INVALID_DROP'
]);

function isMoneyAmount(value: unknown): value is WhatIfMoneyAmount {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as WhatIfMoneyAmount).amount === 'number' &&
    typeof (value as WhatIfMoneyAmount).currency === 'string'
  );
}

function isWarningSummary(value: unknown): value is WhatIfWarningSummary {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const warning = value as WhatIfWarningSummary;

  return (
    typeof warning.actual === 'number' &&
    typeof warning.message === 'string' &&
    typeof warning.ruleKey === 'string' &&
    (warning.severity === 'RED' || warning.severity === 'YELLOW') &&
    typeof warning.subject === 'object' &&
    warning.subject !== null &&
    typeof warning.subject.type === 'string' &&
    typeof warning.subject.value === 'string' &&
    typeof warning.threshold === 'number'
  );
}

function isWarningSummaryArray(
  value: unknown
): value is WhatIfWarningSummary[] {
  return Array.isArray(value) && value.every(isWarningSummary);
}

// Checked field-by-field rather than just the four top-level keys, since a
// malformed nested value (e.g. a holding with no valueAfter) would
// otherwise reach WhatIfResultPanel and fail there instead of here.
function isWhatIfResultSummary(data: unknown): data is WhatIfResultSummary {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const result = data as WhatIfResultSummary;

  return (
    isWarningSummaryArray(result.changedWarnings) &&
    isWarningSummaryArray(result.newWarnings) &&
    isWarningSummaryArray(result.resolvedWarnings) &&
    typeof result.holding === 'object' &&
    result.holding !== null &&
    typeof result.holding.allocationAfter === 'number' &&
    typeof result.holding.allocationBefore === 'number' &&
    isMoneyAmount(result.holding.valueAfter) &&
    isMoneyAmount(result.holding.valueBefore) &&
    typeof result.portfolio === 'object' &&
    result.portfolio !== null &&
    isMoneyAmount(result.portfolio.change) &&
    typeof result.portfolio.changePercentage === 'number' &&
    isMoneyAmount(result.portfolio.valueAfter) &&
    isMoneyAmount(result.portfolio.valueBefore) &&
    typeof result.scenario === 'object' &&
    result.scenario !== null &&
    typeof result.scenario.dataSource === 'string' &&
    typeof result.scenario.dropPercentage === 'number' &&
    typeof result.scenario.name === 'string' &&
    typeof result.scenario.symbol === 'string' &&
    typeof result.score === 'object' &&
    result.score !== null &&
    (typeof result.score.after === 'number' || result.score.after === null) &&
    (typeof result.score.before === 'number' || result.score.before === null) &&
    (typeof result.score.change === 'number' || result.score.change === null)
  );
}

// Wiring for the what-if simulator (Tue Nov 17): POSTs to the already
// implemented apps/api/src/app/risk/risk.controller.ts#postWhatIf and maps
// its { data, error, meta } envelope onto WhatIfResultSummary. `postJson`
// is injected so tests can mock the HTTP layer, same convention as
// risk-dashboard.client.ts's `fetchJson`.
export async function runWhatIf(
  postJson: PostJson,
  request: RunWhatIfRequest
): Promise<WhatIfResultSummary> {
  const response = await postJson('/api/v1/risk/what-if', request);

  if (response.error) {
    throw new RiskApiError(
      SAFE_TO_DISPLAY_ERROR_CODES.has(response.error.code)
        ? response.error.message
        : GENERIC_WHAT_IF_ERROR_MESSAGE
    );
  }

  if (!isWhatIfResultSummary(response.data)) {
    throw new RiskApiError(GENERIC_WHAT_IF_ERROR_MESSAGE);
  }

  return response.data;
}

// The host's AuthenticatedFetch as a PostJson - requestApi (data/api-request)
// is GET-only, so this is what-if's own thin POST adapter; runWhatIf (above)
// still does all the envelope/error handling, this just gets the envelope
// off the wire.
export function createWhatIfPostJson(request: AuthenticatedFetch): PostJson {
  return async (url, body) => {
    const response = await request(url, {
      body: JSON.stringify(body),
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      method: 'POST'
    });

    try {
      return (await response.json()) as RiskApiEnvelope<unknown>;
    } catch {
      throw new RiskApiError(GENERIC_WHAT_IF_ERROR_MESSAGE);
    }
  };
}

interface PortfolioHoldingApiPosition {
  assetProfile: {
    dataSource: string;
    name: string;
    symbol: string;
  };
}

interface PortfolioHoldingsApiResponse {
  holdings: PortfolioHoldingApiPosition[];
}

function isPortfolioHoldingsApiResponse(
  body: unknown
): body is PortfolioHoldingsApiResponse {
  return (
    typeof body === 'object' &&
    body !== null &&
    Array.isArray((body as PortfolioHoldingsApiResponse).holdings)
  );
}

// The holdings the user can actually pick a scenario target from (issue
// #187 review: a free-text symbol let the user shock a holding they don't
// own, or the wrong data source for one they do). PortfolioController's
// GET /portfolio/holdings predates the { data, error, meta } convention
// (it answers with { holdings } directly, each holding's identity nested
// under assetProfile) and requestApi (data/api-request.ts) requires that
// envelope, so this is its own thin fetch rather than a requestApi call.
// holdingType=ACTIVE excludes fully sold-out holdings - there's nothing
// to shock in a position with no open quantity.
export async function fetchWhatIfHoldingOptions(
  request: AuthenticatedFetch,
  signal?: AbortSignal
): Promise<WhatIfHoldingOption[]> {
  const response = await request(
    '/api/v1/portfolio/holdings?holdingType=ACTIVE',
    {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      method: 'GET',
      signal
    }
  );

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new RiskApiError(GENERIC_HOLDINGS_ERROR_MESSAGE);
  }

  if (!response.ok || !isPortfolioHoldingsApiResponse(body)) {
    throw new RiskApiError(GENERIC_HOLDINGS_ERROR_MESSAGE);
  }

  return body.holdings.map(({ assetProfile }) => ({
    dataSource: assetProfile.dataSource,
    name: assetProfile.name,
    symbol: assetProfile.symbol
  }));
}
