/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { toPath } from '../chart-wrapper/chart-wrapper';
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

function httpResponse(body: unknown): Response {
  return {
    json: jest.fn().mockResolvedValue(body),
    ok: true,
    status: 200
  } as unknown as Response;
}

function success(data: ChartSeriesData) {
  return httpResponse({ data, error: null, meta: {} });
}

function chartPath(points: ChartSeriesData['points']): string {
  return toPath(points, CHART_WIDTH, CHART_HEIGHT);
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

  function drawnPath(): string | null {
    return container.querySelector('path')?.getAttribute('d') ?? null;
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

  it('draws each preset from its own series', async () => {
    const request = jest.fn().mockImplementation((url: string) => {
      const range = new URL(url, 'http://localhost').searchParams.get(
        'range'
      ) as keyof typeof seriesByRange;

      return Promise.resolve(success(seriesByRange[range]));
    }) as unknown as ChartSeriesFetch;

    await render(request);

    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.textContent).toContain('Portfolio value');
    expect(drawnPath()).toBe(chartPath(seriesByRange.max.points));
    expect(rangeButton('max').getAttribute('aria-pressed')).toBe('true');

    for (const range of ['ytd', '1y', '5y'] as const) {
      await act(async () => {
        rangeButton(range).click();
      });

      expect(request).toHaveBeenCalledWith(
        `/api/v1/charts/series?range=${range}&kind=portfolioValue`,
        expect.any(Object)
      );
      expect(rangeButton(range).getAttribute('aria-pressed')).toBe('true');
      expect(drawnPath()).toBe(chartPath(seriesByRange[range].points));
    }
  });

  it('keeps the selected range when an older request resolves later', async () => {
    const pending = new Map<string, (response: Response) => void>();
    const request = jest.fn().mockImplementation((url: string) => {
      return new Promise<Response>((resolve) => {
        pending.set(url, resolve);
      });
    }) as unknown as ChartSeriesFetch;

    await render(request);

    const maxUrl = '/api/v1/charts/series?range=max&kind=portfolioValue';
    expect(pending.has(maxUrl)).toBe(true);
    expect(container.querySelector('svg')).toBeNull();

    await act(async () => {
      rangeButton('5y').click();
    });

    const fiveYearUrl = '/api/v1/charts/series?range=5y&kind=portfolioValue';

    await act(async () => {
      pending.get(fiveYearUrl)?.(success(seriesByRange['5y']));
    });

    expect(drawnPath()).toBe(chartPath(seriesByRange['5y'].points));
    expect(rangeButton('5y').getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      pending.get(maxUrl)?.(success(seriesByRange.max));
    });

    expect(drawnPath()).toBe(chartPath(seriesByRange['5y'].points));
    expect(rangeButton('5y').getAttribute('aria-pressed')).toBe('true');
    expect(rangeButton('max').getAttribute('aria-pressed')).toBe('false');
  });
});
