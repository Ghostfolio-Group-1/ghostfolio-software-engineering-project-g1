import type { ReactNode } from 'react';

import {
  DashboardCard,
  DashboardCardStatus
} from '../dashboard-card/dashboard-card';
import { RiskIndicator } from '../risk-indicator/risk-indicator';
import type { RiskSeverity } from '../risk-indicator/risk-indicator';
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

// Issue #26, built on top of DashboardCard so the risk section follows the
// same available/unavailable per-section idiom as every other dashboard
// card (GET /api/v1/dashboard/overview's "risk" section). score comes from
// GET /risk/score, topConcentration from GET /risk/concentration - wiring
// this card up to those routes is a separate task.
export function RiskDashboardCard({
  data,
  errorMessage,
  onRetry,
  status
}: RiskDashboardCardProps) {
  return (
    <DashboardCard
      emptyMessage="No holdings yet - your risk score will appear once you add some."
      errorMessage={errorMessage ?? 'Risk data is unavailable'}
      onRetry={onRetry}
      status={status}
      title="Risk"
    >
      {data ? <RiskDashboardCardBody data={data} /> : null}
    </DashboardCard>
  );
}

function RiskDashboardCardBody({
  data
}: {
  data: RiskDashboardSummary;
}): ReactNode {
  const theme = useTheme();

  return (
    <div>
      <div
        style={{
          alignItems: 'baseline',
          display: 'flex',
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
          <span style={{ color: theme.color.textMuted }}>
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
        <ul
          style={{
            listStyle: 'none',
            margin: `${px(designTokens.spacing.sm)} 0 0`,
            padding: 0
          }}
        >
          {data.categories.map((category) => (
            <li
              key={category.key}
              style={{
                alignItems: 'center',
                display: 'flex',
                justifyContent: 'space-between',
                padding: `${px(designTokens.spacing.xs)} 0`
              }}
            >
              <RiskIndicator
                label={category.name}
                severity={category.severity}
              />
              {/* QA R-07 (Mon 11/23): this used to render as a bare number
                  ("Concentration Red 0"), so a new user had no way to tell
                  it was a rule score out of 100, let alone that 100 is the
                  best possible value. "/ 100" makes both of those explicit
                  without needing a separate label element. */}
              <span>
                {category.score !== null
                  ? `${Math.round(category.score)} / 100`
                  : '—'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
