import type { ReactNode } from 'react';

import { Button } from '../button/button';
import { designTokens, px } from '../tokens/design-tokens';
import type { WhatIfFormErrors, WhatIfFormValues } from './what-if-form.model';

export interface WhatIfSimulatorFormProps {
  errors?: WhatIfFormErrors;
  isSubmitting?: boolean;
  onChange: (values: WhatIfFormValues) => void;
  onSubmit: () => void;
  values: WhatIfFormValues;
}

// Controlled, stateless form (same shape as Button/Card: value + onChange
// from the parent) so it is testable with renderToStaticMarkup in a
// jsdom-less jest environment - validation itself lives in
// what-if-form.model.ts and is unit-tested there directly.
//
// Deliberately calls no hooks of its own (the design-tokens color is used
// directly, not via useTheme()) - component tests exercise it both via
// renderToStaticMarkup and via a plain function call to read a prop
// function off the returned element tree (see the DashboardCard spec for
// the same pattern), and a plain call bypasses React's hook dispatcher.
export function WhatIfSimulatorForm({
  errors = {},
  isSubmitting = false,
  onChange,
  onSubmit,
  values
}: WhatIfSimulatorFormProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: px(designTokens.spacing.sm)
      }}
    >
      <Field label="Scenario name">
        <input
          onChange={(event) =>
            onChange({ ...values, scenarioName: event.target.value })
          }
          placeholder="e.g. Tech sell-off"
          type="text"
          value={values.scenarioName}
        />
      </Field>

      <Field error={errors.symbol} label="Holding symbol">
        <input
          aria-invalid={Boolean(errors.symbol)}
          onChange={(event) =>
            onChange({ ...values, symbol: event.target.value })
          }
          placeholder="e.g. AAPL"
          type="text"
          value={values.symbol}
        />
      </Field>

      <Field error={errors.dropPercentage} label="Drop percentage">
        <input
          aria-invalid={Boolean(errors.dropPercentage)}
          max={100}
          min={0}
          onChange={(event) =>
            onChange({ ...values, dropPercentage: event.target.value })
          }
          placeholder="e.g. 40"
          type="number"
          value={values.dropPercentage}
        />
        <span style={{ color: designTokens.color.textMuted }}>%</span>
      </Field>

      <div>
        <Button disabled={isSubmitting} onClick={onSubmit} variant="primary">
          {isSubmitting ? 'Simulating…' : 'Run simulation'}
        </Button>
      </div>
    </div>
  );
}

function Field({
  children,
  error,
  label
}: {
  children: ReactNode;
  error?: string;
  label: string;
}) {
  return (
    <label
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: px(designTokens.spacing.xs)
      }}
    >
      <span>{label}</span>
      <span
        style={{
          alignItems: 'center',
          display: 'flex',
          gap: px(designTokens.spacing.xs)
        }}
      >
        {children}
      </span>
      {error ? (
        <span role="alert" style={{ color: designTokens.color.danger }}>
          {error}
        </span>
      ) : null}
    </label>
  );
}
