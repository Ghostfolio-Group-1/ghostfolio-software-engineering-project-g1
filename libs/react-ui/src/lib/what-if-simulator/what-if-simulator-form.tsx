import type { ReactNode } from 'react';

import { Button } from '../button/button';
import type { DashboardCardStatus } from '../dashboard-card/dashboard-card';
import { designTokens, px } from '../tokens/design-tokens';
import type {
  WhatIfFormErrors,
  WhatIfFormValues,
  WhatIfHoldingOption
} from './what-if-form.model';

// Inline field/input styling below deliberately uses the static
// designTokens colours, not useRiskPalette()/useTheme() - this component
// is tested by calling it as a plain function (see the spec's findByType
// helper) to inspect the Button/select elements it returns without a real
// React render, and a hook call outside React's dispatcher throws. The
// submit Button and the holding <select> keep their exact element types
// for that same reason - only their siblings get the redesign's styling.
const RISK_INPUT_STYLE = {
  backgroundColor: designTokens.color.surface,
  border: `1px solid ${designTokens.color.border}`,
  borderRadius: 10,
  fontFamily: designTokens.fontFamily,
  fontSize: px(designTokens.fontSize.sm),
  height: 40,
  padding: `0 ${px(designTokens.spacing.sm)}`
};

export interface WhatIfSimulatorFormProps {
  errors?: WhatIfFormErrors;
  // The user's actual open holdings (issue #187 review: a free-text symbol
  // let the user shock a holding they don't have, or guess the wrong data
  // source for one they do).
  holdings: WhatIfHoldingOption[];
  // Distinguishes "still loading", "failed to load" and "genuinely has no
  // holdings" - all three used to collapse into one "No holdings
  // available" placeholder, which made a failed holdings request look like
  // an empty portfolio. Same status vocabulary as DashboardCard.
  holdingsStatus?: DashboardCardStatus;
  holdingsErrorMessage?: string;
  isSubmitting?: boolean;
  onChange: (values: WhatIfFormValues) => void;
  onRetryHoldings?: () => void;
  onSubmit: () => void;
  values: WhatIfFormValues;
}

const GENERIC_HOLDINGS_ERROR_MESSAGE = 'Could not load your holdings.';

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
  holdingsErrorMessage,
  holdingsStatus = 'ready',
  isSubmitting = false,
  onChange,
  onRetryHoldings,
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
  const holdingsPlaceholder =
    holdingsStatus === 'loading'
      ? 'Loading holdings…'
      : holdingsStatus === 'error'
        ? 'Could not load holdings'
        : 'No holdings available';

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
          style={RISK_INPUT_STYLE}
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
          style={RISK_INPUT_STYLE}
          value={selectedKey}
        >
          <option value="">
            {holdings.length === 0 ? holdingsPlaceholder : 'Select a holding'}
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
        {holdingsStatus === 'error' ? (
          <span
            role="alert"
            style={{
              alignItems: 'center',
              color: designTokens.color.danger,
              display: 'inline-flex',
              gap: px(designTokens.spacing.xs)
            }}
          >
            {holdingsErrorMessage ?? GENERIC_HOLDINGS_ERROR_MESSAGE}
            {onRetryHoldings ? (
              <Button onClick={onRetryHoldings} variant="secondary">
                Retry
              </Button>
            ) : null}
          </span>
        ) : null}
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
          style={{
            ...RISK_INPUT_STYLE,
            paddingRight: px(designTokens.spacing.lg)
          }}
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
      <span style={{ fontSize: px(designTokens.fontSize.sm), fontWeight: 600 }}>
        {label}
      </span>
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
