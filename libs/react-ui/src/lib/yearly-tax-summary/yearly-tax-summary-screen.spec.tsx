/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { ApiRequestError } from '../data/api-request';
import { YearlyTaxSummaryScreen } from './yearly-tax-summary-screen';
import type {
  YearlySummaryLoader,
  YearlySummarySelection
} from './yearly-tax-summary.client';

const summary = {
  baseCurrency: 'USD',
  calculatedAt: '2026-11-09T12:00:00.000Z',
  currencySummaries: [],
  dividendCount: 1,
  dividendRecords: [],
  disposalCount: 1,
  errors: [],
  grossCostBasisBaseCurrency: '1',
  grossDividendsBaseCurrency: '0.000000000000000001',
  grossProceedsBaseCurrency: '3',
  grossRealizedGainBaseCurrency: '2',
  isComplete: true,
  method: 'FIFO',
  netDividendsBaseCurrency: '0',
  realizedGainAfterActivityFeesBaseCurrency: '2',
  realizedGains: [],
  totalActivityFeesBaseCurrency: '0',
  totalWithholdingTaxBaseCurrency: '0',
  warnings: [],
  year: 2026
};

describe('YearlyTaxSummaryScreen', () => {
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

  async function render(load: YearlySummaryLoader, authRevision = 0) {
    await act(async () => {
      root.render(
        <YearlyTaxSummaryScreen
          authRevision={authRevision}
          initialYear={2026}
          load={load}
        />
      );
    });
  }

  const request = (response: unknown): YearlySummaryLoader =>
    jest.fn().mockResolvedValue(response) as YearlySummaryLoader;

  it('shows an accessible loading state during a pending request', async () => {
    const load: YearlySummaryLoader = jest.fn(
      () => new Promise<unknown>(() => undefined)
    );
    await render(load);
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.textContent).toContain('Loading');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('shows server-derived totals and the selected UTC year and method', async () => {
    const load = request(summary);
    await render(load);
    expect(container.textContent).toContain('0.000000000000000001');
    expect(container.textContent).toContain('FIFO');
    expect(container.textContent).toContain('2026');
    expect(load).toHaveBeenCalledWith(
      expect.objectContaining({ year: 2026, method: 'FIFO' })
    );
  });

  it('shows a true empty year only when the response is complete', async () => {
    await render(
      request({
        ...summary,
        dividendCount: 0,
        disposalCount: 0
      })
    );
    expect(container.textContent).toContain('No Tax activities for 2026');
    expect(container.querySelector('table')).toBeNull();
  });

  it('does not report a normal empty state for incomplete data', async () => {
    await render(
      request({
        ...summary,
        dividendCount: 0,
        disposalCount: 0,
        isComplete: false,
        warnings: [
          {
            code: 'PARTIAL_REALIZED_GAIN_RESULT',
            message: 'Partial history.',
            sellActivityIds: ['sell-1']
          }
        ]
      })
    );
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).toContain('Partial history');
    expect(container.textContent).not.toContain('No Tax activities for 2026');
  });

  it.each([401, 403])(
    'displays HTTP %s without retry or leaking error text',
    async (status) => {
      await render(
        jest
          .fn()
          .mockRejectedValue(
            new ApiRequestError(status, 'PRIVATE', 'sensitive backend text')
          ) as YearlySummaryLoader
      );
      expect(container.querySelector('[role="alert"]')).not.toBeNull();
      expect(container.textContent).not.toContain('sensitive backend text');
      expect(container.textContent).toContain(
        status === 401 ? 'Please sign in' : 'do not have permission'
      );
      expect(container.textContent).not.toContain('Try again');
    }
  );

  it('allows retry after server failure and then shows data', async () => {
    const load = jest
      .fn()
      .mockRejectedValueOnce(new ApiRequestError(503, 'TAX_FAILED', 'secret'))
      .mockResolvedValueOnce(summary) as YearlySummaryLoader;
    await render(load);
    expect(container.textContent).toContain('temporarily unavailable');
    const button = Array.from(container.querySelectorAll('button')).find(
      (item) => item.textContent?.includes('Try again')
    );
    expect(button).toBeDefined();
    await act(async () => {
      button?.click();
    });
    expect(load).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('0.000000000000000001');
  });

  it('rejects malformed responses with a safe error message', async () => {
    await render(request({ ...summary, grossRealizedGainBaseCurrency: 2.5 }));
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).not.toContain('2.5');
    expect(container.textContent).toContain('Unable to load');
  });

  it('aborts stale method requests and loads the new method', async () => {
    const load = jest.fn(({ method }: YearlySummarySelection) =>
      method === 'FIFO'
        ? new Promise<unknown>(() => undefined)
        : Promise.resolve({ ...summary, method: 'AVERAGE_COST' })
    ) as YearlySummaryLoader;
    await render(load);
    const first = (load as jest.Mock).mock.calls[0][0].signal as AbortSignal;
    expect(first.aborted).toBe(false);
    const selector = container.querySelector('select') as HTMLSelectElement;

    await act(async () => {
      selector.value = 'AVERAGE_COST';
      selector.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(first.aborted).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('AVERAGE_COST');
  });

  it('loads a selected UTC year and cancels the previous request', async () => {
    const load = jest.fn(({ year }: YearlySummarySelection) =>
      year === 2026
        ? new Promise<unknown>(() => undefined)
        : Promise.resolve({ ...summary, year: 2025 })
    ) as YearlySummaryLoader;
    await render(load);
    const first = (load as jest.Mock).mock.calls[0][0].signal as AbortSignal;
    const input = container.querySelector('input') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;
    await act(async () => {
      setter?.call(input, '2025');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(
      container.querySelector('button[type="submit"]')?.hasAttribute('disabled')
    ).toBe(false);
    await act(async () => {
      (container.querySelector('form') as HTMLFormElement).dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true })
      );
    });
    expect(first.aborted).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('2025');
  });

  it('aborts the old request when host authentication changes', async () => {
    const load: YearlySummaryLoader = jest.fn(
      () => new Promise<unknown>(() => undefined)
    );
    await render(load, 0);
    const signal = (load as jest.Mock).mock.calls[0][0].signal as AbortSignal;
    await render(load, 1);
    expect(signal.aborted).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not reload on callback identity change alone', async () => {
    const first = request(summary);
    await render(first);
    const second = request(summary);
    await render(second);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });
});
