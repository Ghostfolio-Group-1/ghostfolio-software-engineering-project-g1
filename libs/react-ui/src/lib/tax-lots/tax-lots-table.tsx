import { useId, useState } from 'react';

import { DashboardCard } from '../dashboard-card/dashboard-card';
import { Table } from '../table/table';
import type { TableColumn } from '../table/table';
import { TaxLotsApiError, useTaxLots } from './use-tax-lots';
import type { TaxLot, TaxLotsFetch, TaxLotsState } from './use-tax-lots';

export type TaxLotsMethod = 'AVERAGE_COST' | 'FIFO';
export type TaxLotStatusFilter = 'ALL' | 'OPEN';

export interface TaxLotsTableProps extends TaxLotsState {
  method?: TaxLotsMethod;
  onMethodChange?: (method: TaxLotsMethod) => void;
  onRetry?: () => void;
  onStatusFilterChange?: (filter: TaxLotStatusFilter) => void;
  statusFilter?: TaxLotStatusFilter;
}

export interface TaxLotsScreenProps {
  /** An authenticated adapter supplied by the host; native fetch alone is insufficient. */
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

function getSafeErrorMessage(error: Error | null): string {
  if (error instanceof TaxLotsApiError) {
    switch (error.status) {
      case 401:
        return 'Please sign in again to view your tax lots.';
      case 403:
        return 'You do not have permission to view these tax lots.';
      case 422:
        return 'The tax-lot history could not be processed. Check your investment transactions.';
      default:
        if (error.status >= 500) {
          return 'The tax service is temporarily unavailable. Please try again later.';
        }
    }
  }

  return 'Unable to load tax lots. Please try again.';
}

function canRetry(error: Error | null): boolean {
  if (error instanceof TaxLotsApiError) {
    return error.status >= 500 || error.status === 408 || error.status === 429;
  }

  // Network problems may be transient.
  return true;
}

/**
 * Tax-owned data wrapper. The host supplies an authenticated request.
 * Keep filter/method state here rather than in the presentational table.
 */
export function TaxLotsScreen({ request }: TaxLotsScreenProps) {
  const { reload, ...state } = useTaxLots(request);
  const [method, setMethod] = useState<TaxLotsMethod>('FIFO');
  const [statusFilter, setStatusFilter] = useState<TaxLotStatusFilter>('OPEN');

  return (
    <TaxLotsTable
      {...state}
      method={method}
      onMethodChange={setMethod}
      onRetry={reload}
      onStatusFilterChange={setStatusFilter}
      statusFilter={statusFilter}
    />
  );
}

/**
 * Tax-owned view using Raniya's shared Table and DashboardCard.
 * GET /tax/lots only exposes FIFO acquisition lots; average-cost lots are
 * deliberately unavailable until a suitable data source exists.
 */
export function TaxLotsTable({
  data,
  diagnostics,
  error,
  isComplete,
  method = 'FIFO',
  onMethodChange,
  onRetry,
  onStatusFilterChange,
  status,
  statusFilter = 'OPEN'
}: TaxLotsTableProps) {
  const methodId = useId();
  const filterId = useId();

  const cardStatus =
    status === 'empty' && isComplete === false ? 'ready' : status;
  const selectedLots = (data?.lots ?? [])
    .filter((lot) => statusFilter === 'ALL' || lot.status !== 'CLOSED')
    .sort(
      (left, right) =>
        left.acquiredAt.localeCompare(right.acquiredAt) ||
        left.lotId.localeCompare(right.lotId)
    );

  return (
    <div>
      <p>
        <label htmlFor={methodId}>Cost-basis method</label>{' '}
        <select
          id={methodId}
          onChange={(event) => {
            if (event.currentTarget.value === 'FIFO') {
              onMethodChange?.('FIFO');
            }
          }}
          value={method}
        >
          <option value="FIFO">FIFO</option>
          <option disabled value="AVERAGE_COST">
            Average cost (not available for tax lots)
          </option>
        </select>
        <span> Individual acquisition lots are available for FIFO only.</span>
      </p>

      <DashboardCard
        emptyMessage="No FIFO tax lots available"
        errorMessage={getSafeErrorMessage(error)}
        onRetry={status === 'error' && canRetry(error) ? onRetry : undefined}
        status={cardStatus}
        title="Tax lots"
      >
        {isComplete === false ? (
          <div role="alert">
            <p>
              Some investment history was excluded. These tax-lot results may be
              incomplete.
            </p>
            {diagnostics.length > 0 ? (
              <details>
                <summary>
                  View exclusion details ({diagnostics.length}{' '}
                  {diagnostics.length === 1 ? 'diagnostic' : 'diagnostics'})
                </summary>
                <ul>
                  {diagnostics.map((diagnostic, index) => (
                    <li key={`${diagnostic.code}-${index}`}>
                      <p>{diagnostic.message}</p>
                      <p>
                        Affected SELL activity IDs:{' '}
                        {diagnostic.affectedSellActivityIds.join(', ') ||
                          'None'}
                      </p>
                      <p>
                        Excluded activity IDs:{' '}
                        {diagnostic.excludedActivityIds.join(', ') || 'None'}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            ) : (
              <p>No exclusion details were provided by the API.</p>
            )}
          </div>
        ) : null}

        <p>
          <label htmlFor={filterId}>Lot status</label>{' '}
          <select
            id={filterId}
            onChange={(event) =>
              onStatusFilterChange?.(
                event.currentTarget.value as TaxLotStatusFilter
              )
            }
            value={statusFilter}
          >
            <option value="OPEN">Open and partially consumed</option>
            <option value="ALL">All lots (including closed)</option>
          </select>
        </p>
        <div style={{ overflowX: 'auto' }}>
          <Table
            caption="FIFO acquisition lots, ordered by acquisition date"
            columns={columns}
            emptyMessage={
              statusFilter === 'OPEN'
                ? 'No open FIFO lots in the returned data'
                : 'No FIFO lots in the returned data'
            }
            getRowKey={(lot) => lot.lotId}
            rows={selectedLots}
          />
        </div>
      </DashboardCard>
    </div>
  );
}
