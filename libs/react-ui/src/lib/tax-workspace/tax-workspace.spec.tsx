/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import type { AuthenticatedFetch } from '../data/api-request';
import { TaxWorkspace } from './tax-workspace';

function apiResponse(data: unknown): Response {
  return {
    json: jest.fn().mockResolvedValue({
      data,
      error: null,
      meta: {}
    }),
    ok: true,
    status: 200
  } as unknown as Response;
}

const emptyYearlySummary = {
  baseCurrency: 'USD',
  calculatedAt: '2026-11-10T00:00:00.000Z',
  currencySummaries: [],
  dividendCount: 0,
  dividendRecords: [],
  disposalCount: 0,
  errors: [],
  grossCostBasisBaseCurrency: '0',
  grossDividendsBaseCurrency: '0',
  grossProceedsBaseCurrency: '0',
  grossRealizedGainBaseCurrency: '0',
  isComplete: true,
  method: 'FIFO',
  netDividendsBaseCurrency: '0',
  realizedGainAfterActivityFeesBaseCurrency: '0',
  realizedGains: [],
  totalActivityFeesBaseCurrency: '0',
  totalWithholdingTaxBaseCurrency: '0',
  warnings: [],
  year: new Date().getUTCFullYear()
};

describe('TaxWorkspace', () => {
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

  async function render(request: AuthenticatedFetch, authRevision = 0) {
    await act(async () => {
      root.render(
        <TaxWorkspace authRevision={authRevision} request={request} />
      );
    });
  }

  async function select(label: string) {
    const button = Array.from(container.querySelectorAll('button')).find(
      (element) => element.textContent?.trim() === label
    );

    expect(button).toBeDefined();

    await act(async () => {
      button?.click();
    });
  }

  it('loads only the active Tax screen from the supplied adapter', async () => {
    const request = jest.fn(
      (_url: string, _init?: RequestInit) =>
        new Promise<Response>(() => undefined)
    );

    await render(request as unknown as AuthenticatedFetch);

    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe('/api/v1/tax/lots');
    expect(container.querySelector('[role="status"]')).not.toBeNull();

    const firstSignal = request.mock.calls[0][1]?.signal;
    expect(firstSignal?.aborted).toBe(false);

    await select('Realized gains');

    expect(firstSignal?.aborted).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1][0]).toBe(
      '/api/v1/tax/realized-gains?method=FIFO'
    );

    await select('Dividend withholding');

    expect(request.mock.calls[1][1]?.signal?.aborted).toBe(true);
    expect(request.mock.calls[2][0]).toMatch(
      /^\/api\/v1\/tax\/dividends\?year=\d{4}$/
    );

    await select('Yearly summary');

    expect(request.mock.calls[2][1]?.signal?.aborted).toBe(true);
    expect(request.mock.calls[3][0]).toMatch(
      /^\/api\/v1\/tax\/yearly-summary\?year=\d{4}&method=FIFO$/
    );
  });

  it('exposes accessible navigation and the active view', async () => {
    const request = jest.fn(() => new Promise<Response>(() => undefined));

    await render(request as unknown as AuthenticatedFetch);

    const buttons = container.querySelectorAll(
      '[role="group"][aria-label="Tax analytics views"] button'
    );

    expect(buttons).toHaveLength(4);
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');

    await select('Dividend withholding');

    expect(buttons[0].getAttribute('aria-pressed')).toBe('false');
    expect(buttons[2].getAttribute('aria-pressed')).toBe('true');
    expect(
      container.querySelector('[aria-label="Dividend withholding view"]')
    ).not.toBeNull();
  });

  it('uses scoped, theme-aware styling and visibly tracks the selected view', async () => {
    const request = jest.fn(() => new Promise<Response>(() => undefined));

    await render(request as unknown as AuthenticatedFetch);

    const workspace = container.querySelector(
      '.gf-tax-workspace'
    ) as HTMLElement;

    expect(workspace).not.toBeNull();
    expect(workspace.style.getPropertyValue('--gf-tax-primary')).toBe(
      '#36cfcc'
    );
    expect(workspace.querySelector('style')?.textContent).toContain(
      '.gf-tax-workspace select'
    );
    expect(
      workspace.querySelector('.gf-tax-workspace__tab[aria-pressed="true"]')
        ?.textContent
    ).toBe('Tax lots');

    await select('Realized gains');

    expect(
      workspace.querySelector('.gf-tax-workspace__tab[aria-pressed="true"]')
        ?.textContent
    ).toBe('Realized gains');
  });

  it('renders API-driven empty states without preloading all views', async () => {
    const request = jest.fn((url: string) => {
      if (url === '/api/v1/tax/lots') {
        return Promise.resolve(apiResponse({ lots: [] }));
      }
      if (url.includes('/realized-gains')) {
        return Promise.resolve(apiResponse({ method: 'FIFO', sales: [] }));
      }
      if (url.includes('/dividends?')) {
        return Promise.resolve(apiResponse({ records: [] }));
      }
      if (url.includes('/yearly-summary?')) {
        return Promise.resolve(apiResponse(emptyYearlySummary));
      }
      return Promise.reject(new Error('Unexpected endpoint'));
    });

    await render(request as unknown as AuthenticatedFetch);

    expect(container.textContent).toContain('No FIFO tax lots available');
    expect(request).toHaveBeenCalledTimes(1);

    await select('Realized gains');
    expect(container.textContent).toContain('No realized sales for FIFO');

    await select('Dividend withholding');
    expect(container.textContent).toContain('No tax-relevant dividend records');

    await select('Yearly summary');
    expect(container.textContent).toContain('No Tax activities for');
    expect(request).toHaveBeenCalledTimes(4);
  });

  it('shows a safe API error without exposing server details', async () => {
    const request = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        data: null,
        error: {
          code: 'TAX_FAILED',
          message: 'private server details'
        },
        meta: {}
      }),
      ok: false,
      status: 503
    });

    await render(request as AuthenticatedFetch);

    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).toContain('temporarily unavailable');
    expect(container.textContent).not.toContain('private server details');
  });

  it('refreshes the active screen when authentication changes', async () => {
    const request = jest.fn(
      (_url: string, _init?: RequestInit) =>
        new Promise<Response>(() => undefined)
    );
    const adapter = request as unknown as AuthenticatedFetch;

    await render(adapter, 0);
    const firstSignal = request.mock.calls[0][1]?.signal;

    await render(adapter, 1);

    expect(firstSignal?.aborted).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1][0]).toBe('/api/v1/tax/lots');
  });
});
