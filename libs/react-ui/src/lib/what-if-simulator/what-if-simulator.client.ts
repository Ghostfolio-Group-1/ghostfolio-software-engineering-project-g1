import type { AuthenticatedFetch } from '../data/api-request';
import { requestApi } from '../data/api-request';
import type { RiskApiEnvelope } from '../risk-dashboard/risk-dashboard.client';
import { RiskApiError } from '../risk-dashboard/risk-dashboard.client';
import type {
  RunWhatIfRequest,
  WhatIfHoldingOption
} from './what-if-form.model';
import type { WhatIfResultSummary } from './what-if-result-panel';

export type PostJson = (
  url: string,
  body: unknown
) => Promise<RiskApiEnvelope<unknown>>;

const GENERIC_WHAT_IF_ERROR_MESSAGE =
  'Could not run the simulation. Please try again.';

// The only two codes risk.controller.ts#postWhatIf deliberately sends
// safe, user-actionable message text for (see RiskApiEnvelope's module
// comment on risk-dashboard.client.ts). Any other code - including ones
// that don't exist yet - gets the generic fallback instead of displaying
// server text that was never written with an end user in mind.
const SAFE_TO_DISPLAY_ERROR_CODES = new Set([
  'RISK_WHATIF_HOLDING_NOT_FOUND',
  'RISK_WHATIF_INVALID_DROP'
]);

function isWhatIfResultSummary(data: unknown): data is WhatIfResultSummary {
  return (
    typeof data === 'object' &&
    data !== null &&
    'holding' in data &&
    'portfolio' in data &&
    'scenario' in data &&
    'score' in data
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
  dataSource: string;
  name: string;
  symbol: string;
}

// The holdings the user can actually pick a scenario target from (issue
// #187 review: a free-text symbol let the user shock a holding they don't
// own, or the wrong data source for one they do). GET /portfolio/holdings
// is outside the risk feature, but requestApi's envelope handling (401,
// missing data, ...) is the same for every GET route regardless of which
// feature owns it.
export async function fetchWhatIfHoldingOptions(
  request: AuthenticatedFetch
): Promise<WhatIfHoldingOption[]> {
  const { holdings } = await requestApi<{
    holdings: PortfolioHoldingApiPosition[];
  }>(request, '/api/v1/portfolio/holdings');

  return holdings.map(({ dataSource, name, symbol }) => ({
    dataSource,
    name,
    symbol
  }));
}
