import { ChartWrapper } from '../chart-wrapper/chart-wrapper';
import { DashboardCard } from '../dashboard-card/dashboard-card';
import { useTheme } from '../theme/theme-provider';
import { designTokens, px } from '../tokens/design-tokens';
import { formatBenchmarkIndex } from './benchmark.client';
import type {
  BenchmarkComparisonData,
  BenchmarkFetch,
  BenchmarkRangeQuery
} from './benchmark.client';
import { benchmarkErrorMessage, useBenchmark } from './use-benchmark';

export type BenchmarkRangeSelection = BenchmarkRangeQuery;

export interface BenchmarkCardProps {
  /** Shared time-range only — this card does not invent a second range control. */
  range: BenchmarkRangeSelection;
  /** Host authenticated fetch — required (no native-fetch default). */
  request: BenchmarkFetch;
  /** Market-data symbol. Defaults to SPY when the caller omits one. */
  benchmark?: string;
  title?: string;
}

function toChartPoints(data: BenchmarkComparisonData) {
  return data.points.map((point) => ({
    date: point.date,
    value: point.portfolioReturn
  }));
}

/**
 * Benchmark comparison panel for GET /api/v1/charts/benchmark-comparison.
 * Shares the parent time-range. Empty ranges use the DashboardCard empty
 * state; indexed returns stay server-side.
 */
export function BenchmarkCard({
  benchmark = 'SPY',
  range,
  request,
  title = 'Benchmark'
}: BenchmarkCardProps) {
  const query: BenchmarkRangeQuery = { ...range, benchmark };
  const { data, error, reload, status } = useBenchmark(query, request);
  const theme = useTheme();
  const latest = data && data.points.length > 0 ? data.points.at(-1) : null;
  const partialHistory =
    data !== null && data.benchmarkAvailableFrom > data.startDate;

  return (
    <div data-testid="benchmark-card">
      {status === 'ready' && data && latest ? (
        <div>
          <p
            data-testid="benchmark-summary"
            style={{
              margin: `0 0 ${px(designTokens.spacing.xs)} 0`
            }}
          >
            <span style={{ color: theme.color.textMuted }}>Benchmark </span>
            <span style={{ fontWeight: 600 }}>{data.benchmarkSymbol}</span>
            <span style={{ color: theme.color.textMuted }}>
              {' '}
              Portfolio {formatBenchmarkIndex(latest.portfolioReturn)} ·{' '}
              {data.benchmarkSymbol}{' '}
              {formatBenchmarkIndex(latest.benchmarkReturn)}
            </span>
          </p>
          {partialHistory ? (
            <p
              data-testid="benchmark-partial-history"
              style={{
                color: theme.color.textMuted,
                margin: `0 0 ${px(designTokens.spacing.sm)} 0`
              }}
            >
              Benchmark data starts {data.benchmarkAvailableFrom}
            </p>
          ) : null}
          <ChartWrapper
            points={toChartPoints(data)}
            title={`Portfolio vs ${data.benchmarkSymbol}`}
          />
        </div>
      ) : (
        <DashboardCard
          emptyMessage="No benchmark data for this range"
          errorMessage={benchmarkErrorMessage(error)}
          onRetry={reload}
          status={status}
          title={title}
        />
      )}
    </div>
  );
}
