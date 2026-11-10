import { Card } from '../card/card';
import { Table } from '../table/table';
import type { TableColumn } from '../table/table';
import type {
  YearlyCurrencySummary,
  YearlyTaxSummaryData
} from './yearly-tax-summary.client';

const money = (value: string | null): string => value ?? 'Not available';

const columns: TableColumn<YearlyCurrencySummary>[] = [
  {
    cell: (row) => row.currency ?? 'Unspecified',
    header: 'Transaction currency',
    key: 'currency'
  },
  {
    align: 'right',
    cell: (row) => row.totalGrossDividends,
    header: 'Gross dividends',
    key: 'dividends'
  },
  {
    align: 'right',
    cell: (row) => money(row.totalWithholdingTax),
    header: 'Withholding',
    key: 'withholding'
  },
  {
    align: 'right',
    cell: (row) => money(row.totalNetDividends),
    header: 'Net dividends',
    key: 'net'
  },
  {
    align: 'right',
    cell: (row) => row.grossRealizedGain,
    header: 'Gross realized gain',
    key: 'gain'
  },
  {
    align: 'right',
    cell: (row) => row.allocatedFees,
    header: 'Allocated fees',
    key: 'fees'
  },
  {
    align: 'right',
    cell: (row) => row.realizedGainAfterActivityFees,
    header: 'Realized gain after fees',
    key: 'afterFees'
  }
];

const totals: { field: keyof YearlyTaxSummaryData; label: string }[] = [
  { field: 'grossDividendsBaseCurrency', label: 'Gross dividends' },
  { field: 'totalWithholdingTaxBaseCurrency', label: 'Withholding tax' },
  { field: 'netDividendsBaseCurrency', label: 'Net dividends' },
  { field: 'grossProceedsBaseCurrency', label: 'Gross proceeds' },
  { field: 'grossCostBasisBaseCurrency', label: 'Gross cost basis' },
  { field: 'grossRealizedGainBaseCurrency', label: 'Gross realized gain' },
  { field: 'totalActivityFeesBaseCurrency', label: 'Total activity fees' },
  {
    field: 'realizedGainAfterActivityFeesBaseCurrency',
    label: 'Realized gain after activity fees'
  }
];

export function YearlyTaxSummaryTable({
  summary
}: {
  summary: YearlyTaxSummaryData;
}) {
  return (
    <Card title={`Yearly Tax summary — ${summary.year}`}>
      <p>
        Cost-basis method: {summary.method}. Base currency:{' '}
        {summary.baseCurrency}. Calculated (UTC):{' '}
        {summary.calculatedAt.slice(0, 10)}.
      </p>
      <p>
        Dividend records: {summary.dividendCount}. Disposals:{' '}
        {summary.disposalCount}.
      </p>
      {!summary.isComplete ? (
        <div role="alert">
          <p>
            This yearly Tax summary is incomplete. Missing FX rates, unknown
            withholding or excluded investment history may affect totals. An
            unavailable amount is not zero.
          </p>
          {summary.warnings.length > 0 ? (
            <ul>
              {summary.warnings.map((warning, index) => (
                <li key={`warning-${index}`}>
                  {warning.code}: {warning.message}
                </li>
              ))}
            </ul>
          ) : null}
          {summary.errors.length > 0 ? (
            <ul>
              {summary.errors.map((error, index) => (
                <li key={`error-${index}`}>
                  {error.code}: {error.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <h3>Annual totals ({summary.baseCurrency})</h3>
      <dl>
        {totals.map(({ field, label }) => (
          <div key={field}>
            <dt>{label}</dt>
            <dd>{money(summary[field] as string | null)}</dd>
          </div>
        ))}
      </dl>
      <h3>Transaction-currency breakdown</h3>
      <p>Amounts in the following table are not added across currencies.</p>
      <div style={{ overflowX: 'auto' }}>
        <Table
          caption="Authoritative per-currency Tax totals"
          columns={columns}
          emptyMessage="No transaction-currency summaries available."
          getRowKey={(row) => row.currency ?? '__unknown__'}
          rows={summary.currencySummaries}
        />
      </div>
    </Card>
  );
}
