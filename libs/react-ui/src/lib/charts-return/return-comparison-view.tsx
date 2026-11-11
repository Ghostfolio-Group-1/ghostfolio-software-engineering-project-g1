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
  fetchReturnComparison
} from './return-comparison.client';
import type { ChartRange } from './return-comparison.client';

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

function errorMessage(error: Error | null): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return 'Please sign in to view the chart.';
    }

    if (error.status === 403) {
      return 'You do not have permission to view the chart.';
    }

    if (error.code === 'CHARTS_SYMBOL_NOT_FOUND') {
      return 'That symbol is not in this portfolio for the selected range.';
    }
  }

  return 'Unable to load the return comparison.';
}

function ReturnChart({
  range,
  request,
  symbol
}: {
  range: ChartRange;
  request: AuthenticatedFetch;
  symbol: string;
}) {
  const theme = useTheme();
  const { data, error, reload, status } = useApiData(
    (signal) => fetchReturnComparison(request, range, symbol, signal),
    (result) => result.points.length === 0
  );
  const isAuthFailure =
    error instanceof ApiRequestError &&
    (error.status === 401 || error.status === 403);
  const values =
    data?.points.flatMap((point) => [point.priceReturn, point.totalReturn]) ??
    [];
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 0;

  return (
    <DashboardCard
      emptyMessage="No data for this range"
      errorMessage={errorMessage(error)}
      onRetry={status === 'error' && !isAuthFailure ? reload : undefined}
      status={status}
      title="Total return and price return"
    >
      {status === 'ready' && data ? (
        <div>
          <ul>
            <li style={{ color: designTokens.color.secondary }}>
              Price return
            </li>
            <li style={{ color: theme.color.primary }}>Total return</li>
          </ul>
          <svg
            aria-label={`Price return and total return from ${data.startDate} to ${data.endDate}`}
            role="img"
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            width="100%"
          >
            <path
              d={toScaledPath(
                data.points.map((point) => point.priceReturn),
                CHART_WIDTH,
                CHART_HEIGHT,
                min,
                max
              )}
              fill="none"
              stroke={designTokens.color.secondary}
              strokeWidth={2}
            />
            <path
              d={toScaledPath(
                data.points.map((point) => point.totalReturn),
                CHART_WIDTH,
                CHART_HEIGHT,
                min,
                max
              )}
              fill="none"
              stroke={theme.color.primary}
              strokeWidth={2}
            />
          </svg>
        </div>
      ) : null}
    </DashboardCard>
  );
}

/**
 * Both return lines on one chart. An empty symbol is the whole portfolio.
 * The lines share a scale so the gap is the dividend contribution.
 */
export function ReturnComparisonView({
  request
}: {
  request: AuthenticatedFetch;
}) {
  const [range, setRange] = useState<ChartRange>('1y');
  const [symbol, setSymbol] = useState('');
  const [draft, setDraft] = useState('');
  const nextSymbol = draft.trim().toUpperCase();
  const canApply = nextSymbol !== symbol;

  function applySymbol(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (canApply) {
      setSymbol(nextSymbol);
    }
  }

  return (
    <section aria-label="Total return and price return">
      <form onSubmit={applySymbol}>
        <label htmlFor="return-symbol">Holding symbol</label>{' '}
        <input
          id="return-symbol"
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Portfolio"
          value={draft}
        />{' '}
        <label htmlFor="return-range">Range</label>{' '}
        <select
          id="return-range"
          onChange={(event) => setRange(event.target.value as ChartRange)}
          value={range}
        >
          {CHART_RANGES.map((preset) => (
            <option key={preset} value={preset}>
              {preset}
            </option>
          ))}
        </select>{' '}
        <button disabled={!canApply} type="submit">
          Apply
        </button>
      </form>
      <ReturnChart
        key={`${range}-${symbol}`}
        range={range}
        request={request}
        symbol={symbol}
      />
    </section>
  );
}
