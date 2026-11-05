import type { ReactNode } from 'react';

import {
  DashboardCard,
  DashboardCardStatus
} from '../dashboard-card/dashboard-card';
import { LayoutShell } from '../layout-shell/layout-shell';
import { designTokens, px } from '../tokens/design-tokens';

export type DashboardSectionKey = 'charts' | 'risk' | 'tax';

export interface DashboardSectionView {
  content?: ReactNode;
  errorMessage?: string;
  onRetry?: () => void;
  status: DashboardCardStatus;
}

export type DashboardSectionViews = Record<
  DashboardSectionKey,
  DashboardSectionView
>;

export const DASHBOARD_SECTIONS: { key: DashboardSectionKey; title: string }[] =
  [
    { key: 'risk', title: 'Portfolio risk' },
    { key: 'tax', title: 'Tax' },
    { key: 'charts', title: 'Performance' }
  ];

const LOADING: DashboardSectionView = { status: 'loading' };

export interface DashboardPageProps {
  sections?: Partial<DashboardSectionViews>;
  title?: string;
}

// Unified Dashboard page shell (#68). One DashboardCard per section, so each
// section shows its own loading / error / empty state. Data loading from
// GET /api/v1/dashboard/overview is wired in the next step.
export function DashboardPage({
  sections = {},
  title = 'Portfolio overview'
}: DashboardPageProps) {
  return (
    <LayoutShell title={title}>
      <div
        data-testid="dashboard-grid"
        style={{
          display: 'grid',
          gap: px(designTokens.spacing.lg),
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))'
        }}
      >
        {DASHBOARD_SECTIONS.map(({ key, title: sectionTitle }) => {
          const view = sections[key] ?? LOADING;

          return (
            <DashboardCard
              errorMessage={view.errorMessage}
              key={key}
              onRetry={view.onRetry}
              status={view.status}
              title={sectionTitle}
            >
              {view.content}
            </DashboardCard>
          );
        })}
      </div>
    </LayoutShell>
  );
}
