import { Card } from '../card/card';
import { Table } from '../table/table';
import type { TableColumn } from '../table/table';
import type {
  RealizedGainSale,
  RealizedGainsData
} from './realized-gains.client';

export interface RealizedGainsTableProps {
  data: RealizedGainsData;
}

const columns: TableColumn<RealizedGainSale>[] = [
  {
    cell: (sale) => sale.sellDate.slice(0, 10),
    header: 'Sale date (UTC)',
    key: 'date'
  },
  {
    cell: (sale) => sale.sellActivityId,
    header: 'SELL activity ID',
    key: 'sell'
  },
  {
    cell: (sale) => sale.currency ?? 'Not specified',
    header: 'Transaction currency',
    key: 'currency'
  },
  {
    align: 'right',
    cell: (sale) => sale.sellQuantity,
    header: 'Sold quantity',
    key: 'sold'
  },
  {
    align: 'right',
    cell: (sale) => sale.matchedQuantity,
    header: 'Matched quantity',
    key: 'matched'
  },
  {
    align: 'right',
    cell: (sale) => sale.grossProceeds,
    header: 'Gross proceeds',
    key: 'proceeds'
  },
  {
    align: 'right',
    cell: (sale) => sale.grossCostBasis,
    header: 'Gross cost basis',
    key: 'basis'
  },
  {
    align: 'right',
    cell: (sale) => sale.grossRealizedGain,
    header: 'Gross realized gain',
    key: 'grossGain'
  },
  {
    align: 'right',
    cell: (sale) => sale.allocatedAcquisitionFees,
    header: 'Allocated acquisition fees',
    key: 'buyFees'
  },
  {
    align: 'right',
    cell: (sale) => sale.allocatedSellFee,
    header: 'Allocated sell fee',
    key: 'sellFees'
  },
  {
    align: 'right',
    cell: (sale) => sale.realizedGainAfterActivityFees,
    header: 'Gain after activity fees',
    key: 'netGain'
  }
];

/** Table only displays authoritative per-sale amounts, never sums currencies. */
export function RealizedGainsTable({ data }: RealizedGainsTableProps) {
  const rows = [...data.sales].sort((a, b) => {
    if (a.sellDate !== b.sellDate) {
      return a.sellDate < b.sellDate ? -1 : 1;
    }
    return a.sellActivityId < b.sellActivityId
      ? -1
      : a.sellActivityId > b.sellActivityId
        ? 1
        : 0;
  });

  return (
    <Card title={`Realized capital gains (${data.method})`}>
      <p>
        These are realized sales included by the backend Tax eligibility rules.
        Amounts are shown in each sale's transaction currency; values from
        different currencies are not added together.
      </p>
      {data.isComplete === false ? (
        <div role="alert">
          <p>
            Tax results may be incomplete because investment history was
            excluded.
          </p>
          {data.diagnostics?.length ? (
            <details>
              <summary>View exclusion details</summary>
              {data.diagnostics.map((diagnostic) => (
                <div key={diagnostic.code}>
                  <p>{diagnostic.message}</p>
                  <p>
                    Affected SELL IDs:{' '}
                    {diagnostic.affectedSellActivityIds.join(', ') ||
                      'None provided'}
                  </p>
                  <p>
                    Excluded activity IDs:{' '}
                    {diagnostic.excludedActivityIds.join(', ') ||
                      'None provided'}
                  </p>
                </div>
              ))}
            </details>
          ) : (
            <p>No exclusion details were provided.</p>
          )}
        </div>
      ) : null}
      <div style={{ overflowX: 'auto' }}>
        <Table
          caption="Realized-gain amounts provided by the Tax API"
          columns={columns}
          emptyMessage="No sales available in the included history."
          getRowKey={(sale) => sale.sellActivityId}
          rows={rows}
        />
      </div>
    </Card>
  );
}
