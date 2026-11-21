/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { ThemeProvider } from '../theme/theme-provider';
import { BenchmarkCard, toComparisonPaths } from './benchmark-card';
import type {
  BenchmarkComparisonData,
  BenchmarkFetch
} from './benchmark.client';

function apiResponse(body: unknown, status = 200): Response {
  return {
    json: jest.fn().mockResolvedValue(body),
    ok: status >= 200 && status < 300,
    status
  } as unknown as Response;
}

const comparison: {
  data: BenchmarkComparisonData;
  error: null;
  meta: Record<string, never>;
} = {
  data: {
    benchmarkAvailableFrom: '2026-01-05',
    benchmarkSymbol: 'SPY',
    endDate: '2026-04-01',
    granularity: 'daily',
    points: [
      { benchmarkReturn: 100, date: '2026-01-05', portfolioReturn: 100 },
      { benchmarkReturn: 110, date: '2026-04-01', portfolioReturn: 108 }
    ],
    startDate: '2026-01-05'
  },
  error: null,
  meta: {}
};

describe('BenchmarkCard', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render(request: BenchmarkFetch) {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <BenchmarkCard
            benchmark="SPY"
            range={{ range: '1y' }}
            request={request}
          />
        </ThemeProvider>
      );
    });
  }

  it('shows a loading state before the comparison arrives', async () => {
    let resolveRequest: ((value: Response) => void) | undefined;
    const pending = new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    });
    const request = jest
      .fn()
      .mockReturnValue(pending) as unknown as BenchmarkFetch;

    await render(request);

    expect(request).toHaveBeenCalledWith(
      '/api/v1/charts/benchmark-comparison?range=1y&benchmark=SPY',
      expect.objectContaining({ method: 'GET' })
    );
    expect(container.textContent).toContain('Loading…');
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelector('svg')).toBeNull();

    await act(async () => {
      resolveRequest?.(apiResponse(comparison));
    });
  });

  it('plots the portfolio against the benchmark symbol', async () => {
    const request = jest.fn().mockResolvedValue(apiResponse(comparison));

    await render(request as unknown as BenchmarkFetch);

    expect(
      container.querySelector('[data-testid="benchmark-summary"]')?.textContent
    ).toContain('SPY');
    expect(
      container.querySelector('[data-testid="benchmark-summary"]')?.textContent
    ).toContain('108.00');
    expect(
      container.querySelector('[data-testid="benchmark-summary"]')?.textContent
    ).toContain('110.00');
    expect(container.querySelector('h2')?.textContent).toBe('Benchmark');
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe(
      'Portfolio vs SPY'
    );

    const paths = toComparisonPaths(comparison.data.points);
    const portfolio = container.querySelector('[data-series="portfolio"]');
    const benchmark = container.querySelector('[data-series="benchmark"]');

    expect(paths.portfolio).not.toBe(paths.benchmark);
    expect(portfolio?.getAttribute('d')).toBe(paths.portfolio);
    expect(benchmark?.getAttribute('d')).toBe(paths.benchmark);
    expect(
      container.querySelector('[data-testid="benchmark-partial-history"]')
    ).toBeNull();
  });

  it('shows the empty state when the range has no points', async () => {
    const request = jest.fn().mockResolvedValue(
      apiResponse({
        data: { ...comparison.data, points: [] },
        error: null,
        meta: {}
      })
    );

    await render(request as unknown as BenchmarkFetch);

    expect(container.textContent).toContain('No benchmark data for this range');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('shows a generic error message, not server text', async () => {
    const request = jest.fn().mockResolvedValue(
      apiResponse(
        {
          data: null,
          error: {
            code: 'CHARTS_BENCHMARK_FAILED',
            message: 'private detail'
          },
          meta: {}
        },
        500
      )
    );

    await render(request as unknown as BenchmarkFetch);

    expect(container.textContent).toContain(
      'Unable to load the benchmark comparison'
    );
    expect(container.textContent).not.toContain('private detail');
    expect(container.textContent).toContain('Try again');
  });
});
