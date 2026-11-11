import { useState } from 'react';
import type { FormEvent } from 'react';

import { DashboardCard } from '../dashboard-card/dashboard-card';
import type { AuthenticatedFetch } from '../data/api-request';
import { ApiRequestError } from '../data/api-request';
import { useApiData } from '../data/use-api-data';
import { useTheme } from '../theme/theme-provider';
import { designTokens } from '../tokens/design-tokens';
import {
  CHART_RANGES,
  fetchBenchmarkComparison,
  fetchPortfolioSeries
} from './benchmark-comparison.client';
import type { ChartRange } from './benchmark-comparison.client';

export interface IndexedSeries {
  color: string;
  label: string;
  values: number[];
}

const CHART_HEIGHT = 160;
const CHART_WIDTH = 480;

export function toScaledPath(
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

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function IndexedChart({
  caption,
  series
}: {
  caption: string;
  series: IndexedSeries[];
}) {
  const values = series.flatMap((item) => item.values);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return (
    <div>
      <ul>
        {series.map((item) => (
          <li key={item.label} style={{ color: item.color }}>
            {item.label}
          </li>
        ))}
      </ul>
      <svg
        aria-label={caption}
        role="img"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        width="100%"
      >
        {series.map((item) => (
          <path
            d={toScaledPath(item.values, CHART_WIDTH, CHART_HEIGHT, min, max)}
            fill="none"
            key={item.label}
            stroke={item.color}
            strokeWidth={2}
          />
        ))}
      </svg>
    </div>
  );
}

function errorMessage(error: Error | null): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return 'Please sign in to view the chart.';
    }

    if (error.status === 403) {
      return 'You do not have permission to view the chart.';
    }

    if (error.code === 'CHARTS_BENCHMARK_NOT_FOUND') {
      return 'That benchmark symbol was not found.';
    }
  }

  return 'Unable to load the benchmark comparison.';
}

function BenchmarkChart({
  range,
  request,
  symbol
}: {
  range: ChartRange;
  request: AuthenticatedFetch;
  symbol: string;
}) {
  const theme = useTheme();
  const benchmark = symbol.trim();
  const { data, error, reload, status } = useApiData(
    (signal) => {
      return benchmark
        ? fetchBenchmarkComparison(request, benchmark, range, signal)
        : fetchPortfolioSeries(request, range, signal);
    },
    (result) => result.points.length === 0
  );

  const isAuthFailure =
    error instanceof ApiRequestError &&
    (error.status === 401 || error.status === 403);

  let content = null;

  if (status === 'ready' && data && 'benchmarkSymbol' in data) {
    content = (
      <IndexedChart
        caption={`${data.benchmarkSymbol} compared with the portfolio from ${data.startDate} to ${data.endDate}`}
        series={[
          {
            color: theme.color.primary,
            label: 'Portfolio return',
            values: data.points.map((point) => point.portfolioReturn)
          },
          {
            color: designTokens.color.secondary,
            label: data.benchmarkSymbol,
            values: data.points.map((point) => point.benchmarkReturn)
          }
        ]}
      />
    );
  } else if (status === 'ready' && data) {
    content = (
      <IndexedChart
        caption={`Portfolio value, ${range}`}
        series={[
          {
            color: theme.color.primary,
            label: 'Portfolio value',
            values: data.points.map((point) => point.value)
          }
        ]}
      />
    );
  }

  return (
    <DashboardCard
      emptyMessage="No data for this range"
      errorMessage={errorMessage(error)}
      onRetry={status === 'error' && !isAuthFailure ? reload : undefined}
      status={status}
      title="Benchmark comparison"
    >
      {content}
    </DashboardCard>
  );
}

/**
 * Portfolio chart with an optional benchmark line on the same scale.
 * Clearing the symbol removes the overlay and leaves the portfolio series.
 */
export function BenchmarkComparisonScreen({
  request
}: {
  request: AuthenticatedFetch;
}) {
  const [range, setRange] = useState<ChartRange>('1y');
  const [symbol, setSymbol] = useState('');
  const [draft, setDraft] = useState('');
  const nextSymbol = draft.trim().toUpperCase();
  const canCompare = nextSymbol.length > 0 && nextSymbol !== symbol;

  function applySymbol(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (canCompare) {
      setSymbol(nextSymbol);
    }
  }

  return (
    <section aria-label="Benchmark comparison">
      <form onSubmit={applySymbol}>
        <label htmlFor="benchmark-symbol">Benchmark symbol</label>{' '}
        <input
          id="benchmark-symbol"
          onChange={(event) => setDraft(event.target.value)}
          value={draft}
        />{' '}
        <label htmlFor="benchmark-range">Range</label>{' '}
        <select
          id="benchmark-range"
          onChange={(event) => setRange(event.target.value as ChartRange)}
          value={range}
        >
          {CHART_RANGES.map((preset) => (
            <option key={preset} value={preset}>
              {preset}
            </option>
          ))}
        </select>{' '}
        <button disabled={!canCompare} type="submit">
          Compare
        </button>{' '}
        <button
          disabled={symbol.length === 0}
          onClick={() => {
            setSymbol('');
            setDraft('');
          }}
          type="button"
        >
          Clear
        </button>
      </form>
      <BenchmarkChart
        key={`${range}-${symbol}`}
        range={range}
        request={request}
        symbol={symbol}
      />
    </section>
  );
}
