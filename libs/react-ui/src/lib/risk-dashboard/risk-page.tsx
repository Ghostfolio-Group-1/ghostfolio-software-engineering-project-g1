import type { AuthenticatedFetch } from '../data/api-request';
import { RiskWarningsPage } from '../risk-warnings/risk-warnings-page';
import { designTokens, px } from '../tokens/design-tokens';
import { WhatIfSimulatorPage } from '../what-if-simulator/what-if-simulator-page';
import { RiskDashboardPage } from './risk-dashboard-page';

export interface RiskPageProps {
  /** The host's authenticated fetch (see data/api-request). */
  request: AuthenticatedFetch;
}

// Issue #261: mounts the What-if simulator and the Warnings list alongside
// the already-mounted Risk dashboard, through the same gf-react-host
// (GfRiskPageComponent renders this one component rather than
// RiskDashboardPage directly). Each section owns its own data
// fetching/state - this is purely layout.
export function RiskPage({ request }: RiskPageProps) {
  return (
    <div>
      <RiskDashboardPage request={request} />
      <div style={{ marginTop: px(designTokens.spacing.lg) }}>
        <RiskWarningsPage request={request} />
      </div>
      <div style={{ marginTop: px(designTokens.spacing.lg) }}>
        <WhatIfSimulatorPage request={request} />
      </div>
    </div>
  );
}
