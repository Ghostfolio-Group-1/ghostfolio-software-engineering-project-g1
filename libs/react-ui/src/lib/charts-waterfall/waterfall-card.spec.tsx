/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { darkTheme } from '../theme/theme';
import type { Theme } from '../theme/theme';
import { ThemeProvider } from '../theme/theme-provider';
import { WaterfallCard } from './waterfall-card';
import type { WaterfallData, WaterfallFetch } from './waterfall.client';

function apiResponse(body: unknown, status = 200): Response {
  return {
    json: jest.fn().mockResolvedValue(body),
    ok: status >= 200 && status < 300,
    status
  } as unknown as Response;
}

const waterfall: {
  data: WaterfallData;
  error: null;
  meta: Record<string, never>;
} = {
  data: {
    currency: 'USD',
    endDate: '2026-02-01',
    segments: [
      { kind: 'start', label: 'Start', value: 10000 },
      {
        category: 'netCashFlow',
        kind: 'contribution',
        label: 'Net cash flow',
        value: 500
      },
      {
        category: 'marketGainLoss',
        kind: 'contribution',
        label: 'Market',
        value: 200
      },
      {
        category: 'dividends',
        kind: 'contribution',
        label: 'Dividends',
        value: 50
      },
      { kind: 'end', label: 'End', value: 10750 }
    ],
    startDate: '2026-01-01'
  },
  error: null,
  meta: {}
};

describe('WaterfallCard', () => {
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
    request: WaterfallFetch,
    range: { range: string } | { endDate: string; startDate: string } = {
      range: '1y'
    },
    theme?: Theme
  ) {
    await act(async () => {
      root.render(
        <ThemeProvider theme={theme}>
          <WaterfallCard range={range} request={request} />
        </ThemeProvider>
      );
    });
  }

  it('draws waterfall bars for the shared range', async () => {
    const request = jest.fn().mockResolvedValue(apiResponse(waterfall));

    await render(request as unknown as WaterfallFetch);

    expect(request).toHaveBeenCalledWith(
      '/api/v1/charts/waterfall?range=1y',
      expect.objectContaining({ method: 'GET' })
    );
    expect(container.textContent).toContain('Net cash flow');
    expect(container.textContent).toContain('Market gain/loss');
    expect(container.textContent).toContain('Dividends');
    expect(
      container.querySelectorAll('[data-testid="waterfall-bar-start"]')
    ).toHaveLength(1);
    expect(
      container.querySelectorAll('[data-testid="waterfall-bar-contribution"]')
    ).toHaveLength(3);
    expect(
      container.querySelectorAll('[data-testid="waterfall-bar-end"]')
    ).toHaveLength(1);
    expect(
      container.querySelector('svg')?.getAttribute('aria-label')
    ).toContain('2026-01-01');
  });

  it('keeps the shared range and only changes breakdown', async () => {
    const request = jest.fn().mockResolvedValue(apiResponse(waterfall));

    await render(request as unknown as WaterfallFetch);

    const holding = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'By holding'
    );

    await act(async () => {
      holding?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(request).toHaveBeenLastCalledWith(
      '/api/v1/charts/waterfall?range=1y&breakdown=holding',
      expect.objectContaining({ method: 'GET' })
    );
    expect(
      container.querySelector('[data-testid="waterfall-breakdown-toggle"]')
    ).not.toBeNull();
  });

  it('shows the empty state when the range has no segments', async () => {
    const request = jest.fn().mockResolvedValue(
      apiResponse({
        data: {
          currency: 'USD',
          endDate: '2026-02-01',
          segments: [],
          startDate: '2026-01-01'
        },
        error: null,
        meta: {}
      })
    );

    await render(request as unknown as WaterfallFetch);

    expect(container.textContent).toContain(
      'No contribution data for this range'
    );
    expect(container.querySelector('svg')).toBeNull();
    expect(
      container.querySelector('[data-testid="waterfall-breakdown-toggle"]')
    ).not.toBeNull();
  });

  it('shows a generic error message, not server text', async () => {
    const request = jest.fn().mockResolvedValue(
      apiResponse(
        {
          data: null,
          error: { code: 'CHARTS_WATERFALL_FAILED', message: 'private detail' },
          meta: {}
        },
        500
      )
    );

    await render(request as unknown as WaterfallFetch);

    expect(container.textContent).toContain(
      'Unable to load the contribution chart'
    );
    expect(container.textContent).not.toContain('private detail');
    expect(container.textContent).toContain('Try again');
  });

  it('uses custom start and end dates from the shared range', async () => {
    const request = jest.fn().mockResolvedValue(apiResponse(waterfall));

    await render(request as unknown as WaterfallFetch, {
      endDate: '2026-06-01',
      startDate: '2026-01-01'
    });

    expect(request).toHaveBeenCalledWith(
      '/api/v1/charts/waterfall?startDate=2026-01-01&endDate=2026-06-01',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('keeps unselected breakdown toggle readable under darkTheme', async () => {
    const request = jest.fn().mockResolvedValue(apiResponse(waterfall));

    await render(
      request as unknown as WaterfallFetch,
      { range: '1y' },
      darkTheme
    );

    const unselected = Array.from(container.querySelectorAll('button')).find(
      (button) =>
        button.textContent === 'By holding' &&
        button.getAttribute('aria-pressed') === 'false'
    );

    expect(unselected).toBeDefined();
    expect(unselected?.style.color).not.toBe(unselected?.style.background);
    // Regression: light surface (#fafafa) + dark text was white-on-white.
    expect(unselected?.style.background).not.toBe('#fafafa');
    expect(unselected?.style.background).not.toBe('rgb(250, 250, 250)');
  });
});
