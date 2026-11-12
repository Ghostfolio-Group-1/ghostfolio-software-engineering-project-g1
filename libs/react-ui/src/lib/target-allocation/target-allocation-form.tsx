import { Button } from '../button/button';
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
          <input
            aria-label="Key"
            onChange={(event) => updateRow(index, { key: event.target.value })}
            placeholder="e.g. EQUITY"
            type="text"
            value={row.key}
          />
          <input
            aria-label="Percentage"
            max={100}
            min={0}
            onChange={(event) =>
              updateRow(index, { percentage: event.target.value })
            }
            placeholder="e.g. 60"
            type="number"
            value={row.percentage}
          />
          <span style={{ color: designTokens.color.textMuted }}>%</span>
          {values.rows.length > 1 ? (
            <Button onClick={() => removeRow(index)} variant="secondary">
              Remove
            </Button>
          ) : null}
        </div>
      ))}

      {errors?.rows ? (
        <p role="alert" style={{ color: designTokens.color.danger, margin: 0 }}>
          {errors.rows}
        </p>
      ) : null}

      <div
        style={{
          display: 'flex',
          gap: px(designTokens.spacing.sm)
        }}
      >
        <Button onClick={addRow} variant="secondary">
          Add row
        </Button>
        <Button disabled={isSubmitting} onClick={onSubmit} variant="primary">
          {isSubmitting ? 'Saving…' : 'Save target allocation'}
        </Button>
      </div>
    </div>
  );
}
