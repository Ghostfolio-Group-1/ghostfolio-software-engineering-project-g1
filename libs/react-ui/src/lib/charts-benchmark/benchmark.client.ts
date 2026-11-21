import { requestApi } from '../data/api-request';
import type { AuthenticatedFetch } from '../data/api-request';
import { ApiRequestError } from '../data/api-request';

export type BenchmarkGranularity = 'daily' | 'weekly';

export interface BenchmarkComparisonPoint {
  benchmarkReturn: number;
  date: string;
  portfolioReturn: number;
}

export interface BenchmarkComparisonData {
  benchmarkAvailableFrom: string;
  benchmarkSymbol: string;
  endDate: string;
  granularity: BenchmarkGranularity;
  points: BenchmarkComparisonPoint[];
  startDate: string;
}

export type BenchmarkRangeQuery =
  | { benchmark?: string; range: string }
  | { benchmark?: string; endDate: string; startDate: string };

export type BenchmarkFetch = AuthenticatedFetch;

function buildBenchmarkUrl(query: BenchmarkRangeQuery): string {
  const params = new URLSearchParams();

  if ('range' in query) {
    params.set('range', query.range);
  } else {
    params.set('startDate', query.startDate);
    params.set('endDate', query.endDate);
  }

  params.set('benchmark', query.benchmark ?? 'SPY');

  return `/api/v1/charts/benchmark-comparison?${params.toString()}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBenchmarkPoint(value: unknown): value is BenchmarkComparisonPoint {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const point = value as BenchmarkComparisonPoint;

  return (
    typeof point.date === 'string' &&
    isFiniteNumber(point.portfolioReturn) &&
    isFiniteNumber(point.benchmarkReturn)
  );
}

function isBenchmarkData(value: unknown): value is BenchmarkComparisonData {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const data = value as BenchmarkComparisonData;

  return (
    typeof data.benchmarkAvailableFrom === 'string' &&
    typeof data.benchmarkSymbol === 'string' &&
    data.benchmarkSymbol.length > 0 &&
    typeof data.endDate === 'string' &&
    typeof data.startDate === 'string' &&
    (data.granularity === 'daily' || data.granularity === 'weekly') &&
    Array.isArray(data.points) &&
    data.points.every(isBenchmarkPoint)
  );
}

export function formatBenchmarkIndex(value: number): string {
  return value.toFixed(2);
}

export function benchmarkErrorMessage(error: Error | null): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return 'Please sign in to view charts';
    }

    if (error.status === 403) {
      return 'You do not have permission to view the chart.';
    }

    if (error.code === 'CHARTS_INVALID_QUERY') {
      return 'That chart range is not valid';
    }

    if (error.code === 'CHARTS_BENCHMARK_FAILED') {
      return 'Unable to load the benchmark comparison';
    }
  }

  return 'Benchmark comparison data is unavailable';
}

/**
 * Retrieve a benchmark comparison through the host's authenticated fetch.
 * Indexed portfolio and benchmark returns stay on
 * GET /api/v1/charts/benchmark-comparison.
 */
export async function fetchBenchmarkComparison(
  query: BenchmarkRangeQuery,
  request: BenchmarkFetch,
  signal?: AbortSignal
): Promise<BenchmarkComparisonData> {
  const data = await requestApi<unknown>(
    request,
    buildBenchmarkUrl(query),
    signal
  );

  if (!isBenchmarkData(data)) {
    throw new ApiRequestError(
      200,
      'INVALID_RESPONSE',
      'Invalid benchmark comparison API response'
    );
  }

  return data;
}
