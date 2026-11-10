import { toPath } from '../chart-wrapper/chart-wrapper';
import { useTheme } from '../theme/theme-provider';
import { designTokens, px } from '../tokens/design-tokens';

export interface OverviewChartPoint {
  date: string;
  value: number;
}

export interface DashboardChartsSummaryProps {
  kind: string;
  points: OverviewChartPoint[];
}

const KIND_LABELS: Record<string, string> = {
  cash: 'Cash',
  investedCapital: 'Invested capital',
  portfolioValue: 'Portfolio value'
};

const SPARKLINE_HEIGHT = 64;
const SPARKLINE_WIDTH = 320;

const valueFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2
});

export function chartKindLabel(kind: string) {
  return KIND_LABELS[kind] ?? 'Performance';
}

// Overview Performance card: the latest value of the live series, the date
// range it covers and a sparkline drawn with the shared ChartWrapper path.
// Values are shown as the API sends them; nothing is recalculated here.
export function DashboardChartsSummary({
  kind,
  points
}: DashboardChartsSummaryProps) {
  const theme = useTheme();

  if (points.length === 0) {
    return null;
  }

  const first = points[0];
  const latest = points[points.length - 1];
  const label = chartKindLabel(kind);

  return (
    <div>
      <p
        style={{
          fontSize: px(designTokens.fontSize.lg),
          fontWeight: 600,
          margin: 0
        }}
      >
        {valueFormat.format(latest.value)}
      </p>
      <p
        style={{
          color: theme.color.textMuted,
          margin: `0 0 ${px(designTokens.spacing.sm)} 0`
        }}
      >
        {label} on {latest.date}
      </p>
      <svg
        aria-label={`${label} from ${first.date} to ${latest.date}`}
        role="img"
        viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
        width="100%"
      >
        <path
          d={toPath(points, SPARKLINE_WIDTH, SPARKLINE_HEIGHT)}
          fill="none"
          stroke={theme.color.primary}
          strokeWidth={2}
        />
      </svg>
      <p
        style={{
          color: theme.color.textMuted,
          fontSize: px(designTokens.fontSize.sm),
          margin: `${px(designTokens.spacing.xs)} 0 0 0`
        }}
      >
        {first.date} – {latest.date} · {points.length}{' '}
        {points.length === 1 ? 'point' : 'points'}
      </p>
    </div>
  );
}
