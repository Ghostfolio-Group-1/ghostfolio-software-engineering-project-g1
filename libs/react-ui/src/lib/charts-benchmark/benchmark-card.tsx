import { Card } from '../card/card';
import { DashboardCard } from '../dashboard-card/dashboard-card';
import { useTheme } from '../theme/theme-provider';
import { designTokens, px } from '../tokens/design-tokens';
import { formatBenchmarkIndex } from './benchmark.client';
import type {
  BenchmarkComparisonData,
  BenchmarkComparisonPoint,
  BenchmarkFetch,
  BenchmarkRangeQuery
} from './benchmark.client';
import { benchmarkErrorMessage, useBenchmark } from './use-benchmark';

const CHART_HEIGHT = 160;
const CHART_WIDTH = 480;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function scale(
  values: number[],
  width: number,
  height: number,
  min: number,
  max: number
): string {
  if (values.length === 0) {
    return '';
  }

  const step = values.length > 1 ? width / (values.length - 1) : 0;

  return values
    .map((value, index) => {
      const x = values.length > 1 ? index * step : width / 2;
      const y =
        max === min
          ? height / 2
          : height - ((value - min) / (max - min)) * height;

      return `${index === 0 ? 'M' : 'L'}${round(x)},${round(y)}`;
    })
    .join(' ');
}

/** Both indexed returns on one scale, so the benchmark line is actually drawn. */
export function toComparisonPaths(
  points: BenchmarkComparisonPoint[],
  width = CHART_WIDTH,
  height = CHART_HEIGHT
): { benchmark: string; portfolio: string } {
  if (points.length === 0) {
    return { benchmark: '', portfolio: '' };
  }

  const values = points.flatMap((point) => [
    point.benchmarkReturn,
    point.portfolioReturn
  ]);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return {
    benchmark: scale(
      points.map((point) => point.benchmarkReturn),
      width,
      height,
      min,
      max
    ),
    portfolio: scale(
      points.map((point) => point.portfolioReturn),
      width,
      height,
      min,
      max
    )
  };
}

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

/**
 * Benchmark comparison panel for GET /api/v1/charts/benchmark-comparison.
 * Shares the parent time-range. Empty ranges use the DashboardCard empty
 * state; indexed returns stay server-side. The ready state keeps the card
 * title and draws the portfolio and benchmark lines on one scale.
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
  const paths = data ? toComparisonPaths(data.points) : null;

  return (
    <div data-testid="benchmark-card">
      {status === 'ready' && data && latest && paths ? (
        <Card title={title}>
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
          <svg
            aria-label={`Portfolio vs ${data.benchmarkSymbol}`}
            role="img"
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            width="100%"
          >
            <path
              d={paths.portfolio}
              data-series="portfolio"
              fill="none"
              stroke={theme.color.primary}
              strokeWidth={2}
            />
            <path
              d={paths.benchmark}
              data-series="benchmark"
              fill="none"
              stroke={designTokens.color.secondary}
              strokeWidth={2}
            />
          </svg>
        </Card>
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
