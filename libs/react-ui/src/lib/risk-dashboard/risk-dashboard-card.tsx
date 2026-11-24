import type { ReactNode } from 'react';

import type { DashboardCardStatus } from '../dashboard-card/dashboard-card';
import { RiskIndicator } from '../risk-indicator/risk-indicator';
import type { RiskSeverity } from '../risk-indicator/risk-indicator';
import { useRiskPalette } from '../risk-ui/risk-palette';
import {
  EmptyState,
  ErrorState,
  LoadingSkeletonGroup,
  MetricTile,
  ProgressBar,
  RiskCard
} from '../risk-ui/risk-ui';
import { useTheme } from '../theme/theme-provider';
import { designTokens, px } from '../tokens/design-tokens';

export type { RiskSeverity };

// The only unavailableReason the API sends today (NO_ACTIVE_RULES) can mean
// an empty portfolio or every risk rule disabled - anything else falls back
// to a generic message rather than showing an internal code to the user.
const UNAVAILABLE_REASON_MESSAGE: Record<string, string> = {
  NO_ACTIVE_RULES:
    'No risk score is available because there are no active risk rules.'
};

function unavailableReasonMessage(unavailableReason: string): string {
  return (
    UNAVAILABLE_REASON_MESSAGE[unavailableReason] ??
    'Your risk score is not available right now.'
  );
}

export interface RiskDashboardCategorySummary {
  key: string;
  name: string;
  score: number | null;
  severity: RiskSeverity;
}

export interface RiskDashboardTopConcentration {
  name: string;
  percentage: number;
  severity: RiskSeverity;
}

export interface RiskDashboardSummary {
  categories: RiskDashboardCategorySummary[];
  grade: string | null;
  score: number | null;
  severity: RiskSeverity;
  topConcentration?: RiskDashboardTopConcentration | null;
  unavailableReason?: string | null;
}

export interface RiskDashboardCardProps {
  data?: RiskDashboardSummary;
  errorMessage?: string;
  onRetry?: () => void;
  status: DashboardCardStatus;
}

// Issue #26, now redesigned (issue #<ISSUE_NUMBER>) as the page's summary
// row: an overall score/grade/severity on the left, the top concentration
// and category scores as metric tiles on the right. score comes from GET
// /risk/score, topConcentration from GET /risk/concentration.
//
// This used to delegate loading/error/empty rendering to the shared
// DashboardCard. It renders its own states directly instead (same reasons
// as RiskThresholdsList/RiskWarningsList), while keeping every literal
// message, data-testid and aria-label the "ready" body already had -
// "Risk" still appears while loading (as this card's own title), "No
// holdings yet" for the empty state, and the default/overridden error
// message with a retry action.
export function RiskDashboardCard({
  data,
  errorMessage,
  onRetry,
  status
}: RiskDashboardCardProps) {
  return (
    <RiskCard>
      <h2 style={{ fontSize: px(designTokens.fontSize.lg), margin: 0 }}>
        Risk
      </h2>
      <div style={{ marginTop: px(designTokens.spacing.md) }}>
        {renderBody()}
      </div>
    </RiskCard>
  );

  function renderBody() {
    switch (status) {
      case 'loading':
        return (
          <div aria-busy="true" role="status">
            <LoadingSkeletonGroup rows={2} />
          </div>
        );
      case 'error':
        return (
          <ErrorState
            message={errorMessage ?? 'Risk data is unavailable'}
            onRetry={onRetry}
          />
        );
      case 'empty':
        return (
          <EmptyState message="No holdings yet - your risk score will appear once you add some." />
        );
      default:
        return data ? <RiskDashboardCardBody data={data} /> : null;
    }
  }
}

function RiskDashboardCardBody({
  data
}: {
  data: RiskDashboardSummary;
}): ReactNode {
  const theme = useTheme();
  const palette = useRiskPalette();

  return (
    <div>
      <div
        style={{
          alignItems: 'baseline',
          display: 'flex',
          flexWrap: 'wrap',
          gap: px(designTokens.spacing.sm)
        }}
      >
        <span
          data-testid="risk-score-value"
          style={{ fontSize: px(designTokens.fontSize.xl), fontWeight: 600 }}
        >
          {data.score ?? '—'}
        </span>
        {data.grade ? (
          <span
            style={{
              backgroundColor: palette.bgElevated,
              borderRadius: 999,
              color: theme.color.textMuted,
              padding: `${px(designTokens.spacing.xs)} ${px(designTokens.spacing.sm)}`
            }}
          >
            Grade {data.grade}
          </span>
        ) : null}
        <RiskIndicator label="Overall" severity={data.severity} />
      </div>

      {data.score === null && data.unavailableReason ? (
        <p
          data-testid="risk-score-unavailable-reason"
          style={{
            color: theme.color.textMuted,
            margin: `${px(designTokens.spacing.sm)} 0 0`
          }}
        >
          {unavailableReasonMessage(data.unavailableReason)}
        </p>
      ) : null}

      {data.topConcentration ? (
        <div style={{ margin: `${px(designTokens.spacing.sm)} 0 0` }}>
          <RiskIndicator
            label={`Top concentration: ${data.topConcentration.name} (${Math.round(data.topConcentration.percentage * 1000) / 10}%)`}
            severity={data.topConcentration.severity}
          />
        </div>
      ) : null}

      {data.categories.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gap: px(designTokens.spacing.sm),
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            marginTop: px(designTokens.spacing.md)
          }}
        >
          {data.categories.map((category) => (
            <MetricTile
              key={category.key}
              label={category.name}
              value={<RiskIndicator severity={category.severity} />}
            >
              <span>
                {category.score !== null
                  ? `${Math.round(category.score)} / 100`
                  : '—'}
              </span>
              {category.score !== null ? (
                <ProgressBar
                  severity={category.severity}
                  value={category.score}
                />
              ) : null}
            </MetricTile>
          ))}
        </div>
      ) : null}
    </div>
  );
}
