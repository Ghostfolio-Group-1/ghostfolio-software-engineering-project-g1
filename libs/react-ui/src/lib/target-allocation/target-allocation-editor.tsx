import type { DashboardCardStatus } from '../dashboard-card/dashboard-card';
import { RiskIndicator } from '../risk-indicator/risk-indicator';
import { useRiskPalette } from '../risk-ui/risk-palette';
import {
  EmptyState,
  ErrorState,
  LoadingSkeletonGroup,
  RiskButton,
  RiskCard
} from '../risk-ui/risk-ui';
import { designTokens, px } from '../tokens/design-tokens';
import { TargetAllocationForm } from './target-allocation-form';
import type {
  TargetAllocationFormErrors,
  TargetAllocationFormValues
} from './target-allocation-form.model';
import type { TargetAllocationBucket } from './target-allocation.client';

export interface TargetAllocationEditorProps {
  buckets?: TargetAllocationBucket[];
  errorMessage?: string;
  formErrors?: TargetAllocationFormErrors;
  isSet?: boolean;
  isSubmitting?: boolean;
  onChange: (values: TargetAllocationFormValues) => void;
  onClear?: () => void;
  onRetry?: () => void;
  onSubmit: () => void;
  status: DashboardCardStatus;
  submitErrorMessage?: string;
  values: TargetAllocationFormValues;
}

// Composes the form with the two kinds of failure a save can hit - same
// split as WhatIfSimulator: `formErrors` is client-side validation
// (target-allocation-form.model.ts) shown inline on the fields, while
// `submitErrorMessage` is a PUT/DELETE failure (duplicate key, invalid
// sum, invalid key, or a network/server error) shown once below the form.
// `status`/`errorMessage`/`onRetry` cover the initial GET, same as every
// other *Page/*Card pair (RiskDashboardCard, RiskWarningsList).
export function TargetAllocationEditor({
  buckets = [],
  errorMessage,
  formErrors,
  isSet = false,
  isSubmitting = false,
  onChange,
  onClear,
  onRetry,
  onSubmit,
  status,
  submitErrorMessage,
  values
}: TargetAllocationEditorProps) {
  const palette = useRiskPalette();

  return (
    <RiskCard>
      <h2 style={{ fontSize: px(designTokens.fontSize.lg), margin: 0 }}>
        Target allocation
      </h2>
      <div style={{ marginTop: px(designTokens.spacing.md) }}>
        {renderBody()}
      </div>
    </RiskCard>
  );

  function renderBody() {
    if (status === 'loading') {
      return (
        <div aria-busy="true" role="status">
          <LoadingSkeletonGroup />
        </div>
      );
    }

    if (status === 'error') {
      return (
        <ErrorState
          message={errorMessage ?? 'Something went wrong'}
          onRetry={onRetry}
        />
      );
    }

    if (status === 'empty' && !isSet) {
      return <EmptyState message="No target allocation configured yet." />;
    }

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: px(designTokens.spacing.md)
        }}
      >
        {!isSet ? (
          <p style={{ color: palette.textMuted, margin: 0 }}>
            No target allocation configured yet.
          </p>
        ) : null}

        {isSet && buckets.length > 0 ? (
          <ul
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: px(designTokens.spacing.xs),
              listStyle: 'none',
              margin: 0,
              padding: 0
            }}
          >
            {buckets.map((bucket) => (
              <li
                key={bucket.key}
                style={{
                  alignItems: 'center',
                  display: 'flex',
                  gap: px(designTokens.spacing.sm),
                  justifyContent: 'space-between'
                }}
              >
                <RiskIndicator label={bucket.key} severity={bucket.severity} />
                <span style={{ color: palette.textMuted }}>
                  {Math.round(bucket.actual * 1000) / 10}% actual /{' '}
                  {Math.round(bucket.target * 1000) / 10}% target
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <TargetAllocationForm
          errors={formErrors}
          isSubmitting={isSubmitting}
          onChange={onChange}
          onSubmit={onSubmit}
          values={values}
        />

        {submitErrorMessage ? (
          <p role="alert" style={{ color: palette.statusRed, margin: 0 }}>
            {submitErrorMessage}
          </p>
        ) : null}

        {isSet && onClear ? (
          <div>
            <RiskButton onClick={onClear} variant="secondary">
              Clear target allocation
            </RiskButton>
          </div>
        ) : null}
      </div>
    );
  }
}
