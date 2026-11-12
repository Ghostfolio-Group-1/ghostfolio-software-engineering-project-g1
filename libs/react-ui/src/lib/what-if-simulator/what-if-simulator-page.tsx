import { useCallback, useState } from 'react';

import type { AuthenticatedFetch } from '../data/api-request';
import { useApiData } from '../data/use-api-data';
import {
  createEmptyWhatIfFormValues,
  isWhatIfFormValid,
  toRunWhatIfRequest,
  validateWhatIfForm
} from './what-if-form.model';
import type { WhatIfFormErrors, WhatIfFormValues } from './what-if-form.model';
import type { WhatIfResultSummary } from './what-if-result-panel';
import { WhatIfSimulator } from './what-if-simulator';
import type { WhatIfSimulatorStatus } from './what-if-simulator';
import {
  createWhatIfPostJson,
  fetchWhatIfHoldingOptions,
  runWhatIf
} from './what-if-simulator.client';

export interface WhatIfSimulatorPageProps {
  /** The host's authenticated fetch (see data/api-request). */
  request: AuthenticatedFetch;
}

// The missing host for the what-if simulator (issue #187 review): owns the
// form values/status/result state that WhatIfSimulator only renders, wires
// WhatIfSimulatorForm's onSubmit to runWhatIf() via createWhatIfPostJson(),
// and loads the user's real holdings for the holding selector - the same
// "page wires a presentational component to live data" split as
// DashboardOverviewPage/dashboard-overview.ts.
export function WhatIfSimulatorPage({ request }: WhatIfSimulatorPageProps) {
  const {
    data: holdings,
    error: holdingsError,
    reload: reloadHoldings,
    status: holdingsStatus
  } = useApiData(
    (signal) => fetchWhatIfHoldingOptions(request, signal),
    (data) => data.length === 0
  );
  const [values, setValues] = useState<WhatIfFormValues>(
    createEmptyWhatIfFormValues()
  );
  const [errors, setErrors] = useState<WhatIfFormErrors>({});
  const [status, setStatus] = useState<WhatIfSimulatorStatus>('idle');
  const [result, setResult] = useState<WhatIfResultSummary>();
  const [apiErrorMessage, setApiErrorMessage] = useState<string>();

  const submit = useCallback(async () => {
    const formErrors = validateWhatIfForm(values);

    if (!isWhatIfFormValid(values)) {
      setErrors(formErrors);
      return;
    }

    setErrors({});
    setStatus('submitting');

    try {
      const nextResult = await runWhatIf(
        createWhatIfPostJson(request),
        toRunWhatIfRequest(values)
      );

      setResult(nextResult);
      setStatus('ready');
    } catch (error) {
      setApiErrorMessage(error instanceof Error ? error.message : undefined);
      setStatus('error');
    }
  }, [request, values]);

  return (
    <WhatIfSimulator
      apiErrorMessage={apiErrorMessage}
      errors={errors}
      holdings={holdings ?? []}
      holdingsErrorMessage={holdingsError?.message}
      holdingsStatus={holdingsStatus}
      onChange={setValues}
      onRetry={submit}
      onRetryHoldings={reloadHoldings}
      onSubmit={submit}
      result={result}
      status={status}
      values={values}
    />
  );
}
