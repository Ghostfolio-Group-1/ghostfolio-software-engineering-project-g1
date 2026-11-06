/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import type { AuthenticatedFetch } from '../data/api-request';
import { DividendWithholdingScreen } from './dividend-withholding-screen';

const dividend = {
  accountId: 'account-1',
  activityFee: '0.25',
  date: '2026-01-01T00:30:00.000Z',
  grossDividend: '10.1234567890123456789',
  netDividend: null,
  sourceActivityId: 'dividend-1',
  symbolProfileId: 'asset-1',
  transactionCurrency: 'USD',
  withholdingTax: null
};

function apiResponse(body: unknown, status = 200): Response {
  return {
    json: jest.fn().mockResolvedValue(body),
    ok: status >= 200 && status < 300,
    status
  } as unknown as Response;
}

function successful(records: unknown[]): Response {
  return apiResponse({ data: { records }, error: null, meta: {} });
}

function errorResponse(status: number): Response {
  return apiResponse(
    {
      data: null,
      error: { code: 'TAX_DIVIDENDS_FAILED', message: 'private detail' },
      meta: {}
    },
    status
  );
}

describe('DividendWithholdingScreen', () => {
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
    request: AuthenticatedFetch,
    initialYear = 2026,
    authRevision = 0
  ) {
    await act(async () => {
      root.render(
        <DividendWithholdingScreen
          authRevision={authRevision}
          initialYear={initialYear}
          request={request}
        />
      );
    });
  }

  function mockRequest(response: Response) {
    const mock = jest.fn().mockResolvedValue(response);
    return { mock, request: mock as unknown as AuthenticatedFetch };
  }

  function retryButton(): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Try again'
    );
  }

  it('shows an accessible loading state while the real request is pending', async () => {
    const request = jest.fn(() => new Promise<Response>(() => undefined));
    await render(request as unknown as AuthenticatedFetch);

    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.textContent).toContain('Loading');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('renders authoritative decimal strings, unknown withholding, and UTC calendar date', async () => {
    const { mock, request } = mockRequest(successful([dividend]));
    await render(request);

    expect(container.textContent).toContain('10.1234567890123456789');
    expect(container.textContent).toContain('Unknown');
    expect(container.textContent).toContain('Not available');
    expect(container.textContent).toContain('2026-01-01');
    expect(container.textContent).toContain('dividend-1');
    expect(container.textContent).toContain('USD');
    expect(container.querySelectorAll('table')).toHaveLength(1);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('shows a distinct known-zero withholding and keeps net value unmodified', async () => {
    const { request } = mockRequest(
      successful([{ ...dividend, withholdingTax: '0', netDividend: '9.86' }])
    );
    await render(request);

    expect(container.textContent).toContain('9.86');
    expect(container.textContent).not.toContain('Unknown');
    expect(container.textContent).toContain('0');
  });

  it('shows the empty state for an empty year', async () => {
    const { request } = mockRequest(successful([]));
    await render(request);

    expect(container.textContent).toContain(
      'No tax-relevant dividend records for 2026'
    );
    expect(container.querySelector('table')).toBeNull();
  });

  it.each([401, 403])(
    'does not offer retry for auth failure %s',
    async (status) => {
      const { request } = mockRequest(errorResponse(status));
      await render(request);

      expect(container.querySelector('[role="alert"]')).not.toBeNull();
      expect(container.textContent).not.toContain('private detail');
      expect(retryButton()).toBeUndefined();
      expect(container.textContent).toContain(
        status === 401 ? 'Please sign in' : 'do not have permission'
      );
    }
  );

  it.each([422, 500])(
    'shows a safe error and retries HTTP %s',
    async (status) => {
      const mock = jest
        .fn()
        .mockResolvedValueOnce(errorResponse(status))
        .mockResolvedValueOnce(successful([dividend]));
      await render(mock as unknown as AuthenticatedFetch);

      expect(container.querySelector('[role="alert"]')).not.toBeNull();
      expect(container.textContent).not.toContain('private detail');
      const button = retryButton();
      expect(button).toBeDefined();

      await act(async () => {
        button?.click();
      });
      expect(mock).toHaveBeenCalledTimes(2);
      expect(container.textContent).toContain('dividend-1');
    }
  );

  it('shows a safe error for an invalid API response', async () => {
    const { request } = mockRequest(
      apiResponse({
        data: { records: [{ ...dividend, grossDividend: 10.5 }] },
        error: null,
        meta: {}
      })
    );
    await render(request);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).toContain('Unable to load dividend records');
    expect(container.textContent).not.toContain('10.5');
  });

  it('does not refetch merely because the request callback has a new identity', async () => {
    const first = jest.fn().mockResolvedValue(successful([dividend]));
    await render(first as unknown as AuthenticatedFetch);
    const next = jest.fn().mockResolvedValue(successful([dividend]));
    await render(next as unknown as AuthenticatedFetch);

    expect(first).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  it('aborts the pending request when the host auth revision changes', async () => {
    const request = jest.fn(() => new Promise<Response>(() => undefined));
    await render(request as unknown as AuthenticatedFetch, 2026, 0);
    const firstSignal = (request.mock.calls[0] as unknown[])[1] as {
      signal: AbortSignal;
    };
    expect(firstSignal.signal.aborted).toBe(false);

    await render(request as unknown as AuthenticatedFetch, 2026, 1);
    expect(firstSignal.signal.aborted).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('rejects an invalid input year before any request is made', async () => {
    const { mock, request } = mockRequest(successful([dividend]));
    await render(request);
    const input = container.querySelector('input') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;

    await act(async () => {
      setter?.call(input, '999');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(
      container.querySelector('button[type="submit"]')?.hasAttribute('disabled')
    ).toBe(true);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('reloads the selected year and aborts the previous request', async () => {
    const request = jest.fn((url: string) => {
      if (url.includes('year=2026')) {
        return new Promise<Response>(() => undefined);
      }
      return Promise.resolve(
        successful([{ ...dividend, sourceActivityId: 'dividend-2025' }])
      );
    });
    await render(request as unknown as AuthenticatedFetch);
    const firstSignal = (request.mock.calls[0] as unknown[])[1] as {
      signal: AbortSignal;
    };
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

    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1][0]).toBe('/api/v1/tax/dividends?year=2025');
    expect(firstSignal.signal.aborted).toBe(true);
    expect(container.textContent).toContain('dividend-2025');
  });
});
