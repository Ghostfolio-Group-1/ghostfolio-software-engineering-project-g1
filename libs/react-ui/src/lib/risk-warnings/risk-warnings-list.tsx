import type { DashboardCardStatus } from '../dashboard-card/dashboard-card';
import { DashboardCard } from '../dashboard-card/dashboard-card';
import { RiskIndicator } from '../risk-indicator/risk-indicator';
import { designTokens, px } from '../tokens/design-tokens';
import type { RiskWarning } from './risk-warnings.client';

export interface RiskWarningsListProps {
  errorMessage?: string;
  onRetry?: () => void;
  status: DashboardCardStatus;
  warnings?: RiskWarning[];
}

// Subject types a warning can carry (risk-warning.interface.ts). 'bucket'
// and 'portfolio' aren't produced by any rule yet, but are included so a
// future rule that uses them renders a sensible label instead of falling
// through to the raw type string.
const SUBJECT_LABEL: Record<RiskWarning['subject']['type'], string> = {
  bucket: 'Bucket',
  country: 'Country',
  currency: 'Currency',
  portfolio: 'Portfolio',
  sector: 'Sector',
  stock: 'Stock'
};

// Renders GET /risk/warnings - every breaching rule/subject pair, not just
// the worst one RiskDashboardCard shows per category. Each row already
// carries its own severity, actual and threshold (risk-warning.interface.ts),
// so no extra lookup against the score/concentration responses is needed.
export function RiskWarningsList({
  errorMessage,
  onRetry,
  status,
  warnings = []
}: RiskWarningsListProps) {
  return (
    <DashboardCard
      emptyMessage="No active warnings"
      errorMessage={errorMessage}
      onRetry={onRetry}
      status={status}
      title="Warnings"
    >
      <ul
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: px(designTokens.spacing.sm),
          listStyle: 'none',
          margin: 0,
          padding: 0
        }}
      >
        {warnings.map((warning) => (
          <li
            key={`${warning.ruleKey}:${warning.subject.type}:${warning.subject.value}`}
            style={{
              borderBottom: `1px solid ${designTokens.color.border}`,
              paddingBottom: px(designTokens.spacing.sm)
            }}
          >
            <div
              style={{
                alignItems: 'baseline',
                display: 'flex',
                gap: px(designTokens.spacing.xs)
              }}
            >
              <RiskIndicator severity={warning.severity} />
              <span style={{ fontWeight: 600 }}>
                {SUBJECT_LABEL[warning.subject.type]}: {warning.subject.value}
              </span>
            </div>
            <p style={{ color: designTokens.color.textMuted, margin: 0 }}>
              {warning.message}
            </p>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}
