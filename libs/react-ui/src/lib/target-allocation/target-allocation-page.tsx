import { useCallback, useEffect, useState } from 'react';

import type { AuthenticatedFetch } from '../data/api-request';
import { ApiRequestError } from '../data/api-request';
import { useApiData } from '../data/use-api-data';
import { TargetAllocationEditor } from './target-allocation-editor';
import type {
  TargetAllocationFormErrors,
  TargetAllocationFormValues
} from './target-allocation-form.model';
import {
  createEmptyTargetAllocationFormValues,
  isTargetAllocationFormValid,
  toUpdateTargetAllocationRequest,
  validateTargetAllocationForm
} from './target-allocation-form.model';
import {
  clearTargetAllocation,
  fetchTargetAllocation,
  updateTargetAllocation
} from './target-allocation.client';
import type { TargetAllocationData } from './target-allocation.client';

export interface TargetAllocationPageProps {
  /** The host's authenticated fetch (see data/api-request). */
  request: AuthenticatedFetch;
}

function toFormValues(data: TargetAllocationData): TargetAllocationFormValues {
  if (!data.isSet || data.targets.length === 0) {
    return createEmptyTargetAllocationFormValues();
  }

  return {
    groupBy: data.groupBy ?? createEmptyTargetAllocationFormValues().groupBy,
    rows: data.targets.map((target) => ({
      key: target.key,
      percentage: String(Math.round(target.percentage * 1000) / 10)
    }))
  };
}

function targetAllocationErrorMessage(error: Error | null): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return 'Please sign in to view your target allocation';
    }

    if (error.status === 403) {
      return 'You do not have access to this target allocation';
    }
  }

  return 'Target allocation is unavailable right now';
}

// Owns the GET-loaded data (RiskPage mounts this once the holder's
// identity is known), the form's local edit state, and the PUT/DELETE
// calls - same "page wires presentational components to live data" split
// as WhatIfSimulatorPage, with the added wrinkle that this page's own
// `values` must be re-seeded from the server once after load (and after
// every successful save), not just once at mount.
export function TargetAllocationPage({ request }: TargetAllocationPageProps) {
  const { data, error, reload, status } = useApiData((signal) =>
    fetchTargetAllocation(request, signal)
  );
  const [values, setValues] = useState<TargetAllocationFormValues>(
    createEmptyTargetAllocationFormValues()
  );
  const [formErrors, setFormErrors] = useState<TargetAllocationFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string>();

  useEffect(() => {
    if (data) {
      setValues(toFormValues(data));
    }
  }, [data]);

  const submit = useCallback(async () => {
    const errors = validateTargetAllocationForm(values);

    if (!isTargetAllocationFormValid(values)) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setSubmitErrorMessage(undefined);
    setIsSubmitting(true);

    try {
      const updated = await updateTargetAllocation(
        request,
        toUpdateTargetAllocationRequest(values)
      );

      setValues(toFormValues(updated));
      reload();
    } catch (submitError) {
      setSubmitErrorMessage(
        submitError instanceof Error ? submitError.message : undefined
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [request, reload, values]);

  const clear = useCallback(async () => {
    setSubmitErrorMessage(undefined);
    setIsSubmitting(true);

    try {
      const cleared = await clearTargetAllocation(request);

      setValues(toFormValues(cleared));
      reload();
    } catch (clearError) {
      setSubmitErrorMessage(
        clearError instanceof Error ? clearError.message : undefined
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [request, reload]);

  return (
    <TargetAllocationEditor
      buckets={data?.buckets}
      errorMessage={
        status === 'error' ? targetAllocationErrorMessage(error) : undefined
      }
      formErrors={formErrors}
      isSet={data?.isSet ?? false}
      isSubmitting={isSubmitting}
      onChange={setValues}
      onClear={clear}
      onRetry={reload}
      onSubmit={submit}
      status={status}
      submitErrorMessage={submitErrorMessage}
      values={values}
    />
  );
}
