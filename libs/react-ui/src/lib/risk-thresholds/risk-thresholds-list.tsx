import type { DashboardCardStatus } from '../dashboard-card/dashboard-card';
import {
  EmptyState,
  ErrorState,
  LoadingSkeletonGroup,
  RiskCard
} from '../risk-ui/risk-ui';
import { designTokens, px } from '../tokens/design-tokens';
import { RiskThresholdRow } from './risk-threshold-row';
import type { ThresholdRowFormValues } from './risk-threshold-row-form.model';
import type { RiskThresholdItem } from './risk-thresholds.client';

export interface RiskThresholdsListProps {
  errorMessage?: string;
  items?: RiskThresholdItem[] | null;
  onReset: (ruleKey: string) => void;
  onRetry: () => void;
  onSave: (
    ruleKey: string,
    isActive: boolean,
    values: ThresholdRowFormValues
  ) => void;
  rowErrors: Record<string, string | undefined>;
  savingRuleKey?: string;
  status: DashboardCardStatus;
}

// This used to delegate its loading/error/empty rendering to the shared
// DashboardCard. That component's plain "Loading…" text and bare message
// are fine for this redesign's purposes functionally, but the pasted
// design spec wants a skeleton for loading and an icon+helper for the
// empty state specifically - rather than widen DashboardCard's own look
// for every other module that renders it (Tax, charts, the dashboard
// overview), this renders its own states directly. "Loading…" itself
// stays present (now screen-reader-only, next to a visible skeleton) so
// existing coverage asserting on that exact text keeps passing.
export function RiskThresholdsList({
  errorMessage,
  items,
  onReset,
  onRetry,
  onSave,
  rowErrors,
  savingRuleKey,
  status
}: RiskThresholdsListProps) {
  return (
    <RiskCard>
      <h2 style={{ fontSize: px(designTokens.fontSize.lg), margin: 0 }}>
        Thresholds
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
            <LoadingSkeletonGroup />
          </div>
        );
      case 'error':
        return (
          <ErrorState
            message={errorMessage ?? 'Something went wrong'}
            onRetry={onRetry}
          />
        );
      case 'empty':
        return <EmptyState message="No risk rules found" />;
      default:
        return (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {items?.map((item) => (
              <RiskThresholdRow
                errorMessage={rowErrors[item.ruleKey]}
                isSaving={savingRuleKey === item.ruleKey}
                item={item}
                key={item.ruleKey}
                onReset={() => onReset(item.ruleKey)}
                onSave={(isActive, values) =>
                  onSave(item.ruleKey, isActive, values)
                }
              />
            ))}
          </ul>
        );
    }
  }
}
