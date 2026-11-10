import { Big } from 'big.js';

import { Table } from '../table/table';
import type { TableColumn } from '../table/table';
import { useTheme } from '../theme/theme-provider';
import { designTokens, px } from '../tokens/design-tokens';

export interface OverviewTaxSale {
  currency: string | null;
  realizedGainAfterActivityFees: string;
  sellActivityId: string;
  sellDate: string;
}

export interface DashboardTaxSummaryProps {
  limit?: number;
  method: string;
  sales: OverviewTaxSale[];
}

/**
 * Sums decimal strings exactly (Big), so the total matches the tax engine.
 * Returns null when sales use more than one currency, since those amounts
 * cannot be added without conversion.
 */
export function totalRealizedGain(sales: OverviewTaxSale[]): {
  currency: string | null;
  total: string;
} | null {
  const currencies = new Set(sales.map(({ currency }) => currency));

  if (currencies.size > 1) {
    return null;
  }

  return {
    currency: sales[0]?.currency ?? null,
    total: sales
      .reduce(
        (sum, { realizedGainAfterActivityFees }) =>
          sum.plus(realizedGainAfterActivityFees),
        new Big(0)
      )
      .toString()
  };
}

// Overview Tax card: realized gain after fees across all sales (exact decimal
// strings) and the most recent sales.
export function DashboardTaxSummary({
  limit = 5,
  method,
  sales
}: DashboardTaxSummaryProps) {
  const theme = useTheme();
  const total = totalRealizedGain(sales);
  const recent = [...sales]
    .sort((a, b) => b.sellDate.localeCompare(a.sellDate))
    .slice(0, limit);
  const columns: TableColumn<OverviewTaxSale>[] = [
    { cell: (sale) => sale.sellDate.slice(0, 10), header: 'Sold', key: 'date' },
    {
      align: 'right',
      cell: (sale) =>
        `${sale.realizedGainAfterActivityFees}${sale.currency ? ` ${sale.currency}` : ''}`,
      header: 'Gain after fees',
      key: 'gain'
    }
  ];

  return (
    <div>
      <p style={{ margin: `0 0 ${px(designTokens.spacing.xs)} 0` }}>
        <strong>
          {total
            ? `${total.total}${total.currency ? ` ${total.currency}` : ''}`
            : 'Mixed currencies'}
        </strong>{' '}
        realized gain after fees
      </p>
      <p
        style={{
          color: theme.color.textMuted,
          margin: `0 0 ${px(designTokens.spacing.sm)} 0`
        }}
      >
        {sales.length} {sales.length === 1 ? 'sale' : 'sales'} · {method}
      </p>
      <Table
        caption="Recent sales"
        columns={columns}
        getRowKey={(sale) => sale.sellActivityId}
        rows={recent}
      />
    </div>
  );
}
