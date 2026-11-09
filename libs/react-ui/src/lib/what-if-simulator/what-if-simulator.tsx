import { Button } from '../button/button';
import { designTokens, px } from '../tokens/design-tokens';
import type {
  WhatIfFormErrors,
  WhatIfFormValues,
  WhatIfHoldingOption
} from './what-if-form.model';
import { WhatIfResultPanel } from './what-if-result-panel';
import type { WhatIfResultSummary } from './what-if-result-panel';
import { WhatIfSimulatorForm } from './what-if-simulator-form';

export type WhatIfSimulatorStatus = 'error' | 'idle' | 'ready' | 'submitting';

export interface WhatIfSimulatorProps {
  // Server/network error from runWhatIf() (Thu Nov 19) - distinct from
  // `errors`, which is the client-side validation from
  // validateWhatIfForm() shown inline on the fields themselves.
  apiErrorMessage?: string;
  errors?: WhatIfFormErrors;
  // Defaults to [] so callers that haven't loaded holdings yet (or existing
  // tests written before holding selection replaced free-text symbol entry)
  // don't have to pass an empty array explicitly; the form then shows its
  // "No holdings available" placeholder.
  holdings?: WhatIfHoldingOption[];
  onChange: (values: WhatIfFormValues) => void;
  onRetry?: () => void;
  onSubmit: () => void;
  result?: WhatIfResultSummary;
  status: WhatIfSimulatorStatus;
  values: WhatIfFormValues;
}

// Composes the form (issue #187, Mon Nov 16) and the result panel (Wed Nov
// 18) with the two kinds of failure a run can hit (Thu Nov 19): invalid
// input, shown inline per field by the form itself, and an API error
// (RISK_WHATIF_INVALID_DROP, RISK_WHATIF_HOLDING_NOT_FOUND, RISK_CALC_FAILED,
// a network failure, ...), shown once below the form with a retry action.
// The caller owns all state (values/status/result) and the two API calls -
// this component only renders what that state implies, same as
// DashboardCard's status prop.
export function WhatIfSimulator({
  apiErrorMessage,
  errors,
  holdings = [],
  onChange,
  onRetry,
  onSubmit,
  result,
  status,
  values
}: WhatIfSimulatorProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: px(designTokens.spacing.md)
      }}
    >
      <WhatIfSimulatorForm
        errors={errors}
        holdings={holdings}
        isSubmitting={status === 'submitting'}
        onChange={onChange}
        onSubmit={onSubmit}
        values={values}
      />

      {status === 'error' ? (
        <div role="alert">
          <p style={{ color: designTokens.color.danger }}>
            {apiErrorMessage ??
              'Could not run the simulation. Please try again.'}
          </p>
          {onRetry ? (
            <Button onClick={onRetry} variant="secondary">
              Try again
            </Button>
          ) : null}
        </div>
      ) : null}

      {status === 'ready' && result ? (
        <WhatIfResultPanel result={result} />
      ) : null}
    </div>
  );
}
