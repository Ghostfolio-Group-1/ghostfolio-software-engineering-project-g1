/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import type { AuthenticatedFetch } from '../data/api-request';
import { ReturnComparisonView } from './return-comparison-view';

function apiResponse(body: unknown, status = 200): Response {
  return {
    json: jest.fn().mockResolvedValue(body),
    ok: status >= 200 && status < 300,
    status
  } as unknown as Response;
}

const comparison = {
  data: {
    endDate: '2026-02-01',
    granularity: 'daily',
    points: [
      { date: '2026-01-01', priceReturn: 100, totalReturn: 100 },
      { date: '2026-02-01', priceReturn: 110, totalReturn: 120 }
    ],
    startDate: '2026-01-01'
  },
  error: null,
  meta: {}
};

describe('ReturnComparisonView', () => {
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
      root.render(<ReturnComparisonView request={request} />);
    });
  }

  it('draws price return and total return on one chart', async () => {
    const request = jest.fn().mockResolvedValue(apiResponse(comparison));

    await render(request as unknown as AuthenticatedFetch);

    expect(request).toHaveBeenCalledWith(
      '/api/v1/charts/return-comparison?range=1y',
      expect.objectContaining({ method: 'GET' })
    );
    expect(container.textContent).toContain('Price return');
    expect(container.textContent).toContain('Total return');
    expect(container.querySelectorAll('path')).toHaveLength(2);
    expect(
      container.querySelector('svg')?.getAttribute('aria-label')
    ).toContain('2026-01-01');
  });

  it('requests a single holding when a symbol is applied', async () => {
    const request = jest.fn().mockResolvedValue(apiResponse(comparison));

    await render(request as unknown as AuthenticatedFetch);

    const input = container.querySelector('#return-symbol') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;

    await act(async () => {
      setter?.call(input, 'aapl');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      container
        .querySelector('form')
        ?.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true })
        );
    });

    expect(request).toHaveBeenCalledWith(
      '/api/v1/charts/return-comparison?range=1y&symbol=AAPL',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('shows a safe message for an unknown holding and an empty range', async () => {
    const request = jest.fn().mockResolvedValueOnce(
      apiResponse(
        {
          data: null,
          error: { code: 'CHARTS_SYMBOL_NOT_FOUND', message: 'private detail' },
          meta: {}
        },
        404
      )
    );

    await render(request as unknown as AuthenticatedFetch);

    expect(container.textContent).toContain(
      'That symbol is not in this portfolio for the selected range.'
    );
    expect(container.textContent).not.toContain('private detail');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('shows the empty state when the range has no points', async () => {
    const request = jest.fn().mockResolvedValue(
      apiResponse({
        data: {
          endDate: '2026-02-01',
          granularity: 'daily',
          points: [],
          startDate: '2026-01-01'
        },
        error: null,
        meta: {}
      })
    );

    await render(request as unknown as AuthenticatedFetch);

    expect(container.textContent).toContain('No data for this range');
    expect(container.querySelector('svg')).toBeNull();
  });
});
