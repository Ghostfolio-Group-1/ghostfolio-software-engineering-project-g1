/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import type { AuthenticatedFetch } from '../data/api-request';
import { RealizedGainsScreen } from './realized-gains-screen';

const fifoSale = {
  allocatedAcquisitionFees: '0.125',
  allocatedBuyFees: '0.125',
  allocatedSellFee: '0.25',
  currency: 'USD',
  grossCostBasis: '10.123456789012345678901',
  grossProceeds: '12',
  grossRealizedGain: '1.876543210987654321099',
  matchedQuantity: '0.5',
  matches: [],
  realizedGainAfterActivityFees: '1.501543210987654321099',
  sellActivityId: 'fifo-sell-1',
  sellDate: '2026-01-01T00:01:00.000Z',
  sellFee: '0.25',
  sellQuantity: '0.5'
};

const averageSale = {
  allocatedAcquisitionFees: fifoSale.allocatedAcquisitionFees,
  allocatedSellFee: fifoSale.allocatedSellFee,
  currency: fifoSale.currency,
  grossCostBasis: fifoSale.grossCostBasis,
  grossProceeds: fifoSale.grossProceeds,
  grossRealizedGain: fifoSale.grossRealizedGain,
  matchedQuantity: fifoSale.matchedQuantity,
  realizedGainAfterActivityFees: fifoSale.realizedGainAfterActivityFees,
  sellDate: fifoSale.sellDate,
  sellFee: fifoSale.sellFee,
  sellQuantity: fifoSale.sellQuantity,
  poolAfter: {
    acquisitionFeePool: '0.1',
    grossCost: '20',
    quantity: '1.5'
  },
  poolBefore: {
    acquisitionFeePool: '0.225',
    grossCost: '30',
    quantity: '2'
  },
  sellActivityId: 'average-sell-2'
};

const fifoData = { method: 'FIFO', sales: [fifoSale] };
const averageData = { method: 'AVERAGE_COST', sales: [averageSale] };

function response(body: unknown, status = 200): Response {
  return {
    json: jest.fn().mockResolvedValue(body),
    ok: status >= 200 && status < 300,
    status
  } as unknown as Response;
}

function success(data: unknown): Response {
  return response({ data, error: null, meta: {} });
}

function failure(status: number): Response {
  return response(
    {
      data: null,
      error: {
        code: 'TAX_REALIZED_GAINS_FAILED',
        message: 'private server calculation details'
      },
      meta: {}
    },
    status
  );
}

describe('RealizedGainsScreen', () => {
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
        <RealizedGainsScreen request={request} authRevision={authRevision} />
      );
    });
  }

  function methodInput(): HTMLSelectElement {
    return container.querySelector('select') as HTMLSelectElement;
  }

  function retryButton(): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Try again'
    );
  }

  it('renders loading while the API request is pending', async () => {
    const request = jest.fn(() => new Promise<Response>(() => undefined));
    await render(request as unknown as AuthenticatedFetch);

    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.textContent).toContain('Loading');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('renders exact decimal text from the live Tax endpoint through the injected adapter', async () => {
    const request = jest.fn().mockResolvedValue(success(fifoData));
    await render(request as unknown as AuthenticatedFetch);

    expect(request).toHaveBeenCalledWith(
      '/api/v1/tax/realized-gains?method=FIFO',
      expect.objectContaining({ method: 'GET' })
    );
    expect(container.textContent).toContain('fifo-sell-1');
    expect(container.textContent).toContain('2026-01-01');
    expect(container.textContent).toContain('1.876543210987654321099');
    expect(container.textContent).toContain('1.501543210987654321099');
    expect(container.querySelectorAll('table')).toHaveLength(1);
  });

  it('shows an empty state for complete history with no sales', async () => {
    const request = jest
      .fn()
      .mockResolvedValue(success({ method: 'FIFO', sales: [] }));
    await render(request as unknown as AuthenticatedFetch);

    expect(container.textContent).toContain('No realized sales for FIFO');
    expect(container.querySelector('table')).toBeNull();
  });

  it('does not misreport excluded history as an ordinary empty state', async () => {
    const request = jest.fn().mockResolvedValue(
      success({
        diagnostics: [
          {
            affectedSellActivityIds: ['sell-excluded'],
            code: 'TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY',
            excludedActivityIds: ['buy-excluded'],
            message: 'Incomplete source history.'
          }
        ],
        isComplete: false,
        method: 'FIFO',
        sales: []
      })
    );
    await render(request as unknown as AuthenticatedFetch);

    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).toContain('Tax results may be incomplete');
    expect(container.querySelector('table')).not.toBeNull();
  });

  it.each([401, 403])(
    'hides retry for authorization error %s and does not reveal server text',
    async (status) => {
      const request = jest.fn().mockResolvedValue(failure(status));
      await render(request as unknown as AuthenticatedFetch);

      expect(container.querySelector('[role="alert"]')).not.toBeNull();
      expect(container.textContent).toContain(
        status === 401 ? 'Please sign in' : 'do not have permission'
      );
      expect(container.textContent).not.toContain('private server');
      expect(retryButton()).toBeUndefined();
    }
  );

  it.each([422, 500])(
    'retries an API error %s with safe error copy',
    async (status) => {
      const request = jest
        .fn()
        .mockResolvedValueOnce(failure(status))
        .mockResolvedValueOnce(success(fifoData));
      await render(request as unknown as AuthenticatedFetch);

      expect(container.querySelector('[role="alert"]')).not.toBeNull();
      expect(container.textContent).not.toContain('private server');
      expect(retryButton()).toBeDefined();

      await act(async () => {
        retryButton()?.click();
      });

      expect(request).toHaveBeenCalledTimes(2);
      expect(container.textContent).toContain('fifo-sell-1');
    }
  );

  it('shows an error rather than rendering an imprecise numeric API response', async () => {
    const request = jest.fn().mockResolvedValue(
      success({
        method: 'FIFO',
        sales: [{ ...fifoSale, grossProceeds: 12.5 }]
      })
    );
    await render(request as unknown as AuthenticatedFetch);

    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.querySelector('table')).toBeNull();
    expect(container.textContent).toContain('Unable to load realized gains');
  });

  it('switches to average cost, aborting the earlier FIFO request', async () => {
    const request = jest.fn((url: string) => {
      if (url.includes('method=FIFO')) {
        return new Promise<Response>(() => undefined);
      }
      return Promise.resolve(success(averageData));
    });
    await render(request as unknown as AuthenticatedFetch);

    const firstSignal = (request.mock.calls[0] as unknown[])[1] as {
      signal: AbortSignal;
    };
    expect(firstSignal.signal.aborted).toBe(false);

    await act(async () => {
      methodInput().value = 'AVERAGE_COST';
      methodInput().dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(firstSignal.signal.aborted).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1][0]).toBe(
      '/api/v1/tax/realized-gains?method=AVERAGE_COST'
    );
    expect(container.textContent).toContain('average-sell-2');
    expect(container.textContent).not.toContain('fifo-sell-1');
  });

  it('ignores a stale FIFO response arriving after average cost is selected', async () => {
    let resolveFifo: (result: Response) => void = () => undefined;
    const pendingFifo = new Promise<Response>((resolve) => {
      resolveFifo = resolve;
    });
    const request = jest.fn((url: string) =>
      url.includes('method=FIFO')
        ? pendingFifo
        : Promise.resolve(success(averageData))
    );

    await render(request as unknown as AuthenticatedFetch);
    await act(async () => {
      methodInput().value = 'AVERAGE_COST';
      methodInput().dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.textContent).toContain('average-sell-2');

    await act(async () => {
      resolveFifo(success(fifoData));
    });

    expect(container.textContent).toContain('average-sell-2');
    expect(container.textContent).not.toContain('fifo-sell-1');
  });

  it('refetches on host auth revision but not just when callback identity changes', async () => {
    const first = jest.fn().mockResolvedValue(success(fifoData));
    await render(first as unknown as AuthenticatedFetch, 0);
    expect(first).toHaveBeenCalledTimes(1);

    const second = jest.fn().mockResolvedValue(success(fifoData));
    await render(second as unknown as AuthenticatedFetch, 0);
    expect(second).not.toHaveBeenCalled();

    await render(second as unknown as AuthenticatedFetch, 1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
