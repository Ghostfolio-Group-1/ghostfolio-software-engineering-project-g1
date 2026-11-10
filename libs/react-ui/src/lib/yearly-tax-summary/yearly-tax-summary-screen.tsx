import { useState } from 'react';
import type { FormEvent } from 'react';

import { DashboardCard } from '../dashboard-card/dashboard-card';
import { ApiRequestError } from '../data/api-request';
import { useApiData } from '../data/use-api-data';
import { YearlyTaxSummaryTable } from './yearly-tax-summary-table';
import type {
  YearlyCostBasisMethod,
  YearlySummaryLoader
} from './yearly-tax-summary.client';
import { parseYearlyTaxSummary } from './yearly-tax-summary.client';

export interface YearlyTaxSummaryScreenProps {
  /** Increment when the host's authentication or portfolio identity changes. */
  authRevision?: number;
  initialMethod?: YearlyCostBasisMethod;
  initialYear?: number;
  /** The host must connect this to an authenticated API after route agreement. */
  load: YearlySummaryLoader;
}

const validYear = (year: number): boolean =>
  Number.isInteger(year) && year >= 1970 && year <= 2100;

function errorMessage(error: Error | null): string {
  if (error instanceof ApiRequestError) {
    switch (error.status) {
      case 401:
        return 'Please sign in to view the yearly Tax summary.';
      case 403:
        return 'You do not have permission to view the yearly Tax summary.';
      case 422:
        return 'The yearly Tax summary could not be calculated.';
      default:
        return error.status >= 500
          ? 'The Tax service is temporarily unavailable.'
          : 'Unable to load the yearly Tax summary.';
    }
  }

  return 'Unable to load the yearly Tax summary.';
}

function YearlySummaryData({
  load,
  method,
  year
}: {
  load: YearlySummaryLoader;
  method: YearlyCostBasisMethod;
  year: number;
}) {
  const { data, error, reload, status } = useApiData(
    async (signal) =>
      parseYearlyTaxSummary(await load({ method, signal, year }), year, method),
    (result) =>
      result.isComplete &&
      result.dividendCount === 0 &&
      result.disposalCount === 0
  );

  if (status === 'ready' && data) {
    return <YearlyTaxSummaryTable summary={data} />;
  }

  const authError =
    error instanceof ApiRequestError &&
    (error.status === 401 || error.status === 403);

  return (
    <DashboardCard
      emptyMessage={`No Tax activities for ${year} using ${method}.`}
      errorMessage={errorMessage(error)}
      onRetry={status === 'error' && !authError ? reload : undefined}
      status={status}
      title="Yearly Tax summary"
    />
  );
}

/**
 * Pure Tax-owned UI. No calculations, token access, or invented HTTP route.
 * A host-provided loader is required to connect this to a live API.
 */
export function YearlyTaxSummaryScreen({
  authRevision = 0,
  initialMethod = 'FIFO',
  initialYear = new Date().getUTCFullYear(),
  load
}: YearlyTaxSummaryScreenProps) {
  const [year, setYear] = useState(initialYear);
  const [draftYear, setDraftYear] = useState(String(initialYear));
  const [method, setMethod] = useState<YearlyCostBasisMethod>(initialMethod);
  const canApply =
    /^\d{4}$/.test(draftYear) &&
    validYear(Number(draftYear)) &&
    Number(draftYear) !== year;

  function submitYear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canApply) {
      setYear(Number(draftYear));
    }
  }

  return (
    <section aria-label="Yearly Tax summary">
      <form onSubmit={submitYear}>
        <label htmlFor="yearly-tax-year">Calendar year (UTC)</label>{' '}
        <input
          id="yearly-tax-year"
          max={2100}
          min={1970}
          onChange={(event) => setDraftYear(event.target.value)}
          required
          step={1}
          type="number"
          value={draftYear}
        />{' '}
        <button disabled={!canApply} type="submit">
          Load year
        </button>
      </form>
      <label htmlFor="yearly-tax-method">Cost-basis method</label>{' '}
      <select
        id="yearly-tax-method"
        onChange={(event) =>
          setMethod(event.target.value as YearlyCostBasisMethod)
        }
        value={method}
      >
        <option value="FIFO">FIFO</option>
        <option value="AVERAGE_COST">Average cost</option>
      </select>
      <YearlySummaryData
        key={`${year}-${method}-${authRevision}`}
        load={load}
        method={method}
        year={year}
      />
    </section>
  );
}
