import { useEffect, useState } from 'react';

import type { AuthenticatedFetch } from '../data/api-request';
import { RiskThresholdsPage } from '../risk-thresholds/risk-thresholds-page';
import { useRiskPalette } from '../risk-ui/risk-palette';
import { RiskWarningsPage } from '../risk-warnings/risk-warnings-page';
import { TargetAllocationPage } from '../target-allocation/target-allocation-page';
import { designTokens, px } from '../tokens/design-tokens';
import { WhatIfSimulatorPage } from '../what-if-simulator/what-if-simulator-page';
import { RiskDashboardPage } from './risk-dashboard-page';

export interface RiskPageProps {
  /** The host's authenticated fetch (see data/api-request). */
  request: AuthenticatedFetch;
}

// A breakpoint at 1024px, matching the design spec's desktop threshold.
// Read once on mount and on resize - there's nothing here that needs to
// be correct before first paint (no SSR for this React island, it's
// always mounted client-side into an existing Angular page).
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 1024
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    function update() {
      setIsDesktop(window.innerWidth >= 1024);
    }

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return isDesktop;
}

// Issue #261 (mounting), redesigned as a page header + responsive grid in
// issue #<ISSUE_NUMBER>: Thresholds on the left, Target allocation then
// Stress test stacked on the right, two columns on desktop and one column
// below 1024px. Each section still owns its own data fetching/state -
// this remains purely layout. No global "Refresh"/"Last updated" control
// is added here: that would mean a new piece of state coordinating five
// independently-fetching *Page components, which is a data-flow change
// beyond this task's "layout/styling only" scope (noted as a limitation
// in the PR).
export function RiskPage({ request }: RiskPageProps) {
  const palette = useRiskPalette();
  const isDesktop = useIsDesktop();

  return (
    <div
      style={{
        backgroundColor: 'transparent',
        color: palette.textPrimary,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: designTokens.fontFamily,
        gap: px(designTokens.spacing.lg)
      }}
    >
      <header>
        <h1 style={{ fontSize: px(designTokens.fontSize.xl), margin: 0 }}>
          Risk
        </h1>
        <p
          style={{
            color: palette.textMuted,
            margin: `${px(designTokens.spacing.xs)} 0 0`
          }}
        >
          Monitor concentration, cash allocation, and stress scenarios.
        </p>
      </header>

      <RiskDashboardPage request={request} />
      <RiskWarningsPage request={request} />

      <div
        style={{
          display: 'grid',
          gap: px(designTokens.spacing.lg),
          gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr'
        }}
      >
        <RiskThresholdsPage request={request} />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: px(designTokens.spacing.lg)
          }}
        >
          <TargetAllocationPage request={request} />
          <WhatIfSimulatorPage request={request} />
        </div>
      </div>
    </div>
  );
}
