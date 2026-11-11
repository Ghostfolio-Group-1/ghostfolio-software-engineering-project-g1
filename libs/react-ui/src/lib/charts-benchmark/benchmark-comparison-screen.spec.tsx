/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import type { AuthenticatedFetch } from '../data/api-request';
import { toScaledPath } from './benchmark-comparison-screen';
import { BenchmarkComparisonScreen } from './benchmark-comparison-screen';

function apiResponse(body: unknown, status = 200): Response {
  return {
    json: jest.fn().mockResolvedValue(body),
    ok: status >= 200 && status < 300,
    status
  } as unknown as Response;
}

const series = {
  data: {
    endDate: '2026-03-02',
    granularity: 'daily',
    kind: 'portfolioValue',
    points: [
      { date: '2026-03-01', value: 100 },
      { date: '2026-03-02', value: 110 }
    ],
    startDate: '2026-03-01'
  },
  error: null,
  meta: {}
};

const comparison = {
  data: {
    benchmarkAvailableFrom: '2026-03-01',
    benchmarkSymbol: 'SPY',
    endDate: '2026-03-02',
    granularity: 'daily',
    points: [
      { benchmarkReturn: 100, date: '2026-03-01', portfolioReturn: 100 },
      { benchmarkReturn: 90, date: '2026-03-02', portfolioReturn: 110 }
    ],
    startDate: '2026-03-01'
  },
  error: null,
  meta: {}
};

describe('toScaledPath', () => {
  it('draws two series on one scale so the higher value stays above', () => {
    const portfolio = toScaledPath([100, 110], 300, 100, 90, 110);
    const benchmark = toScaledPath([100, 90], 300, 100, 90, 110);

    expect(portfolio).toBe('M0,50 L300,0');
    expect(benchmark).toBe('M0,50 L300,100');
  });
});

describe('BenchmarkComparisonScreen', () => {
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

  async function render(request: AuthenticatedFetch) {
    await act(async () => {
      root.render(<BenchmarkComparisonScreen request={request} />);
    });
  }

  function setInput(value: string) {
    const input = container.querySelector(
      '#benchmark-symbol'
    ) as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;

    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  it('draws the portfolio series until a benchmark is chosen', async () => {
    const request = jest.fn((url: string) => {
      if (url.includes('benchmark-comparison')) {
        return Promise.resolve(apiResponse(comparison));
      }

      return Promise.resolve(apiResponse(series));
    });

    await render(request as unknown as AuthenticatedFetch);

    expect(request).toHaveBeenCalledWith(
      '/api/v1/charts/series?kind=portfolioValue&range=1y',
      expect.objectContaining({ method: 'GET' })
    );
    expect(container.textContent).toContain('Portfolio value');
    expect(container.querySelectorAll('path')).toHaveLength(1);

    await act(async () => {
      setInput('spy');
    });
    await act(async () => {
      container
        .querySelector('form')
        ?.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true })
        );
    });

    expect(request).toHaveBeenCalledWith(
      '/api/v1/charts/benchmark-comparison?benchmark=SPY&range=1y',
      expect.objectContaining({ method: 'GET' })
    );
    expect(container.textContent).toContain('Portfolio return');
    expect(container.textContent).toContain('SPY');
    expect(container.querySelectorAll('path')).toHaveLength(2);
    expect(container.textContent).not.toContain('private detail');
  });

  it('removes the benchmark line when the overlay is cleared', async () => {
    const request = jest.fn((url: string) => {
      if (url.includes('benchmark-comparison')) {
        return Promise.resolve(apiResponse(comparison));
      }

      return Promise.resolve(apiResponse(series));
    });

    await render(request as unknown as AuthenticatedFetch);
    await act(async () => {
      setInput('SPY');
    });
    await act(async () => {
      container
        .querySelector('form')
        ?.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true })
        );
    });
    expect(container.querySelectorAll('path')).toHaveLength(2);

    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Clear')
        ?.click();
    });

    expect(container.textContent).toContain('Portfolio value');
    expect(container.querySelectorAll('path')).toHaveLength(1);
  });

  it('shows a safe message when the benchmark symbol is unknown', async () => {
    const request = jest.fn((url: string) => {
      if (url.includes('benchmark-comparison')) {
        return Promise.resolve(
          apiResponse(
            {
              data: null,
              error: {
                code: 'CHARTS_BENCHMARK_NOT_FOUND',
                message: 'private detail'
              },
              meta: {}
            },
            404
          )
        );
      }

      return Promise.resolve(apiResponse(series));
    });

    await render(request as unknown as AuthenticatedFetch);
    await act(async () => {
      setInput('NOPE');
    });
    await act(async () => {
      container
        .querySelector('form')
        ?.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true })
        );
    });

    expect(container.textContent).toContain(
      'That benchmark symbol was not found.'
    );
    expect(container.textContent).not.toContain('private detail');
  });
});
