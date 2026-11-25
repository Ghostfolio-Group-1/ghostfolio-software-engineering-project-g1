import { useEffect, useState } from 'react';

import { useRiskPalette } from '../risk-ui/risk-palette';
import { PercentField, RangeBar, RiskButton, Toggle } from '../risk-ui/risk-ui';
import { designTokens, px } from '../tokens/design-tokens';
import {
  createThresholdRowFormValues,
  thresholdFieldsForShape,
  validateThresholdRowForm
} from './risk-threshold-row-form.model';
import type { ThresholdRowFormValues } from './risk-threshold-row-form.model';
import type { RiskThresholdItem } from './risk-thresholds.client';

const FIELD_LABEL: Record<keyof ThresholdRowFormValues, string> = {
  max: 'Warning max',
  min: 'Warning min',
  redMax: 'Red max',
  redMin: 'Red min'
};

export interface RiskThresholdRowProps {
  errorMessage?: string;
  isSaving?: boolean;
  item: RiskThresholdItem;
  onReset: () => void;
  onSave: (isActive: boolean, values: ThresholdRowFormValues) => void;
}

// Each row owns its own edit buffer (isActive + the shape's threshold
// fields as percentage strings) rather than the page lifting it up - the
// rows are independent, so there is nothing to coordinate across them
// (same reasoning as RiskWarningsList's rows, just with local edit state
// added). The buffer re-seeds from `item` whenever the server value it
// reflects changes, so a save/reset on this row (or a background reload)
// is picked up without wiping an in-progress edit on another row.
export function RiskThresholdRow({
  errorMessage,
  isSaving,
  item,
  onReset,
  onSave
}: RiskThresholdRowProps) {
  const palette = useRiskPalette();
  const [values, setValues] = useState<ThresholdRowFormValues>(() =>
    createThresholdRowFormValues(item.thresholds)
  );
  const [isActive, setIsActive] = useState(item.isActive);
  const [validationError, setValidationError] = useState<string>();

  useEffect(() => {
    setValues(createThresholdRowFormValues(item.thresholds));
    setIsActive(item.isActive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    item.thresholds.max,
    item.thresholds.min,
    item.thresholds.redMax,
    item.thresholds.redMin,
    item.isActive
  ]);

  const fields = thresholdFieldsForShape(item.shape);

  function updateField(field: keyof ThresholdRowFormValues, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
  }

  function submit() {
    const error = validateThresholdRowForm(item.shape, values);

    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError(undefined);
    onSave(isActive, values);
  }

  const rangeBarProps =
    item.shape === 'band'
      ? {
          redMax: item.thresholds.redMax,
          redMin: item.thresholds.redMin ?? 0,
          warnMax: item.thresholds.max,
          warnMin: item.thresholds.min
        }
      : {
          redMax: item.thresholds.redMax,
          redMin: 0,
          warnMax: item.thresholds.max
        };

  return (
    <li
      style={{
        borderBottom: `1px solid ${palette.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: px(designTokens.spacing.sm),
        marginBottom: px(designTokens.spacing.md),
        paddingBottom: px(designTokens.spacing.md)
      }}
    >
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          justifyContent: 'space-between'
        }}
      >
        <div>
          <span style={{ fontWeight: 600 }}>{item.name}</span>
          {item.isCustomized ? (
            <span
              style={{
                color: palette.textMuted,
                fontWeight: 400,
                marginLeft: px(designTokens.spacing.xs)
              }}
            >
              — Customized
            </span>
          ) : null}
        </div>
        {/* A real checkbox under the hood (Toggle), so this stays the same
            input[type="checkbox"] element and "Active" label text every
            existing test already queries for - only its look changes. */}
        <Toggle checked={isActive} label="Active" onChange={setIsActive} />
      </div>

      <RangeBar {...rangeBarProps} />

      <div
        style={{
          display: 'grid',
          gap: px(designTokens.spacing.sm),
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))'
        }}
      >
        {fields.map((field) => (
          // The nested label text alone ("Red max") is identical across
          // every rule's row, so a screen reader can't tell which rule an
          // input belongs to - the explicit aria-label disambiguates with
          // the rule's name (Mon 11/23 usability pass).
          <PercentField
            aria-label={`${item.name} ${FIELD_LABEL[field]}`}
            key={field}
            label={FIELD_LABEL[field]}
            onChange={(value) => updateField(field, value)}
            value={values[field]}
          />
        ))}
      </div>

      {validationError ? <p role="alert">{validationError}</p> : null}
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}

      <div style={{ display: 'flex', gap: px(designTokens.spacing.sm) }}>
        <RiskButton disabled={isSaving} onClick={submit} variant="primary">
          {isSaving ? 'Saving…' : 'Save'}
        </RiskButton>
        {item.isCustomized ? (
          <RiskButton disabled={isSaving} onClick={onReset} variant="ghost">
            Reset to default
          </RiskButton>
        ) : null}
      </div>
    </li>
  );
}
