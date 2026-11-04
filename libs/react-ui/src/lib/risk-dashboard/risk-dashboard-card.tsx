import type { ReactNode } from 'react';

import {
  DashboardCard,
  DashboardCardStatus
} from '../dashboard-card/dashboard-card';
import { useTheme } from '../theme/theme-provider';
import { designTokens, px } from '../tokens/design-tokens';

// Matches apps/api/src/app/risk/interfaces/severity.type.ts one-to-one, kept
// local so the React library has no dependency on the API types (same
// convention as ChartPoint in chart-wrapper.tsx). A shared RiskIndicator
// component (issue #188) lands separately - this card uses its own minimal
// severity dot for now rather than reaching ahead for that component.
export type RiskSeverity = 'GREEN' | 'NO_DATA' | 'RED' | 'YELLOW';

// YELLOW/NO_DATA aren't design tokens yet - GREEN/RED already are
// (designTokens.color.success/danger). Adding warning/noData tokens is
// shared design-system surface, left for when RiskIndicator itself is
// built and that change can go through review with the rest of the team.
const SEVERITY_COLOR: Record<RiskSeverity, string> = {
  GREEN: designTokens.color.success,
  NO_DATA: '#9e9e9e',
  RED: designTokens.color.danger,
  YELLOW: '#ffc107'
};

const SEVERITY_LABEL: Record<RiskSeverity, string> = {
  GREEN: 'Green',
  NO_DATA: 'No data',
  RED: 'Red',
  YELLOW: 'Yellow'
};

// Shows the severity word visibly next to the dot, not only in the
// aria-label - the Risk wireframe requires severity to be understandable
// without relying on color alone (Tharun's review on PR #211).
function SeverityDot({
  label,
  severity
}: {
  label?: string;
  severity: RiskSeverity;
}) {
  const severityWord = SEVERITY_LABEL[severity];
  const accessibleLabel = label ? `${label}: ${severityWord}` : severityWord;

  return (
    <span
      aria-label={accessibleLabel}
      role="status"
      style={{
        alignItems: 'center',
        display: 'inline-flex',
        gap: px(designTokens.spacing.xs)
      }}
    >
      <span
        aria-hidden="true"
        data-severity={severity}
        style={{
          backgroundColor: SEVERITY_COLOR[severity],
          borderRadius: '50%',
          display: 'inline-block',
          flexShrink: 0,
          height: px(designTokens.spacing.sm),
          width: px(designTokens.spacing.sm)
        }}
      />
      {label ? <span>{label}</span> : null}
      <span aria-hidden="true">{severityWord}</span>
    </span>
  );
}

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
        <SeverityDot label="Overall" severity={data.severity} />
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
          <SeverityDot
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
              <SeverityDot label={category.name} severity={category.severity} />
              <span>
                {category.score !== null ? Math.round(category.score) : '—'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
