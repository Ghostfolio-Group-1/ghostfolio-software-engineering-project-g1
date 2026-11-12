// Pure form logic for the target allocation editor, same split as
// what-if-form.model.ts: no React, so it's trivially unit-testable.
export interface TargetAllocationRowValues {
  key: string;
  // Raw input string, e.g. "40" meaning 40% (same "hold as typed, parse on
  // submit" convention as WhatIfFormValues.dropPercentage).
  percentage: string;
}

export interface TargetAllocationFormValues {
  groupBy: string;
  rows: TargetAllocationRowValues[];
}

export interface TargetAllocationGroupByOption {
  label: string;
  value: string;
}

// Mirrors UpdateTargetAllocationDto.groupBy's @IsIn list
// (dtos/update-target-allocation.dto.ts) - kept local so the React library
// has no dependency on the API's own types.
export const TARGET_ALLOCATION_GROUP_BY_OPTIONS: TargetAllocationGroupByOption[] =
  [
    { label: 'Asset class', value: 'assetClass' },
    { label: 'Country', value: 'country' },
    { label: 'Currency', value: 'currency' },
    { label: 'Sector', value: 'sector' },
    { label: 'Symbol', value: 'symbol' }
  ];

const SUM_TOLERANCE = 0.0001;

export function createEmptyTargetAllocationRow(): TargetAllocationRowValues {
  return { key: '', percentage: '' };
}

export function createEmptyTargetAllocationFormValues(): TargetAllocationFormValues {
  return {
    groupBy: TARGET_ALLOCATION_GROUP_BY_OPTIONS[0].value,
    rows: [createEmptyTargetAllocationRow()]
  };
}

export interface TargetAllocationFormErrors {
  // One summary message for the whole row set, same "server's validation
  // rule, expressed client-side" idiom as WhatIfFormErrors.dropPercentage -
  // target-allocation.mapper.ts#validateTargetAllocationInput checks these
  // same things (duplicate keys, range, sum-to-100%) server-side too, this
  // just gives the user the same feedback before a request is ever sent.
  rows?: string;
}

export function validateTargetAllocationForm(
  values: TargetAllocationFormValues
): TargetAllocationFormErrors {
  const keys = values.rows.map((row) => row.key.trim());

  if (keys.some((key) => key === '')) {
    return { rows: 'Every row needs a key.' };
  }

  if (new Set(keys).size !== keys.length) {
    return { rows: 'Each key may only appear once.' };
  }

  const rawPercentages = values.rows.map((row) => row.percentage.trim());

  if (rawPercentages.some((raw) => raw === '')) {
    return { rows: 'Every row needs a percentage.' };
  }

  const percentages = rawPercentages.map((raw) => Number(raw));

  if (percentages.some((percentage) => Number.isNaN(percentage))) {
    return { rows: 'Every row needs a percentage.' };
  }

  if (percentages.some((percentage) => percentage < 0 || percentage > 100)) {
    return { rows: 'Each percentage must be between 0% and 100%.' };
  }

  const sum = percentages.reduce((total, percentage) => total + percentage, 0);

  if (Math.abs(sum - 100) > SUM_TOLERANCE * 100) {
    return {
      rows: `Percentages must add up to 100%. They currently add up to ${Math.round(sum * 10) / 10}%.`
    };
  }

  return {};
}

export function isTargetAllocationFormValid(
  values: TargetAllocationFormValues
): boolean {
  return Object.keys(validateTargetAllocationForm(values)).length === 0;
}

export interface UpdateTargetAllocationRequest {
  groupBy: string;
  targets: { key: string; percentage: number }[];
}

// Only call this once isTargetAllocationFormValid(values) is true.
export function toUpdateTargetAllocationRequest(
  values: TargetAllocationFormValues
): UpdateTargetAllocationRequest {
  return {
    groupBy: values.groupBy,
    targets: values.rows.map((row) => ({
      key: row.key.trim(),
      percentage: Number(row.percentage.trim()) / 100
    }))
  };
}
