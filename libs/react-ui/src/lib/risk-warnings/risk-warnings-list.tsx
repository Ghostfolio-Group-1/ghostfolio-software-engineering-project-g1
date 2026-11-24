import { useState } from 'react';

import type { DashboardCardStatus } from '../dashboard-card/dashboard-card';
import { RiskIndicator } from '../risk-indicator/risk-indicator';
import { useRiskPalette } from '../risk-ui/risk-palette';
import {
  Chip,
  EmptyState,
  ErrorState,
  LoadingSkeletonGroup,
  RiskCard,
  StatusPill
} from '../risk-ui/risk-ui';
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

type WarningFilter = 'ALL' | 'RED' | 'YELLOW';

const FILTERS: { label: string; value: WarningFilter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Red', value: 'RED' },
  { label: 'Yellow', value: 'YELLOW' }
];

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
  const palette = useRiskPalette();
  const [filter, setFilter] = useState<WarningFilter>('ALL');
  const visible =
    filter === 'ALL'
      ? warnings
      : warnings.filter((warning) => warning.severity === filter);

  return (
    <RiskCard>
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          flexWrap: 'wrap',
          gap: px(designTokens.spacing.sm),
          justifyContent: 'space-between'
        }}
      >
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            gap: px(designTokens.spacing.sm)
          }}
        >
          <h2 style={{ fontSize: px(designTokens.fontSize.lg), margin: 0 }}>
            Warnings
          </h2>
          {status === 'ready' ? (
            <StatusPill severity={warnings.length > 0 ? 'RED' : 'GREEN'}>
              {warnings.length} warning{warnings.length === 1 ? '' : 's'}
            </StatusPill>
          ) : null}
        </div>
        {status === 'ready' && warnings.length > 0 ? (
          <div style={{ display: 'flex', gap: px(designTokens.spacing.xs) }}>
            {FILTERS.map((option) => (
              <Chip
                key={option.value}
                onClick={() => setFilter(option.value)}
                selected={filter === option.value}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: px(designTokens.spacing.md) }}>
        {renderBody()}
      </div>
    </RiskCard>
  );

  function renderBody() {
    if (status === 'loading') {
      return (
        <div aria-busy="true" role="status">
          <LoadingSkeletonGroup />
        </div>
      );
    }

    if (status === 'error') {
      return (
        <ErrorState
          message={errorMessage ?? 'Something went wrong'}
          onRetry={onRetry}
        />
      );
    }

    if (status === 'empty' || warnings.length === 0) {
      return (
        <EmptyState
          message="No active warnings. Your portfolio is within all limits."
          title="All clear"
        />
      );
    }

    return (
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
        {visible.map((warning) => (
          <li
            key={`${warning.ruleKey}:${warning.subject.type}:${warning.subject.value}`}
            style={{
              borderRadius: 10,
              padding: px(designTokens.spacing.sm),
              transition: 'background-color 150ms ease'
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
            <p style={{ color: palette.textMuted, margin: 0 }}>
              {warning.message}
            </p>
          </li>
        ))}
      </ul>
    );
  }
}
