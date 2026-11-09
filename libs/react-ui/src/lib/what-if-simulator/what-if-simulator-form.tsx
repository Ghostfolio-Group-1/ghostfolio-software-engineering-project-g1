import type { ReactNode } from 'react';

import { Button } from '../button/button';
import { designTokens, px } from '../tokens/design-tokens';
import type {
  WhatIfFormErrors,
  WhatIfFormValues,
  WhatIfHoldingOption
} from './what-if-form.model';

export interface WhatIfSimulatorFormProps {
  errors?: WhatIfFormErrors;
  // The user's actual open holdings (issue #187 review: a free-text symbol
  // let the user shock a holding they don't have, or guess the wrong data
  // source for one they do). Empty while holdings are loading or on an
  // empty portfolio - the select then shows a placeholder and stays
  // disabled, same spirit as DashboardCard's empty state.
  holdings: WhatIfHoldingOption[];
  isSubmitting?: boolean;
  onChange: (values: WhatIfFormValues) => void;
  onSubmit: () => void;
  values: WhatIfFormValues;
}

// A symbol alone doesn't identify a holding (the same symbol can exist
// under more than one data source), so the select's value is this combined
// key rather than the bare symbol.
function holdingOptionKey({
  dataSource,
  symbol
}: Pick<WhatIfHoldingOption, 'dataSource' | 'symbol'>): string {
  return `${dataSource}:${symbol}`;
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
  holdings,
  isSubmitting = false,
  onChange,
  onSubmit,
  values
}: WhatIfSimulatorFormProps) {
  const selectedKey =
    values.symbol === ''
      ? ''
      : holdingOptionKey({
          dataSource: values.dataSource,
          symbol: values.symbol
        });

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

      <Field error={errors.symbol} label="Holding to shock">
        <select
          aria-invalid={Boolean(errors.symbol)}
          disabled={holdings.length === 0}
          onChange={(event) => {
            const holding = holdings.find(
              (option) => holdingOptionKey(option) === event.target.value
            );

            onChange({
              ...values,
              dataSource: holding?.dataSource ?? values.dataSource,
              symbol: holding?.symbol ?? ''
            });
          }}
          value={selectedKey}
        >
          <option value="">
            {holdings.length === 0
              ? 'No holdings available'
              : 'Select a holding'}
          </option>
          {holdings.map((holding) => (
            <option
              key={holdingOptionKey(holding)}
              value={holdingOptionKey(holding)}
            >
              {holding.name} ({holding.symbol} · {holding.dataSource})
            </option>
          ))}
        </select>
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
