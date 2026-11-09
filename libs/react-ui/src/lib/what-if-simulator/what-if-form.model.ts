// Pure form logic for the what-if simulator (issue #187, Mon Nov 16).
// Kept free of React so it is trivially unit-testable without a DOM -
// libs/react-ui's jest environment is 'node' (see chart-wrapper.tsx's
// toPath for the same pattern: the math/logic is a plain exported
// function, the component is a thin render around it).
export interface WhatIfFormValues {
  // Client-only label for the user's own reference (issue #187's wireframe
  // asks for a "scenario name"). It is never sent to POST /risk/what-if -
  // Section 6.11 of docs/sesha-notes/10-risk-api-contract.md has no such
  // field; the scenario's display name in the response comes from the
  // matched holding instead.
  scenarioName: string;
  dataSource: string;
  // Held as the raw input string (e.g. "40" meaning 40%) so the field can
  // be empty or a work-in-progress value like "4." while typing; it is only
  // parsed into a 0-1 decimal by toRunWhatIfRequest() once validated.
  dropPercentage: string;
  symbol: string;
}

export interface WhatIfFormErrors {
  dropPercentage?: string;
  symbol?: string;
}

export const DEFAULT_WHAT_IF_DATA_SOURCE = 'YAHOO';

export function createEmptyWhatIfFormValues(): WhatIfFormValues {
  return {
    dataSource: DEFAULT_WHAT_IF_DATA_SOURCE,
    dropPercentage: '',
    scenarioName: '',
    symbol: ''
  };
}

// Mirrors the server-side validation RiskController/WhatIfService apply
// (RISK_WHATIF_INVALID_DROP: "0 or less, above 1, or not a number") so the
// user sees the same rule before a request is ever sent - Section 7 of the
// contract doc, expressed here as a percentage (0, 100] instead of a
// decimal (0, 1] since that's how the field is typed.
export function validateWhatIfForm(values: WhatIfFormValues): WhatIfFormErrors {
  const errors: WhatIfFormErrors = {};

  if (values.symbol.trim() === '') {
    errors.symbol = 'Choose a holding to shock.';
  }

  const trimmedDrop = values.dropPercentage.trim();
  const parsedDrop = Number(trimmedDrop);

  if (trimmedDrop === '' || Number.isNaN(parsedDrop)) {
    errors.dropPercentage = 'Enter a drop percentage.';
  } else if (parsedDrop <= 0 || parsedDrop > 100) {
    errors.dropPercentage =
      'Drop percentage must be greater than 0% and at most 100%.';
  }

  return errors;
}

export function isWhatIfFormValid(values: WhatIfFormValues): boolean {
  return Object.keys(validateWhatIfForm(values)).length === 0;
}

export interface RunWhatIfRequest {
  dataSource: string;
  dropPercentage: number;
  symbol: string;
}

// Only call this once isWhatIfFormValid(values) is true - it assumes
// dropPercentage parses to a number.
export function toRunWhatIfRequest(values: WhatIfFormValues): RunWhatIfRequest {
  return {
    dataSource: values.dataSource,
    dropPercentage: Number(values.dropPercentage.trim()) / 100,
    symbol: values.symbol.trim().toUpperCase()
  };
}
