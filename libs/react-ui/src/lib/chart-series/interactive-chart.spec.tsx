/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { ThemeProvider } from '../theme/theme-provider';
import { InteractiveChart } from './interactive-chart';
import type { ChartSeriesData, ChartSeriesFetch } from './use-chart-series';

const portfolioData: ChartSeriesData = {
  endDate: '2026-04-01',
  granularity: 'daily',
  kind: 'portfolioValue',
  points: [
    { date: '2026-01-05', value: 1000 },
    { date: '2026-04-01', value: 1500 }
  ],
  startDate: '2026-01-05'
};

function httpResponse(body: unknown): Response {
  return {
    json: jest.fn().mockResolvedValue(body),
    ok: true,
    status: 200
  } as unknown as Response;
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

  it('renders the portfolio value series and switches the shared range', async () => {
    const request = jest.fn().mockImplementation((url: string) => {
      return Promise.resolve(
        httpResponse({ data: portfolioData, error: null, meta: {} })
      );
    }) as unknown as ChartSeriesFetch;

    await act(async () => {
      root.render(
        <ThemeProvider>
          <InteractiveChart request={request} />
        </ThemeProvider>
      );
    });

    expect(container.querySelector('svg[role="img"]')).not.toBeNull();
    expect(container.textContent).toContain('Portfolio value');
    expect(request).toHaveBeenCalledWith(
      '/api/v1/charts/series?range=max&kind=portfolioValue',
      expect.any(Object)
    );

    await act(async () => {
      (
        container.querySelector('[data-range="1y"]') as HTMLButtonElement
      ).click();
    });

    expect(request).toHaveBeenCalledWith(
      '/api/v1/charts/series?range=1y&kind=portfolioValue',
      expect.any(Object)
    );
    expect(
      container.querySelector('[data-range="1y"]')?.getAttribute('aria-pressed')
    ).toBe('true');
  });
});
