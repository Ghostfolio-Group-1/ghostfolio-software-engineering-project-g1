import { designTokens, px } from '../tokens/design-tokens';

// Matches apps/api/src/app/risk/interfaces/severity.type.ts one-to-one, kept
// local so the React library has no dependency on the API types (same
// convention as ChartPoint in chart-wrapper.tsx).
export type RiskSeverity = 'GREEN' | 'NO_DATA' | 'RED' | 'YELLOW';

// Severity-to-colour spec (issue #188). Every value of RiskSeverity has a
// defined colour and label here - there is no default/fallback case, so
// adding a 5th severity to the API would make this object (and its type)
// fail to compile rather than silently rendering grey.
export const SEVERITY_COLOR: Record<RiskSeverity, string> = {
  GREEN: designTokens.color.success,
  NO_DATA: designTokens.color.noData,
  RED: designTokens.color.danger,
  YELLOW: designTokens.color.warning
};

export const SEVERITY_LABEL: Record<RiskSeverity, string> = {
  GREEN: 'Green',
  NO_DATA: 'No data',
  RED: 'Red',
  YELLOW: 'Yellow'
};

export interface RiskIndicatorProps {
  label?: string;
  severity: RiskSeverity;
}

// A small coloured dot plus an optional label, used on every risk
// dashboard card (concentration, volatility, cash, target-deviation) and
// in the thresholds screen to show a rule's or bucket's severity at a
// glance. Severity must be understandable without relying on colour alone
// (Tharun's review on PR #211) - the word, not just the dot/aria-label, is
// rendered visibly alongside it.
export function RiskIndicator({ label, severity }: RiskIndicatorProps) {
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
