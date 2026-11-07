import { RiskWarning } from './interfaces/risk-warning.interface';

// Spec: docs/sesha-notes/10-risk-api-contract.md, Section 6.3.
export const DEFAULT_WARNINGS_PAGE = 1;
export const DEFAULT_WARNINGS_PAGE_SIZE = 25;
export const MAX_WARNINGS_PAGE_SIZE = 100;

export interface WarningsQuery {
  page: number;
  pageSize: number;
  severity?: 'RED' | 'YELLOW';
}

// Mirrors parseConcentrationLimit's contract: returns null on anything that
// doesn't satisfy the doc's query rules, so the controller can turn that
// into a single RISK_INVALID_QUERY envelope.
export function parseWarningsQuery({
  page,
  pageSize,
  severity
}: {
  page?: string;
  pageSize?: string;
  severity?: string;
}): WarningsQuery | null {
  if (severity !== undefined && severity !== 'RED' && severity !== 'YELLOW') {
    return null;
  }

  const parsedPage = parsePositiveInt(page, DEFAULT_WARNINGS_PAGE, {
    min: 1
  });

  if (parsedPage === null) {
    return null;
  }

  const parsedPageSize = parsePositiveInt(
    pageSize,
    DEFAULT_WARNINGS_PAGE_SIZE,
    { max: MAX_WARNINGS_PAGE_SIZE, min: 1 }
  );

  if (parsedPageSize === null) {
    return null;
  }

  return {
    page: parsedPage,
    pageSize: parsedPageSize,
    severity: severity as 'RED' | 'YELLOW' | undefined
  };
}

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  { max, min }: { max?: number; min: number }
): number | null {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < min || (max && parsed > max)) {
    return null;
  }

  return parsed;
}

export function paginateWarnings(
  warnings: RiskWarning[],
  { page, pageSize, severity }: WarningsQuery
): { items: RiskWarning[]; total: number } {
  const filtered = severity
    ? warnings.filter((warning) => warning.severity === severity)
    : warnings;
  const start = (page - 1) * pageSize;

  return {
    items: filtered.slice(start, start + pageSize),
    total: filtered.length
  };
}
