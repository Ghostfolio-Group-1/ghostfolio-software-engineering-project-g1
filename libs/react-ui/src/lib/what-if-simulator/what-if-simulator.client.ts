import type { RiskApiEnvelope } from '../risk-dashboard/risk-dashboard.client';
import { RiskApiError } from '../risk-dashboard/risk-dashboard.client';
import type { RunWhatIfRequest } from './what-if-form.model';
import type { WhatIfResultSummary } from './what-if-result-panel';

export type PostJson = (
  url: string,
  body: unknown
) => Promise<RiskApiEnvelope<unknown>>;

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
    throw new RiskApiError(response.error.message);
  }

  return response.data as WhatIfResultSummary;
}
