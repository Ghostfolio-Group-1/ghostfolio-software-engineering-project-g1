import { designTokens, px } from '../tokens/design-tokens';

// Matches apps/api/src/app/risk/interfaces/severity.type.ts one-to-one, kept
// local so the React library has no dependency on the API types (same
// convention as ChartPoint in chart-wrapper.tsx).
export type RiskSeverity = 'GREEN' | 'NO_DATA' | 'RED' | 'YELLOW';

// Severity-to-colour spec (issue #188). Every value of RiskSeverity has a
// defined colour and label here - there is no default/fallback case, so
// adding a 5th severity to the API would make this object (and its type)
// fail to compile rather than silently rendering grey.
//
// NO_DATA deliberately uses textMuted, not designTokens.color.noData: the
// noData token is #9e9e9e, which is only 2.68:1 against a white background
// (Mon 11/23 usability pass) - below WCAG 1.4.11's 3:1 minimum for a
// non-text UI component, so the dot could be hard to see for low-vision
// users. textMuted (#757575) is 4.61:1 and is already the rest of the
// library's token for "this is secondary/neutral information", so this
// also keeps the severity dot's grey consistent with every other muted
// label in the Risk screens instead of introducing a second grey.
export const SEVERITY_COLOR: Record<RiskSeverity, string> = {
  GREEN: designTokens.color.success,
  NO_DATA: designTokens.color.textMuted,
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
  // Folded into the aria-label ("<text>: <severity>") like `label`, but
  // never rendered visibly - for callers (e.g. a MetricTile) that already
  // show the subject's name themselves, so the indicator would otherwise
  // duplicate it on screen while still needing it in the accessible name
  // (fixes PR #351: the redesign dropped `label` from the per-category
  // indicators to avoid that visible duplication, which silently dropped
  // the accessible name too - e.g. "Target Allocation: Red" became "Red").
  visuallyHiddenLabel?: string;
}

// A small coloured dot plus an optional label, used on every risk
// dashboard card (concentration, volatility, cash, target-deviation) and
// in the thresholds screen to show a rule's or bucket's severity at a
// glance. Severity must be understandable without relying on colour alone
// (Tharun's review on PR #211) - the word, not just the dot/aria-label, is
// rendered visibly alongside it.
export function RiskIndicator({
  label,
  severity,
  visuallyHiddenLabel
}: RiskIndicatorProps) {
  const severityWord = SEVERITY_LABEL[severity];
  const subjectLabel = label ?? visuallyHiddenLabel;
  const accessibleLabel = subjectLabel
    ? `${subjectLabel}: ${severityWord}`
    : severityWord;

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
