import { DashboardCard } from '../dashboard-card/dashboard-card';
import type { DashboardCardStatus } from '../dashboard-card/dashboard-card';
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
    <DashboardCard
      emptyMessage="No risk rules found"
      errorMessage={errorMessage}
      onRetry={onRetry}
      status={status}
      title="Thresholds"
    >
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
    </DashboardCard>
  );
}
