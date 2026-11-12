import { useCallback, useState } from 'react';

import type { AuthenticatedFetch } from '../data/api-request';
import { ApiRequestError } from '../data/api-request';
import { useApiData } from '../data/use-api-data';
import type { ThresholdRowFormValues } from './risk-threshold-row-form.model';
import { toUpdateRiskThresholdThresholds } from './risk-threshold-row-form.model';
import { RiskThresholdsList } from './risk-thresholds-list';
import {
  fetchRiskThresholds,
  resetRiskThreshold,
  updateRiskThreshold
} from './risk-thresholds.client';

export interface RiskThresholdsPageProps {
  /** The host's authenticated fetch (see data/api-request). */
  request: AuthenticatedFetch;
}

function thresholdsErrorMessage(error: Error | null): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return 'Please sign in to view your risk thresholds';
    }

    if (error.status === 403) {
      return 'You do not have access to these risk thresholds';
    }
  }

  return 'Risk thresholds are unavailable right now';
}

// Owns the GET-loaded rule list and the per-rule save/reset calls; each
// row's edit buffer lives in RiskThresholdRow itself (see its own
// comment) - this page only tracks which rule is mid-save and any
// per-rule error, keyed by ruleKey, same "page wires presentational
// components to live data" split as TargetAllocationPage.
export function RiskThresholdsPage({ request }: RiskThresholdsPageProps) {
  const { data, error, reload, status } = useApiData((signal) =>
    fetchRiskThresholds(request, signal)
  );
  const [savingRuleKey, setSavingRuleKey] = useState<string>();
  const [rowErrors, setRowErrors] = useState<
    Record<string, string | undefined>
  >({});

  const save = useCallback(
    async (
      ruleKey: string,
      isActive: boolean,
      values: ThresholdRowFormValues
    ) => {
      const item = data?.find((candidate) => candidate.ruleKey === ruleKey);

      if (!item) {
        return;
      }

      setSavingRuleKey(ruleKey);
      setRowErrors((previous) => ({ ...previous, [ruleKey]: undefined }));

      try {
        await updateRiskThreshold(request, ruleKey, {
          isActive,
          thresholds: toUpdateRiskThresholdThresholds(item.shape, values)
        });
        reload();
      } catch (saveError) {
        setRowErrors((previous) => ({
          ...previous,
          [ruleKey]:
            saveError instanceof Error
              ? saveError.message
              : 'Could not save the threshold.'
        }));
      } finally {
        setSavingRuleKey(undefined);
      }
    },
    [data, request, reload]
  );

  const reset = useCallback(
    async (ruleKey: string) => {
      setSavingRuleKey(ruleKey);
      setRowErrors((previous) => ({ ...previous, [ruleKey]: undefined }));

      try {
        await resetRiskThreshold(request, ruleKey);
        reload();
      } catch (resetError) {
        setRowErrors((previous) => ({
          ...previous,
          [ruleKey]:
            resetError instanceof Error
              ? resetError.message
              : 'Could not reset the threshold.'
        }));
      } finally {
        setSavingRuleKey(undefined);
      }
    },
    [request, reload]
  );

  return (
    <RiskThresholdsList
      errorMessage={
        status === 'error' ? thresholdsErrorMessage(error) : undefined
      }
      items={data}
      onReset={reset}
      onRetry={reload}
      onSave={save}
      rowErrors={rowErrors}
      savingRuleKey={savingRuleKey}
      status={status}
    />
  );
}
