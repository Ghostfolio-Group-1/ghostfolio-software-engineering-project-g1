/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { toPath } from '../chart-wrapper/chart-wrapper';
import type { DrawdownData } from '../charts-drawdown/drawdown.client';
import { ThemeProvider } from '../theme/theme-provider';
import { InteractiveChart } from './interactive-chart';
import type { ChartSeriesData, ChartSeriesFetch } from './use-chart-series';

const CHART_WIDTH = 480;
const CHART_HEIGHT = 160;

function series(points: ChartSeriesData['points']): ChartSeriesData {
  return {
    endDate: '2026-04-01',
    granularity: 'daily',
    kind: 'portfolioValue',
    points,
    startDate: '2026-01-05'
  };
}

const seriesByRange = {
  '1y': series([
    { date: '2026-01-05', value: 1000 },
    { date: '2026-04-01', value: 1000 }
  ]),
  '5y': series([
    { date: '2026-01-05', value: 1000 },
    { date: '2026-02-01', value: 1800 },
    { date: '2026-04-01', value: 900 }
  ]),
  max: series([
    { date: '2026-01-05', value: 1000 },
    { date: '2026-04-01', value: 1500 }
  ]),
  ytd: series([
    { date: '2026-01-05', value: 1500 },
    { date: '2026-04-01', value: 1000 }
  ])
};

const drawdownByRange: Record<string, DrawdownData> = {
  '1y': {
    endDate: '2026-04-01',
    granularity: 'daily',
    maxDrawdown: 0,
    maxDrawdownDate: '2026-01-05',
    points: [
      { date: '2026-01-05', drawdown: 0, isNewPeak: true },
      { date: '2026-04-01', drawdown: 0, isNewPeak: true }
    ],
    startDate: '2026-01-05'
  },
  '5y': {
    endDate: '2026-04-01',
    granularity: 'daily',
    maxDrawdown: -0.5,
    maxDrawdownDate: '2026-04-01',
    points: [
      { date: '2026-01-05', drawdown: 0, isNewPeak: true },
      { date: '2026-02-01', drawdown: 0, isNewPeak: true },
      { date: '2026-04-01', drawdown: -0.5, isNewPeak: false }
    ],
    startDate: '2026-01-05'
  },
  max: {
    endDate: '2026-04-01',
    granularity: 'daily',
    maxDrawdown: 0,
    maxDrawdownDate: '2026-01-05',
    points: [
      { date: '2026-01-05', drawdown: 0, isNewPeak: true },
      { date: '2026-04-01', drawdown: 0, isNewPeak: true }
    ],
    startDate: '2026-01-05'
  },
  ytd: {
    endDate: '2026-04-01',
    granularity: 'daily',
    maxDrawdown: -0.33,
    maxDrawdownDate: '2026-04-01',
    points: [
      { date: '2026-01-05', drawdown: 0, isNewPeak: true },
      { date: '2026-04-01', drawdown: -0.33, isNewPeak: false }
    ],
    startDate: '2026-01-05'
  }
};

function httpResponse(body: unknown): Response {
  return {
    json: jest.fn().mockResolvedValue(body),
    ok: true,
    status: 200
  } as unknown as Response;
}

function success(data: unknown) {
  return httpResponse({ data, error: null, meta: {} });
}

function chartPath(points: ChartSeriesData['points']): string {
  return toPath(points, CHART_WIDTH, CHART_HEIGHT);
}

function respond(url: string): Response {
  const params = new URL(url, 'http://localhost').searchParams;
  const range = params.get('range') ?? 'max';

  if (url.includes('/charts/drawdown')) {
    return success(drawdownByRange[range] ?? drawdownByRange.max);
  }

  return success(seriesByRange[range as keyof typeof seriesByRange]);
}

describe('InteractiveChart', () => {
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

  function rangeButton(range: string): HTMLButtonElement {
    return container.querySelector(
      `[data-range="${range}"]`
    ) as HTMLButtonElement;
  }

  function seriesPath(): string | null {
    return (
      container
        .querySelector('[data-testid="chart-series-card"] path')
        ?.getAttribute('d') ?? null
    );
  }

  async function render(request: ChartSeriesFetch) {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <InteractiveChart request={request} />
        </ThemeProvider>
      );
    });
  }

  it('draws each preset from its own series and shares the range with drawdown', async () => {
    const request = jest
      .fn()
      .mockImplementation((url: string) => Promise.resolve(respond(url)));

    await render(request as unknown as ChartSeriesFetch);

    expect(
      container.querySelector('[data-testid="chart-series-card"] svg')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="drawdown-card"]')
    ).not.toBeNull();
    expect(container.textContent).toContain('Portfolio value');
    expect(seriesPath()).toBe(chartPath(seriesByRange.max.points));
    expect(rangeButton('max').getAttribute('aria-pressed')).toBe('true');
    expect(
      container.querySelector('[data-testid="drawdown-max"]')?.textContent
    ).toContain('0.00%');

    for (const range of ['ytd', '1y', '5y'] as const) {
      await act(async () => {
        rangeButton(range).click();
      });

      expect(request).toHaveBeenCalledWith(
        `/api/v1/charts/series?range=${range}&kind=portfolioValue`,
        expect.any(Object)
      );
      expect(request).toHaveBeenCalledWith(
        `/api/v1/charts/drawdown?range=${range}`,
        expect.any(Object)
      );
      expect(rangeButton(range).getAttribute('aria-pressed')).toBe('true');
      expect(seriesPath()).toBe(chartPath(seriesByRange[range].points));
      expect(
        container.querySelector('[data-testid="drawdown-max"]')
      ).not.toBeNull();
    }
  });

  it('keeps the selected range when an older request resolves later', async () => {
    const pending = new Map<string, (response: Response) => void>();
    const request = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/charts/drawdown')) {
        return Promise.resolve(respond(url));
      }

      return new Promise<Response>((resolve) => {
        pending.set(url, resolve);
      });
    }) as unknown as ChartSeriesFetch;

    await render(request);

    const maxUrl = '/api/v1/charts/series?range=max&kind=portfolioValue';
    expect(pending.has(maxUrl)).toBe(true);
    expect(
      container.querySelector('[data-testid="chart-series-card"] svg')
    ).toBeNull();

    await act(async () => {
      rangeButton('5y').click();
    });

    const fiveYearUrl = '/api/v1/charts/series?range=5y&kind=portfolioValue';

    await act(async () => {
      pending.get(fiveYearUrl)?.(success(seriesByRange['5y']));
    });

    expect(seriesPath()).toBe(chartPath(seriesByRange['5y'].points));
    expect(rangeButton('5y').getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      pending.get(maxUrl)?.(success(seriesByRange.max));
    });

    expect(seriesPath()).toBe(chartPath(seriesByRange['5y'].points));
    expect(rangeButton('5y').getAttribute('aria-pressed')).toBe('true');
    expect(rangeButton('max').getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps the range toggle visible while the chart is loading', async () => {
    let resolveRequest: ((value: Response) => void) | undefined;
    const pending = new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    });
    const request = jest
      .fn()
      .mockReturnValue(pending) as unknown as ChartSeriesFetch;

    await render(request);

    expect(container.textContent).toContain('Loading…');
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelector('svg')).toBeNull();
    expect(rangeButton('max').getAttribute('aria-pressed')).toBe('true');
    expect(rangeButton('ytd')).not.toBeNull();

    await act(async () => {
      rangeButton('1y').click();
    });

    expect(request).toHaveBeenCalledWith(
      '/api/v1/charts/series?range=1y&kind=portfolioValue',
      expect.any(Object)
    );
    expect(rangeButton('1y').getAttribute('aria-pressed')).toBe('true');
    expect(container.textContent).toContain('Loading…');

    await act(async () => {
      resolveRequest?.(success(seriesByRange['1y']));
    });
  });

  it('shows an empty chart state and keeps the range toggle', async () => {
    const request = jest.fn().mockImplementation((url: string) => {
      const range = new URL(url, 'http://localhost').searchParams.get('range');

      return Promise.resolve(
        success(series(range === 'ytd' ? seriesByRange.ytd.points : []))
      );
    }) as unknown as ChartSeriesFetch;

    await render(request);

    expect(container.textContent).toContain(
      'No portfolio value data for this range'
    );
    expect(container.querySelector('svg')).toBeNull();
    expect(rangeButton('max').getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      rangeButton('ytd').click();
    });

    expect(container.querySelector('svg')).not.toBeNull();
    expect(rangeButton('ytd').getAttribute('aria-pressed')).toBe('true');
  });

  it('shows a generic error and keeps the range toggle usable', async () => {
    const request = jest.fn().mockImplementation((url: string) => {
      const range = new URL(url, 'http://localhost').searchParams.get('range');

      if (range === '1y') {
        return Promise.resolve(success(seriesByRange['1y']));
      }

      return Promise.resolve({
        json: jest.fn().mockResolvedValue({
          data: null,
          error: {
            code: 'CHARTS_SERIES_FAILED',
            message: 'private detail'
          },
          meta: {}
        }),
        ok: false,
        status: 500
      } as unknown as Response);
    }) as unknown as ChartSeriesFetch;

    await render(request);

    expect(container.textContent).toContain('Unable to load the chart series');
    expect(container.textContent).not.toContain('private detail');
    expect(container.textContent).toContain('Try again');
    expect(container.querySelector('svg')).toBeNull();
    expect(rangeButton('max').getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      rangeButton('1y').click();
    });

    expect(container.querySelector('svg')).not.toBeNull();
    expect(rangeButton('1y').getAttribute('aria-pressed')).toBe('true');
    expect(container.textContent).not.toContain('private detail');
  });
});
