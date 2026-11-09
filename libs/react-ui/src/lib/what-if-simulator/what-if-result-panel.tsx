import { Card } from '../card/card';
import { RiskIndicator } from '../risk-indicator/risk-indicator';
import type { RiskSeverity } from '../risk-indicator/risk-indicator';
import { useTheme } from '../theme/theme-provider';
import { designTokens, px } from '../tokens/design-tokens';

// Local shapes mirroring apps/api/src/app/risk/interfaces/what-if.interface.ts
// (WhatIfResult) and risk-warning.interface.ts (RiskWarning), independent of
// the API package per this library's convention.
export interface WhatIfMoneyAmount {
  amount: number;
  currency: string;
}

export interface WhatIfWarningSummary {
  actual: number;
  message: string;
  ruleKey: string;
  severity: 'RED' | 'YELLOW';
  subject: { type: string; value: string };
  threshold: number;
}

export interface WhatIfResultSummary {
  changedWarnings: WhatIfWarningSummary[];
  holding: {
    allocationAfter: number;
    allocationBefore: number;
    valueAfter: WhatIfMoneyAmount;
    valueBefore: WhatIfMoneyAmount;
  };
  newWarnings: WhatIfWarningSummary[];
  portfolio: {
    change: WhatIfMoneyAmount;
    changePercentage: number;
    valueAfter: WhatIfMoneyAmount;
    valueBefore: WhatIfMoneyAmount;
  };
  resolvedWarnings: WhatIfWarningSummary[];
  scenario: {
    dataSource: string;
    dropPercentage: number;
    name: string;
    symbol: string;
  };
  score: { after: number | null; before: number | null; change: number | null };
}

// Mirrors getOverallSeverity in apps/api/src/app/risk/risk-score.mapper.ts
// (score >= 80 GREEN, >= 60 YELLOW, else RED; null -> NO_DATA). Duplicated
// rather than imported because this library has no dependency on the API
// package - see the module comment on WhatIfResultSummary above.
function scoreToSeverity(score: number | null): RiskSeverity {
  if (score === null) {
    return 'NO_DATA';
  }

  if (score >= 80) {
    return 'GREEN';
  }

  if (score >= 60) {
    return 'YELLOW';
  }

  return 'RED';
}

function formatMoney({ amount, currency }: WhatIfMoneyAmount): string {
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
}

function formatPercentage(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

// Renders the before/after health score and the per-holding warning
// differences from a POST /risk/what-if response (Wed Nov 18). Purely
// presentational - loading/error/empty states for the surrounding
// simulator are handled by WhatIfSimulator, not here, since this panel has
// nothing meaningful to show until a result exists.
export function WhatIfResultPanel({ result }: { result: WhatIfResultSummary }) {
  const theme = useTheme();

  return (
    <Card
      title={`Scenario: ${result.scenario.name} (-${formatPercentage(result.scenario.dropPercentage)})`}
    >
      <div
        style={{
          alignItems: 'baseline',
          display: 'flex',
          gap: px(designTokens.spacing.md)
        }}
      >
        <ScoreBadge label="Before" score={result.score.before} />
        <span aria-hidden="true">→</span>
        <ScoreBadge label="After" score={result.score.after} />
        {result.score.change !== null ? (
          <span
            style={{
              color:
                result.score.change < 0
                  ? designTokens.color.danger
                  : designTokens.color.success
            }}
          >
            {result.score.change > 0 ? '+' : ''}
            {result.score.change}
          </span>
        ) : null}
      </div>

      <p style={{ color: theme.color.textMuted }}>
        Holding allocation: {formatPercentage(result.holding.allocationBefore)}{' '}
        → {formatPercentage(result.holding.allocationAfter)}
        {' · '}
        Portfolio value: {formatMoney(result.portfolio.valueBefore)} →{' '}
        {formatMoney(result.portfolio.valueAfter)} (
        {formatPercentage(result.portfolio.changePercentage)})
      </p>

      <WarningSection title="New warnings" warnings={result.newWarnings} />
      <WarningSection
        title="Resolved warnings"
        warnings={result.resolvedWarnings}
      />
      <WarningSection
        title="Changed warnings"
        warnings={result.changedWarnings}
      />
    </Card>
  );
}

function ScoreBadge({ label, score }: { label: string; score: number | null }) {
  return (
    <span
      style={{
        alignItems: 'center',
        display: 'inline-flex',
        gap: px(designTokens.spacing.xs)
      }}
    >
      <span>{label}:</span>
      <strong>{score ?? '—'}</strong>
      <RiskIndicator severity={scoreToSeverity(score)} />
    </span>
  );
}

function WarningSection({
  title,
  warnings
}: {
  title: string;
  warnings: WhatIfWarningSummary[];
}) {
  const theme = useTheme();

  return (
    <section style={{ marginTop: px(designTokens.spacing.sm) }}>
      <h3 style={{ fontSize: px(designTokens.fontSize.sm), margin: 0 }}>
        {title}
      </h3>
      {warnings.length === 0 ? (
        <p style={{ color: theme.color.textMuted, margin: 0 }}>None</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {warnings.map((warning, index) => (
            <li
              key={`${warning.ruleKey}-${warning.subject.value}-${index}`}
              style={{ padding: `${px(designTokens.spacing.xs)} 0` }}
            >
              <RiskIndicator
                label={warning.message}
                severity={warning.severity}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
