/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { fetchTaxLots, TaxLotsApiError, useTaxLots } from './use-tax-lots';
import type { TaxLotsData, TaxLotsFetch } from './use-tax-lots';

const completeData: TaxLotsData = {
  lots: [
    {
      accountId: 'account-1',
      acquiredAt: '2026-01-05T00:00:00.000Z',
      consumedQuantity: '0.000000000000000001',
      currency: 'USD',
      lotId: 'lot-1',
      originalQuantity: '10.123456789012345678',
      relatedSellActivityIds: ['sell-1'],
      remainingQuantity: '10.123456789012345677',
      sourceActivityId: 'buy-1',
      status: 'PARTIALLY_CONSUMED',
      symbolProfileId: 'asset-1'
    }
  ]
};

function httpResponse(body: unknown, status = 200): Response {
  return {
    json: jest.fn().mockResolvedValue(body),
    ok: status >= 200 && status < 300,
    status
  } as unknown as Response;
}

function mockRequest(body: unknown, status = 200) {
  const mock = jest.fn().mockResolvedValue(httpResponse(body, status));
  return { mock, request: mock as unknown as TaxLotsFetch };
}

const success = (data: TaxLotsData) => ({ data, error: null, meta: {} });

describe('fetchTaxLots', () => {
  it('requests the right route and keeps all quantities as decimal strings', async () => {
    const { mock, request } = mockRequest(success(completeData));
    const controller = new AbortController();
    const data = await fetchTaxLots(request, controller.signal);

    expect(mock).toHaveBeenCalledWith(
      '/api/v1/tax/lots',
      expect.objectContaining({
        credentials: 'same-origin',
        method: 'GET',
        signal: controller.signal
      })
    );
    expect(data).toEqual(completeData);
    expect(data.lots[0].originalQuantity).toBe('10.123456789012345678');
    expect(data.lots[0].consumedQuantity).toBe('0.000000000000000001');
    expect(data.lots[0].remainingQuantity).toBe('10.123456789012345677');
    for (const key of [
      'originalQuantity',
      'consumedQuantity',
      'remainingQuantity'
    ] as const) {
      expect(typeof data.lots[0][key]).toBe('string');
    }
  });

  it('keeps the API empty shape intact', async () => {
    const { request } = mockRequest(success({ lots: [] }));
    await expect(fetchTaxLots(request)).resolves.toEqual({ lots: [] });
  });

  it('preserves incomplete-scope diagnostics', async () => {
    const data: TaxLotsData = {
      diagnostics: [
        {
          affectedSellActivityIds: ['sell-2'],
          code: 'TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY',
          excludedActivityIds: ['buy-2'],
          message: 'Investment history is incomplete.'
        }
      ],
      isComplete: false,
      lots: []
    };
    const { request } = mockRequest(success(data));
    await expect(fetchTaxLots(request)).resolves.toEqual(data);
  });

  it('exposes status and code without rendering backend error text', async () => {
    const { request } = mockRequest(
      {
        data: null,
        error: {
          code: 'TAX_LOTS_FAILED',
          message: 'Internal database details'
        },
        meta: {}
      },
      422
    );
    await expect(fetchTaxLots(request)).rejects.toMatchObject({
      code: 'TAX_LOTS_FAILED',
      message: 'Unable to load tax lots',
      name: 'TaxLotsApiError',
      status: 422
    });
  });

  it('preserves the 401 status for login handling', async () => {
    const { request } = mockRequest({ data: null, error: null, meta: {} }, 401);
    await expect(fetchTaxLots(request)).rejects.toMatchObject({
      message: 'Please sign in to view tax lots',
      status: 401
    });
  });

  it('reports a non-JSON server response with a typed error', async () => {
    const request = jest.fn().mockResolvedValue({
      json: jest.fn().mockRejectedValue(new SyntaxError('invalid HTML')),
      ok: false,
      status: 500
    });
    await expect(
      fetchTaxLots(request as unknown as TaxLotsFetch)
    ).rejects.toMatchObject({
      code: 'TAX_INVALID_RESPONSE',
      status: 500
    });
  });

  it('rejects a missing data body and null lot entries', async () => {
    const malformed = mockRequest({
      data: { lots: null },
      error: null,
      meta: {}
    });
    await expect(fetchTaxLots(malformed.request)).rejects.toThrow(
      'Invalid tax-lots API response'
    );
    const nullLot = mockRequest(
      success({ lots: [null] } as unknown as TaxLotsData)
    );
    await expect(fetchTaxLots(nullLot.request)).rejects.toThrow(
      'Tax-lot quantities must be decimal strings'
    );
  });

  it.each([
    'originalQuantity',
    'consumedQuantity',
    'remainingQuantity'
  ] as const)('rejects numeric %s instead of coercing it', async (key) => {
    const badData = {
      lots: [{ ...completeData.lots[0], [key]: 10.1 }]
    };
    const numeric = mockRequest(success(badData as unknown as TaxLotsData));
    await expect(fetchTaxLots(numeric.request)).rejects.toThrow(
      'Tax-lot quantities must be decimal strings'
    );
  });

  it('propagates network failures', async () => {
    const request = jest
      .fn()
      .mockRejectedValue(new Error('Network unavailable'));
    await expect(
      fetchTaxLots(request as unknown as TaxLotsFetch)
    ).rejects.toThrow('Network unavailable');
  });

  it('has a dedicated typed API error', () => {
    const error = new TaxLotsApiError(500, 'TAX_LOTS_FAILED', 'Request failed');
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(500);
    expect(error.code).toBe('TAX_LOTS_FAILED');
  });
});

describe('useTaxLots', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latestHook: ReturnType<typeof useTaxLots> | null = null;

  function Probe({ request }: { request: TaxLotsFetch }) {
    const result = useTaxLots(request);
    latestHook = result;
    return (
      <div
        data-status={result.status}
        data-complete={String(result.isComplete)}
      >
        {result.error?.message ?? result.data?.lots[0]?.remainingQuantity ?? ''}
      </div>
    );
  }

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    latestHook = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('starts loading, then becomes ready with the exact decimal string', async () => {
    let resolveResponse: (value: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const mock = jest.fn().mockReturnValue(pending);
    const request = mock as unknown as TaxLotsFetch;

    await act(async () => {
      root.render(<Probe request={request} />);
    });
    expect(container.firstElementChild?.getAttribute('data-status')).toBe(
      'loading'
    );

    await act(async () => {
      resolveResponse(httpResponse(success(completeData)));
      await pending;
    });
    expect(container.firstElementChild?.getAttribute('data-status')).toBe(
      'ready'
    );
    expect(container.textContent).toBe('10.123456789012345677');
    expect(latestHook?.isComplete).toBe(true);
    expect(latestHook?.diagnostics).toEqual([]);
  });

  it('reports a complete empty response as empty', async () => {
    const { request } = mockRequest(success({ lots: [] }));
    await act(async () => {
      root.render(<Probe request={request} />);
    });
    expect(container.firstElementChild?.getAttribute('data-status')).toBe(
      'empty'
    );
  });

  it('keeps incomplete histories visible even with zero lots', async () => {
    const diagnostic: NonNullable<TaxLotsData['diagnostics']>[number] = {
      affectedSellActivityIds: ['sell-1'],
      code: 'TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY',
      excludedActivityIds: ['buy-1'],
      message: 'Some history is excluded'
    };
    const { request } = mockRequest(
      success({ diagnostics: [diagnostic], isComplete: false, lots: [] })
    );
    await act(async () => {
      root.render(<Probe request={request} />);
    });
    expect(container.firstElementChild?.getAttribute('data-status')).toBe(
      'ready'
    );
    expect(latestHook?.isComplete).toBe(false);
    expect(latestHook?.diagnostics).toEqual([diagnostic]);
  });

  it('exposes API errors without leaking server messages', async () => {
    const { request } = mockRequest(
      {
        data: null,
        error: { code: 'TAX_LOTS_FAILED', message: 'Internal information' },
        meta: {}
      },
      422
    );
    await act(async () => {
      root.render(<Probe request={request} />);
    });
    expect(container.firstElementChild?.getAttribute('data-status')).toBe(
      'error'
    );
    expect(container.textContent).toBe('Unable to load tax lots');
    expect(latestHook?.error).toMatchObject({
      status: 422,
      code: 'TAX_LOTS_FAILED'
    });
  });

  it('does not re-request when an inline callback identity changes on rerender', async () => {
    const first = mockRequest(success(completeData));
    const second = mockRequest(success(completeData));
    await act(async () => {
      root.render(<Probe request={first.request} />);
    });
    await act(async () => {
      root.render(<Probe request={second.request} />);
    });
    expect(first.mock).toHaveBeenCalledTimes(1);
    expect(second.mock).not.toHaveBeenCalled();
    expect(container.firstElementChild?.getAttribute('data-status')).toBe(
      'ready'
    );
  });

  it('reloads with the latest authenticated request callback', async () => {
    const first = mockRequest(success(completeData));
    const second = mockRequest(success({ lots: [] }));
    await act(async () => {
      root.render(<Probe request={first.request} />);
    });
    await act(async () => {
      root.render(<Probe request={second.request} />);
    });
    await act(async () => {
      latestHook?.reload();
    });
    expect(first.mock).toHaveBeenCalledTimes(1);
    expect(second.mock).toHaveBeenCalledTimes(1);
    expect(container.firstElementChild?.getAttribute('data-status')).toBe(
      'empty'
    );
  });

  it('aborts the in-flight request on unmount', async () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const secondRoot = createRoot(div);
    const pending = new Promise<Response>(() => undefined);
    const request = jest.fn().mockReturnValue(pending);
    await act(async () => {
      secondRoot.render(<Probe request={request as unknown as TaxLotsFetch} />);
    });
    const signal: AbortSignal = request.mock.calls[0][1].signal;
    expect(signal.aborted).toBe(false);
    act(() => secondRoot.unmount());
    expect(signal.aborted).toBe(true);
    div.remove();
  });
});
