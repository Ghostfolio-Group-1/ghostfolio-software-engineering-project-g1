import { useEffect, useState } from 'react';

import { useTheme } from '../theme/theme-provider';
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
  const theme = useTheme();
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

  return (
    <li
      style={{
        borderBottom: `1px solid ${theme.color.border}`,
        marginBottom: px(designTokens.spacing.md),
        paddingBottom: px(designTokens.spacing.md)
      }}
    >
      <div style={{ fontWeight: 600 }}>
        {item.name}
        {item.isCustomized ? ' — Customized' : ''}
      </div>
      <label>
        <input
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
          type="checkbox"
        />
        Active
      </label>
      {fields.map((field) => (
        <label
          key={field}
          style={{
            display: 'inline-block',
            marginRight: px(designTokens.spacing.sm)
          }}
        >
          {FIELD_LABEL[field]}
          <input
            aria-label={`${item.ruleKey}-${field}`}
            onChange={(event) => updateField(field, event.target.value)}
            type="number"
            value={values[field]}
          />
          %
        </label>
      ))}
      {validationError ? <p role="alert">{validationError}</p> : null}
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      <button disabled={isSaving} onClick={submit} type="button">
        {isSaving ? 'Saving…' : 'Save'}
      </button>
      {item.isCustomized ? (
        <button disabled={isSaving} onClick={onReset} type="button">
          Reset to default
        </button>
      ) : null}
    </li>
  );
}
