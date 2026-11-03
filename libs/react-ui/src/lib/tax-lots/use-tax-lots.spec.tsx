/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { fetchTaxLots, useTaxLots } from './use-tax-lots';
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
  it('requests the correct API route and preserves decimal strings exactly', async () => {
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
    expect(data.lots[0].remainingQuantity).toBe('10.123456789012345677');
    expect(typeof data.lots[0].remainingQuantity).toBe('string');
  });

  it('accepts an empty response without changing its shape', async () => {
    const { request } = mockRequest(success({ lots: [] }));
    await expect(fetchTaxLots(request)).resolves.toEqual({ lots: [] });
  });

  it('preserves the incomplete-scope diagnostic', async () => {
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

  it('exposes an API error message', async () => {
    const { request } = mockRequest(
      {
        data: null,
        error: { code: 'TAX_LOTS_FAILED', message: 'Unable to derive lots' },
        meta: {}
      },
      422
    );

    await expect(fetchTaxLots(request)).rejects.toThrow(
      'Unable to derive lots'
    );
  });

  it('rejects malformed responses and quantities that are not strings', async () => {
    const malformed = mockRequest({
      data: { lots: null },
      error: null,
      meta: {}
    });
    await expect(fetchTaxLots(malformed.request)).rejects.toThrow(
      'Invalid tax-lots API response'
    );

    const badData = {
      lots: [{ ...completeData.lots[0], originalQuantity: 10.1 }]
    };
    const numeric = mockRequest(success(badData as unknown as TaxLotsData));
    await expect(fetchTaxLots(numeric.request)).rejects.toThrow(
      'Tax-lot quantities must be decimal strings'
    );
  });

  it('propagates a failed network request', async () => {
    const mock = jest.fn().mockRejectedValue(new Error('Network unavailable'));
    await expect(fetchTaxLots(mock as unknown as TaxLotsFetch)).rejects.toThrow(
      'Network unavailable'
    );
  });
});

describe('useTaxLots', () => {
  let container: HTMLDivElement;
  let root: Root;

  function Probe({ request }: { request: TaxLotsFetch }) {
    const { data, error, status } = useTaxLots(request);
    return (
      <div data-status={status}>
        {error?.message ?? data?.lots[0]?.remainingQuantity ?? ''}
      </div>
    );
  }

  beforeEach(() => {
    // React 18 requires this flag when testing state updates with act().
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

  it('updates from loading to ready with the backend decimal string', async () => {
    const { request } = mockRequest(success(completeData));

    await act(async () => {
      root.render(<Probe request={request} />);
    });

    expect(container.firstElementChild?.getAttribute('data-status')).toBe(
      'ready'
    );
    expect(container.textContent).toBe('10.123456789012345677');
  });

  it('reports empty and error states to the screen', async () => {
    const empty = mockRequest(success({ lots: [] }));

    await act(async () => {
      root.render(<Probe request={empty.request} />);
    });
    expect(container.firstElementChild?.getAttribute('data-status')).toBe(
      'empty'
    );

    const failed = mockRequest(
      {
        data: null,
        error: { code: 'TAX_LOTS_FAILED', message: 'Not available' },
        meta: {}
      },
      422
    );
    await act(async () => {
      root.render(<Probe request={failed.request} />);
    });
    expect(container.firstElementChild?.getAttribute('data-status')).toBe(
      'error'
    );
    expect(container.textContent).toBe('Not available');
  });
});
