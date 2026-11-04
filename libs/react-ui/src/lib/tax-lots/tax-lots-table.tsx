import { useId, useState } from 'react';

import { DashboardCard } from '../dashboard-card/dashboard-card';
import { Table } from '../table/table';
import type { TableColumn } from '../table/table';
import { TaxLotsApiError, useTaxLots } from './use-tax-lots';
import type { TaxLot, TaxLotsFetch, TaxLotsState } from './use-tax-lots';

export type TaxLotsMethod = 'AVERAGE_COST' | 'FIFO';

export interface TaxLotsTableProps extends TaxLotsState {
  onRetry?: () => void;
}

export interface TaxLotsScreenProps {
  /** An authenticated adapter from the host; native fetch is insufficient. */
  request: TaxLotsFetch;
}

const columns: TableColumn<TaxLot>[] = [
  { cell: (lot) => lot.lotId, header: 'Lot ID', key: 'lotId' },
  { cell: (lot) => lot.symbolProfileId, header: 'Asset ID', key: 'asset' },
  {
    cell: (lot) => lot.acquiredAt.slice(0, 10),
    header: 'Acquired',
    key: 'acquired'
  },
  {
    align: 'right',
    cell: (lot) => lot.originalQuantity,
    header: 'Original quantity',
    key: 'original'
  },
  {
    align: 'right',
    cell: (lot) => lot.consumedQuantity,
    header: 'Consumed quantity',
    key: 'consumed'
  },
  {
    align: 'right',
    cell: (lot) => lot.remainingQuantity,
    header: 'Remaining quantity',
    key: 'remaining'
  },
  { cell: (lot) => lot.status, header: 'Status', key: 'status' },
  {
    cell: (lot) => lot.accountId ?? 'Unassigned',
    header: 'Account ID',
    key: 'account'
  },
  {
    cell: (lot) => lot.sourceActivityId,
    header: 'Source BUY ID',
    key: 'source'
  },
  {
    cell: (lot) => lot.relatedSellActivityIds.join(', ') || '—',
    header: 'Related SELL IDs',
    key: 'sells'
  }
];

/**
 * Feature-only screen wrapper. All tax-lot quantities come from the API;
 * no cost-basis or quantity arithmetic is performed in React.
 */
export function TaxLotsScreen({ request }: TaxLotsScreenProps) {
  const { reload, ...state } = useTaxLots(request);

  return <TaxLotsTable {...state} onRetry={reload} />;
}

/**
 * Tax-owned view using Raniya's shared Table and DashboardCard.
 * GET /tax/lots exposes FIFO acquisition lots only. The average-cost option
 * deliberately does not relabel those FIFO lots as average-cost results.
 */
export function TaxLotsTable({
  data,
  diagnostics,
  error,
  isComplete,
  onRetry,
  status
}: TaxLotsTableProps) {
  const [method, setMethod] = useState<TaxLotsMethod>('FIFO');
  const methodId = useId();
  const averageCostSelected = method === 'AVERAGE_COST';

  const cardStatus = averageCostSelected
    ? 'ready'
    : status === 'empty' && isComplete === false
      ? 'ready'
      : status;

  const errorMessage =
    error instanceof TaxLotsApiError && error.status === 401
      ? 'Please sign in to view tax lots'
      : 'Unable to load tax lots';

  return (
    <div>
      <p>
        <label htmlFor={methodId}>Cost-basis method</label>{' '}
        <select
          id={methodId}
          onChange={(event) =>
            setMethod(event.currentTarget.value as TaxLotsMethod)
          }
          value={method}
        >
          <option value="FIFO">FIFO</option>
          <option value="AVERAGE_COST">Average cost</option>
        </select>
      </p>

      <DashboardCard
        emptyMessage="No FIFO tax lots available"
        errorMessage={errorMessage}
        onRetry={onRetry}
        status={cardStatus}
        title="Tax lots"
      >
        {averageCostSelected ? (
          <p role="status">
            Average cost uses a pooled cost basis, not individual FIFO tax lots.
            The current tax-lots API only returns FIFO lots. Select FIFO to view
            acquisition lots; the average-cost realized-gains view is planned
            for Week 2.
          </p>
        ) : (
          <>
            {isComplete === false ? (
              <p role="alert">
                Some investment history was excluded. These tax-lot results may
                be incomplete.
                {diagnostics.length > 0
                  ? ` (${diagnostics.length} diagnostic${diagnostics.length === 1 ? '' : 's'})`
                  : ''}
              </p>
            ) : null}
            <div style={{ overflowX: 'auto' }}>
              <Table
                caption="FIFO acquisition lots"
                columns={columns}
                emptyMessage="No FIFO lots in the returned data"
                getRowKey={(lot) => lot.lotId}
                rows={data?.lots ?? []}
              />
            </div>
          </>
        )}
      </DashboardCard>
    </div>
  );
}
