/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { ThemeProvider } from '../theme/theme-provider';
import { ChartSeriesCard } from './chart-series-card';
import type { ChartSeriesData, ChartSeriesFetch } from './use-chart-series';

const portfolioData: ChartSeriesData = {
  endDate: '2026-04-01',
  granularity: 'daily',
  kind: 'portfolioValue',
  points: [
    { date: '2026-01-05', value: 1000 },
    { date: '2026-02-02', value: 1200 },
    { date: '2026-03-02', value: 1100 }
  ],
  startDate: '2026-01-05'
};

const cashData: ChartSeriesData = {
  ...portfolioData,
  kind: 'cash',
  points: [
    { date: '2026-01-05', value: 200 },
    { date: '2026-02-02', value: 250 }
  ]
};

function httpResponse(body: unknown, status = 200): Response {
  return {
    json: jest.fn().mockResolvedValue(body),
    ok: status >= 200 && status < 300,
    status
  } as unknown as Response;
}

function mockRequest(
  handler: (url: string) => { body: unknown; status?: number }
) {
  const mock = jest.fn().mockImplementation((input: RequestInfo) => {
    const url = String(input);
    const { body, status = 200 } = handler(url);
    return Promise.resolve(httpResponse(body, status));
  });

  return { mock, request: mock as unknown as ChartSeriesFetch };
}

const success = (data: ChartSeriesData) => ({ data, error: null, meta: {} });

describe('ChartSeriesCard', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderCard(request: ChartSeriesFetch) {
    return act(async () => {
      root.render(
        <ThemeProvider>
          <ChartSeriesCard range={{ range: 'ytd' }} request={request} />
        </ThemeProvider>
      );
    });
  }

  it('keeps the series toggle visible while loading', async () => {
    let resolveRequest: ((value: Response) => void) | undefined;
    const pending = new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    });
    const request = jest
      .fn()
      .mockReturnValue(pending) as unknown as ChartSeriesFetch;

    await act(async () => {
      root.render(
        <ThemeProvider>
          <ChartSeriesCard range={{ range: 'ytd' }} request={request} />
        </ThemeProvider>
      );
    });

    expect(
      container.querySelector('[data-testid="chart-series-toggle"]')
    ).not.toBeNull();
    expect(container.textContent).toContain('Portfolio value');
    expect(container.textContent).toContain('Invested capital');
    expect(container.textContent).toContain('Cash');
    expect(container.textContent).toContain('Loading…');
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();

    await act(async () => {
      resolveRequest?.(httpResponse(success(portfolioData)));
    });
  });

  it('shows the chart SVG when ready and labels the selected series', async () => {
    const { request } = mockRequest(() => ({
      body: success(portfolioData)
    }));

    await renderCard(request);

    expect(
      container.querySelector('[data-testid="chart-series-svg"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="chart-series-kind-label"]')
        ?.textContent
    ).toBe('Showing Portfolio value');
    expect(
      container
        .querySelector('[data-kind="portfolioValue"]')
        ?.getAttribute('data-selected')
    ).toBe('true');
  });

  it('shows an empty state for the selected kind without hiding the toggle', async () => {
    const { request } = mockRequest(() => ({
      body: success({ ...portfolioData, points: [] })
    }));

    await renderCard(request);

    expect(container.textContent).toContain(
      'No portfolio value data for this range'
    );
    expect(
      container.querySelector('[data-testid="chart-series-toggle"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="chart-series-svg"]')
    ).toBeNull();
  });

  it('shows an error state with retry while keeping toggles visible', async () => {
    const { request } = mockRequest(() => ({
      body: {
        data: null,
        error: {
          code: 'CHARTS_SERIES_FAILED',
          message: 'Unable to load the chart series'
        },
        meta: {}
      },
      status: 500
    }));

    await renderCard(request);

    expect(container.textContent).toContain('Unable to load the chart series');
    expect(container.textContent).toContain('Try again');
    expect(
      container.querySelector('[data-testid="chart-series-toggle"]')
    ).not.toBeNull();
  });

  it('switches kind through the visible toggle and refetches', async () => {
    const { mock, request } = mockRequest((url) => {
      if (url.includes('kind=cash')) {
        return { body: success(cashData) };
      }

      return { body: success(portfolioData) };
    });

    await renderCard(request);

    expect(mock).toHaveBeenCalledWith(
      '/api/v1/charts/series?range=ytd&kind=portfolioValue',
      expect.any(Object)
    );

    const cashButton = container.querySelector(
      '[data-kind="cash"]'
    ) as HTMLButtonElement;

    await act(async () => {
      cashButton.click();
    });

    expect(mock).toHaveBeenCalledWith(
      '/api/v1/charts/series?range=ytd&kind=cash',
      expect.any(Object)
    );
    expect(cashButton.getAttribute('data-selected')).toBe('true');
    expect(
      container.querySelector('[data-testid="chart-series-kind-label"]')
        ?.textContent
    ).toBe('Showing Cash');
    expect(
      container.querySelector('[data-testid="chart-series-svg"]')
    ).not.toBeNull();
  });
});
