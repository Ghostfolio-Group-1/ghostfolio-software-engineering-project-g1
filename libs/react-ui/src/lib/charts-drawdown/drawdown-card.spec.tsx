/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { ThemeProvider } from '../theme/theme-provider';
import { DrawdownCard } from './drawdown-card';
import type { DrawdownData, DrawdownFetch } from './drawdown.client';

function apiResponse(body: unknown, status = 200): Response {
  return {
    json: jest.fn().mockResolvedValue(body),
    ok: status >= 200 && status < 300,
    status
  } as unknown as Response;
}

const drawdown: {
  data: DrawdownData;
  error: null;
  meta: Record<string, never>;
} = {
  data: {
    endDate: '2026-04-01',
    granularity: 'daily',
    maxDrawdown: -0.25,
    maxDrawdownDate: '2026-03-02',
    points: [
      { date: '2026-01-05', drawdown: 0, isNewPeak: true },
      { date: '2026-02-02', drawdown: 0, isNewPeak: true },
      { date: '2026-03-02', drawdown: -0.25, isNewPeak: false },
      { date: '2026-04-01', drawdown: -0.1, isNewPeak: false }
    ],
    startDate: '2026-01-05'
  },
  error: null,
  meta: {}
};

describe('DrawdownCard', () => {
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

  async function render(
    request: DrawdownFetch,
    range: { range: string } | { endDate: string; startDate: string } = {
      range: '1y'
    }
  ) {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <DrawdownCard range={range} request={request} />
        </ThemeProvider>
      );
    });
  }

  it('plots drawdown from the live route and surfaces max drawdown', async () => {
    const request = jest.fn().mockResolvedValue(apiResponse(drawdown));

    await render(request as unknown as DrawdownFetch);

    expect(request).toHaveBeenCalledWith(
      '/api/v1/charts/drawdown?range=1y',
      expect.objectContaining({ method: 'GET' })
    );
    expect(
      container.querySelector('[data-testid="drawdown-max"]')?.textContent
    ).toContain('-25.00%');
    expect(
      container.querySelector('[data-testid="drawdown-max"]')?.textContent
    ).toContain('2026-03-02');
    expect(container.querySelector('svg')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="drawdown-short-history"]')
    ).toBeNull();
  });

  it('uses custom start and end dates from the shared range', async () => {
    const request = jest.fn().mockResolvedValue(apiResponse(drawdown));

    await render(request as unknown as DrawdownFetch, {
      endDate: '2026-04-01',
      startDate: '2026-01-05'
    });

    expect(request).toHaveBeenCalledWith(
      '/api/v1/charts/drawdown?startDate=2026-01-05&endDate=2026-04-01',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('shows the empty state when the range has no points', async () => {
    const request = jest.fn().mockResolvedValue(
      apiResponse({
        data: {
          endDate: '2026-04-01',
          granularity: 'daily',
          maxDrawdown: 0,
          maxDrawdownDate: '2026-01-05',
          points: [],
          startDate: '2026-01-05'
        },
        error: null,
        meta: {}
      })
    );

    await render(request as unknown as DrawdownFetch);

    expect(container.textContent).toContain('No drawdown data for this range');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('handles short history with a single point without treating it as empty', async () => {
    const request = jest.fn().mockResolvedValue(
      apiResponse({
        data: {
          endDate: '2026-01-05',
          granularity: 'daily',
          maxDrawdown: 0,
          maxDrawdownDate: '2026-01-05',
          points: [{ date: '2026-01-05', drawdown: 0, isNewPeak: true }],
          startDate: '2026-01-05'
        },
        error: null,
        meta: {}
      })
    );

    await render(request as unknown as DrawdownFetch);

    expect(
      container.querySelector('[data-testid="drawdown-max"]')?.textContent
    ).toContain('0.00%');
    expect(
      container.querySelector('[data-testid="drawdown-short-history"]')
        ?.textContent
    ).toContain('Not enough history');
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.textContent).not.toContain(
      'No drawdown data for this range'
    );
  });

  it('shows a generic error message, not server text', async () => {
    const request = jest.fn().mockResolvedValue(
      apiResponse(
        {
          data: null,
          error: { code: 'CHARTS_DRAWDOWN_FAILED', message: 'private detail' },
          meta: {}
        },
        500
      )
    );

    await render(request as unknown as DrawdownFetch);

    expect(container.textContent).toContain(
      'Unable to load the drawdown chart'
    );
    expect(container.textContent).not.toContain('private detail');
    expect(container.textContent).toContain('Try again');
  });
});
