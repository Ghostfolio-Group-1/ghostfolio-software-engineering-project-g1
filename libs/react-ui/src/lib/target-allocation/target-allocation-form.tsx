import { useRiskPalette } from '../risk-ui/risk-palette';
import { PercentField, RiskButton, TextField } from '../risk-ui/risk-ui';
import { designTokens, px } from '../tokens/design-tokens';
import type {
  TargetAllocationFormErrors,
  TargetAllocationFormValues,
  TargetAllocationRowValues
} from './target-allocation-form.model';
import {
  TARGET_ALLOCATION_GROUP_BY_OPTIONS,
  createEmptyTargetAllocationRow
} from './target-allocation-form.model';

// Live total, purely a display aid - validateTargetAllocationForm (the
// actual sum-to-100% rule enforced on submit) is untouched.
function totalPercentage(rows: TargetAllocationRowValues[]): number {
  return rows.reduce((total, row) => {
    const value = Number(row.percentage.trim());
    return total + (Number.isNaN(value) ? 0 : value);
  }, 0);
}

export interface TargetAllocationFormProps {
  errors?: TargetAllocationFormErrors;
  isSubmitting?: boolean;
  onChange: (values: TargetAllocationFormValues) => void;
  onSubmit: () => void;
  values: TargetAllocationFormValues;
}

// Controlled, stateless form (same shape as WhatIfSimulatorForm) - all
// client-side validation lives in target-allocation-form.model.ts and is
// unit-tested there directly, not here.
export function TargetAllocationForm({
  errors,
  isSubmitting = false,
  onChange,
  onSubmit,
  values
}: TargetAllocationFormProps) {
  function updateRow(index: number, row: Partial<TargetAllocationRowValues>) {
    onChange({
      ...values,
      rows: values.rows.map((existing, existingIndex) =>
        existingIndex === index ? { ...existing, ...row } : existing
      )
    });
  }

  function addRow() {
    onChange({
      ...values,
      rows: [...values.rows, createEmptyTargetAllocationRow()]
    });
  }

  function removeRow(index: number) {
    onChange({
      ...values,
      rows: values.rows.filter((_row, existingIndex) => existingIndex !== index)
    });
  }

  const total = totalPercentage(values.rows);
  const totalIsComplete = Math.abs(total - 100) < 0.05;
  const palette = useRiskPalette();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: px(designTokens.spacing.sm)
      }}
    >
      <label
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: px(designTokens.spacing.xs)
        }}
      >
        <span>Group by</span>
        <select
          onChange={(event) =>
            onChange({ ...values, groupBy: event.target.value })
          }
          style={{
            backgroundColor: palette.bgElevated,
            border: `1px solid ${palette.border}`,
            borderRadius: 10,
            color: palette.textPrimary,
            height: 40,
            padding: `0 ${px(designTokens.spacing.sm)}`
          }}
          value={values.groupBy}
        >
          {TARGET_ALLOCATION_GROUP_BY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {values.rows.map((row, index) => (
        // No stable id on a row until it has a key, and rows are only
        // ever added/removed at the end or by explicit index - positional
        // keys are safe here, unlike a list of server-sourced items.
        <div
          key={index}
          style={{
            alignItems: 'center',
            display: 'flex',
            gap: px(designTokens.spacing.sm)
          }}
        >
          {/* Every row used to share the literal aria-label "Key" /
              "Percentage" - fine with one row, but with several (the normal
              case for a real target allocation) a screen reader announces
              the same name for every row with no way to tell them apart.
              The row number makes each one unique (Mon 11/23 usability
              pass). */}
          <TextField
            aria-label={`Key (row ${index + 1})`}
            onChange={(value) => updateRow(index, { key: value })}
            placeholder="e.g. EQUITY"
            value={row.key}
          />
          <PercentField
            aria-label={`Percentage (row ${index + 1})`}
            max={100}
            min={0}
            onChange={(value) => updateRow(index, { percentage: value })}
            placeholder="e.g. 60"
            value={row.percentage}
          />
          {values.rows.length > 1 ? (
            <RiskButton onClick={() => removeRow(index)} variant="secondary">
              Remove
            </RiskButton>
          ) : null}
        </div>
      ))}

      {errors?.rows ? (
        <p role="alert" style={{ color: designTokens.color.danger, margin: 0 }}>
          {errors.rows}
        </p>
      ) : null}

      {/* Live total, purely a display aid alongside the server-equivalent
          validation message above - not itself a validation gate. */}
      <p
        style={{
          color: totalIsComplete ? palette.textMuted : palette.statusRed,
          fontWeight: 600,
          margin: 0
        }}
      >
        Total: {Math.round(total * 10) / 10}% / 100%
      </p>

      <div
        style={{
          display: 'flex',
          gap: px(designTokens.spacing.sm)
        }}
      >
        <RiskButton onClick={addRow} variant="secondary">
          Add row
        </RiskButton>
        <RiskButton
          disabled={isSubmitting}
          onClick={onSubmit}
          variant="primary"
        >
          {isSubmitting ? 'Saving…' : 'Save target allocation'}
        </RiskButton>
      </div>
    </div>
  );
}
