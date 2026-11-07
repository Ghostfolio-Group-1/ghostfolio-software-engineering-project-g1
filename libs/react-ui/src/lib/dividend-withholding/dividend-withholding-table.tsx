import { Card } from '../card/card';
import { Table } from '../table/table';
import type { TableColumn } from '../table/table';

/**
 * Presentational counterpart of the Tax domain's DividendRecord.
 * The host must supply Date as ISO text and Big amounts as plain decimal
 * strings. TaxController exposes GET /api/v1/tax/dividends?year=YYYY.
 */
export interface DividendWithholdingViewRecord {
  accountId: string | null;
  activityFee: string;
  date: string;
  grossDividend: string;
  netDividend: string | null;
  sourceActivityId: string;
  symbolProfileId: string;
  transactionCurrency: string | null;
  withholdingTax: string | null;
}

export interface DividendWithholdingTableProps {
  records: DividendWithholdingViewRecord[];
}

const columns: TableColumn<DividendWithholdingViewRecord>[] = [
  {
    cell: (record) => record.date.slice(0, 10),
    header: 'Dividend date',
    key: 'date'
  },
  {
    cell: (record) => record.symbolProfileId,
    header: 'Asset ID',
    key: 'asset'
  },
  {
    cell: (record) => record.transactionCurrency ?? 'Not specified',
    header: 'Transaction currency',
    key: 'currency'
  },
  {
    align: 'right',
    cell: (record) => record.grossDividend,
    header: 'Gross dividend',
    key: 'gross'
  },
  {
    align: 'right',
    cell: (record) => record.withholdingTax ?? 'Not available',
    header: 'Withholding tax',
    key: 'withholding'
  },
  {
    align: 'right',
    cell: (record) => record.netDividend ?? 'Not available',
    header: 'Net dividend',
    key: 'net'
  },
  {
    align: 'right',
    cell: (record) => record.activityFee,
    header: 'Activity fee',
    key: 'fee'
  },
  {
    cell: (record) => record.accountId ?? 'Unassigned',
    header: 'Account ID',
    key: 'account'
  },
  {
    cell: (record) => record.sourceActivityId,
    header: 'Source activity ID',
    key: 'source'
  }
];

/**
 * Tax-owned read-only view. The backend owns dividend calculations.
 * Unknown withholding is not the same as known zero withholding.
 */
export function DividendWithholdingTable({
  records
}: DividendWithholdingTableProps) {
  return (
    <Card title="Dividend withholding">
      <p>
        Amounts are shown in each dividend's transaction currency. Activity fees
        are separate from withholding tax.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <Table
          caption="Dividend amounts from the Tax record"
          columns={columns}
          emptyMessage="No dividend records in the supplied data."
          getRowKey={(record) => record.sourceActivityId}
          rows={records}
        />
      </div>
    </Card>
  );
}
