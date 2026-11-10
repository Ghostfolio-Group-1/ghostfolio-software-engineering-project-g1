import { Table } from '../table/table';
import type { TableColumn } from '../table/table';
import { useTheme } from '../theme/theme-provider';
import { designTokens, px } from '../tokens/design-tokens';

export type OverviewRiskSeverity = 'GREEN' | 'NO_DATA' | 'RED' | 'YELLOW';

export interface OverviewRiskBucket {
  name: string;
  /** Share of the portfolio as a fraction (0.42 = 42%), as the API sends it. */
  percentage: number;
  severity: OverviewRiskSeverity;
}

export interface DashboardRiskSummaryProps {
  buckets: OverviewRiskBucket[];
  limit?: number;
}

export const RISK_SEVERITY_LABELS: Record<OverviewRiskSeverity, string> = {
  GREEN: 'OK',
  NO_DATA: 'No data',
  RED: 'High',
  YELLOW: 'Watch'
};

// Overview Risk card: largest single-stock positions with their concentration
// severity. Severity is always shown as text, not colour alone. While the API
// sends NO_DATA for every bucket (no threshold evaluation yet), the card shows
// shares only and makes no claim about limits.
export function DashboardRiskSummary({
  buckets,
  limit = 5
}: DashboardRiskSummaryProps) {
  const theme = useTheme();
  const rows = [...buckets]
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, limit);
  const hasSeverity = rows.some(({ severity }) => severity !== 'NO_DATA');
  const highest = rows.find(({ severity }) => severity === 'RED');
  const severityColor: Record<OverviewRiskSeverity, string> = {
    GREEN: designTokens.color.success,
    NO_DATA: theme.color.textMuted,
    RED: designTokens.color.danger,
    YELLOW: designTokens.color.warning
  };
  const shareColumns: TableColumn<OverviewRiskBucket>[] = [
    { cell: (row) => row.name, header: 'Holding', key: 'name' },
    {
      align: 'right',
      cell: (row) => `${(row.percentage * 100).toFixed(1)}%`,
      header: 'Share of portfolio',
      key: 'percentage'
    }
  ];
  const columns: TableColumn<OverviewRiskBucket>[] = hasSeverity
    ? [
        ...shareColumns,
        {
          cell: (row) => (
            <span
              style={{ color: severityColor[row.severity], fontWeight: 600 }}
            >
              {RISK_SEVERITY_LABELS[row.severity]}
            </span>
          ),
          header: 'Concentration',
          key: 'severity'
        }
      ]
    : shareColumns;

  return (
    <div>
      {hasSeverity && (
        <p
          style={{
            color: highest ? designTokens.color.danger : theme.color.textMuted,
            margin: `0 0 ${px(designTokens.spacing.sm)} 0`
          }}
        >
          {highest
            ? `${highest.name} exceeds the single-stock limit`
            : 'No single stock exceeds the concentration limit'}
        </p>
      )}
      <Table
        caption="Largest positions"
        columns={columns}
        getRowKey={(row) => row.name}
        rows={rows}
      />
    </div>
  );
}
