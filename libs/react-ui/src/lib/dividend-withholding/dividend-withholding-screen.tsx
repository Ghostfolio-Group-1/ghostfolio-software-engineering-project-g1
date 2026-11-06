import { useState } from 'react';
import type { FormEvent } from 'react';

import { DashboardCard } from '../dashboard-card/dashboard-card';
import type { AuthenticatedFetch } from '../data/api-request';
import { ApiRequestError } from '../data/api-request';
import { useApiData } from '../data/use-api-data';
import { DividendWithholdingTable } from './dividend-withholding-table';
import {
  fetchDividendWithholding,
  isValidDividendYear
} from './dividend-withholding.client';

export interface DividendWithholdingScreenProps {
  /** Increments when the host's authenticated identity or portfolio changes. */
  authRevision?: number;
  initialYear?: number;
  request: AuthenticatedFetch;
}

function getErrorMessage(error: Error | null): string {
  if (error instanceof ApiRequestError) {
    switch (error.status) {
      case 401:
        return 'Please sign in to view dividend records.';
      case 403:
        return 'You do not have permission to view dividend records.';
      case 422:
        return 'Dividend records could not be loaded for this year.';
      default:
        return error.status >= 500
          ? 'The dividend service is temporarily unavailable.'
          : 'Unable to load dividend records.';
    }
  }

  return 'Unable to load dividend records.';
}

/** Isolated per-year loader: a year or auth change aborts the old request. */
function DividendYearData({
  request,
  year
}: {
  request: AuthenticatedFetch;
  year: number;
}) {
  const { data, error, reload, status } = useApiData(
    (signal) => fetchDividendWithholding(request, year, signal),
    (result) => result.records.length === 0
  );

  if (status === 'ready' && data) {
    // The table owns its ready-state Card; do not nest it in DashboardCard.
    return <DividendWithholdingTable records={data.records} />;
  }

  const isAuthFailure =
    error instanceof ApiRequestError &&
    (error.status === 401 || error.status === 403);

  return (
    <DashboardCard
      emptyMessage={`No tax-relevant dividend records for ${year}.`}
      errorMessage={getErrorMessage(error)}
      onRetry={status === 'error' && !isAuthFailure ? reload : undefined}
      status={status}
      title="Dividend withholding"
    />
  );
}

/**
 * Tax-owned screen. Production callers must inject the authenticated host
 * request; tests inject a synthetic adapter. Calendar year is UTC, matching
 * the backend query, and records are displayed without Date conversion.
 */
export function DividendWithholdingScreen({
  authRevision = 0,
  initialYear = new Date().getUTCFullYear(),
  request
}: DividendWithholdingScreenProps) {
  const [year, setYear] = useState(initialYear);
  const [draftYear, setDraftYear] = useState(String(initialYear));
  const canLoad =
    /^[1-9]\d{3}$/.test(draftYear) &&
    isValidDividendYear(Number(draftYear)) &&
    Number(draftYear) !== year;

  function applyYear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canLoad) {
      setYear(Number(draftYear));
    }
  }

  return (
    <section aria-label="Dividend withholding records">
      <form onSubmit={applyYear}>
        <label htmlFor="dividend-tax-year">Calendar year (UTC)</label>{' '}
        <input
          id="dividend-tax-year"
          max={9999}
          min={1000}
          onChange={(event) => setDraftYear(event.target.value)}
          required
          step={1}
          type="number"
          value={draftYear}
        />{' '}
        <button disabled={!canLoad} type="submit">
          Load year
        </button>
      </form>
      <DividendYearData
        key={`${year}-${authRevision}`}
        request={request}
        year={year}
      />
    </section>
  );
}
