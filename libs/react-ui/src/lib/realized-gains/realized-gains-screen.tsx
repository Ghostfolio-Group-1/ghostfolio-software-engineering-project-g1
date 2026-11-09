import { useState } from 'react';

import { DashboardCard } from '../dashboard-card/dashboard-card';
import type { AuthenticatedFetch } from '../data/api-request';
import { ApiRequestError } from '../data/api-request';
import { useApiData } from '../data/use-api-data';
import { RealizedGainsTable } from './realized-gains-table';
import { fetchRealizedGains } from './realized-gains.client';
import type { RealizedGainsMethod } from './realized-gains.client';

export interface RealizedGainsScreenProps {
  /** Increment when the authenticated user/impersonation context changes. */
  authRevision?: number;
  initialMethod?: RealizedGainsMethod;
  request: AuthenticatedFetch;
}

function safeErrorMessage(error: Error | null): string {
  if (error instanceof ApiRequestError) {
    switch (error.status) {
      case 401:
        return 'Please sign in to view realized gains.';
      case 403:
        return 'You do not have permission to view realized gains.';
      case 422:
        return 'The investment history could not be processed for realized gains.';
      default:
        return error.status >= 500
          ? 'The Tax service is temporarily unavailable.'
          : 'Unable to load realized gains.';
    }
  }
  return 'Unable to load realized gains.';
}

function MethodData({
  method,
  request
}: {
  method: RealizedGainsMethod;
  request: AuthenticatedFetch;
}) {
  const { data, error, reload, status } = useApiData(
    (signal) => fetchRealizedGains(request, method, signal),
    (result) => result.isComplete !== false && result.sales.length === 0
  );

  if (status === 'ready' && data) {
    return <RealizedGainsTable data={data} />;
  }

  const isAuthFailure =
    error instanceof ApiRequestError &&
    (error.status === 401 || error.status === 403);

  return (
    <DashboardCard
      emptyMessage={`No realized sales for ${method}.`}
      errorMessage={safeErrorMessage(error)}
      onRetry={status === 'error' && !isAuthFailure ? reload : undefined}
      status={status}
      title="Realized capital gains"
    />
  );
}

/**
 * Tax-owned UI. The backend decides tax relevance and calculates the gains;
 * there is no public tax-relevance query parameter to offer as a toggle yet.
 */
export function RealizedGainsScreen({
  authRevision = 0,
  initialMethod = 'FIFO',
  request
}: RealizedGainsScreenProps) {
  const [method, setMethod] = useState<RealizedGainsMethod>(initialMethod);

  return (
    <section aria-label="Realized capital gains">
      <label htmlFor="realized-gains-method">Cost-basis method</label>{' '}
      <select
        id="realized-gains-method"
        onChange={(event) =>
          setMethod(event.target.value as RealizedGainsMethod)
        }
        value={method}
      >
        <option value="FIFO">FIFO</option>
        <option value="AVERAGE_COST">Average cost</option>
      </select>
      <MethodData
        key={`${method}-${authRevision}`}
        method={method}
        request={request}
      />
    </section>
  );
}
