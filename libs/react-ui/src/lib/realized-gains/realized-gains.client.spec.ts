import { ApiRequestError } from '../data/api-request';
import type { AuthenticatedFetch } from '../data/api-request';
import { fetchRealizedGains } from './realized-gains.client';
import type {
  AverageCostGainSale,
  FifoGainSale,
  RealizedGainsData
} from './realized-gains.client';

const sale: FifoGainSale = {
  allocatedAcquisitionFees: '0.1',
  allocatedBuyFees: '0.1',
  allocatedSellFee: '0.2',
  currency: null,
  grossCostBasis: '10.123456789012345678901',
  grossProceeds: '10.123456789012345678900',
  grossRealizedGain: '-0.000000000000000000001',
  matchedQuantity: '0.5',
  matches: [
    {
      buyActivityId: 'buy-1',
      buyFeeAllocated: '0.1',
      grossAcquisitionValue: '10.123456789012345678901',
      grossProceeds: '10.123456789012345678900',
      grossRealizedGain: '-0.000000000000000000001',
      lotId: 'lot-1',
      matchedQuantity: '0.5',
      realizedGainAfterActivityFees: '-0.3',
      sellActivityId: 'sell-1',
      sellFeeAllocated: '0.2'
    }
  ],
  realizedGainAfterActivityFees: '-0.300000000000000000001',
  sellActivityId: 'sell-1',
  sellDate: '2026-01-01T00:30:00.000Z',
  sellFee: '0.2',
  sellQuantity: '0.5'
};

const averageSale: AverageCostGainSale = {
  allocatedAcquisitionFees: sale.allocatedAcquisitionFees,
  allocatedSellFee: sale.allocatedSellFee,
  currency: sale.currency,
  grossCostBasis: sale.grossCostBasis,
  grossProceeds: sale.grossProceeds,
  grossRealizedGain: sale.grossRealizedGain,
  matchedQuantity: sale.matchedQuantity,
  realizedGainAfterActivityFees: sale.realizedGainAfterActivityFees,
  sellActivityId: sale.sellActivityId,
  sellDate: sale.sellDate,
  sellFee: sale.sellFee,
  sellQuantity: sale.sellQuantity,
  poolAfter: {
    acquisitionFeePool: '0.25',
    grossCost: '40.5',
    quantity: '4'
  },
  poolBefore: {
    acquisitionFeePool: '0.35',
    grossCost: '50.5',
    quantity: '4.5'
  }
};

function response(body: unknown, status = 200): Response {
  return {
    json: jest.fn().mockResolvedValue(body),
    ok: status >= 200 && status < 300,
    status
  } as unknown as Response;
}

function requestFor(data: unknown) {
  const mock = jest
    .fn()
    .mockResolvedValue(response({ data, error: null, meta: {} }));
  return { mock, request: mock as unknown as AuthenticatedFetch };
}

describe('fetchRealizedGains', () => {
  it('requests FIFO through the authenticated host adapter and preserves precise values', async () => {
    const data: RealizedGainsData = { method: 'FIFO', sales: [sale] };
    const { mock, request } = requestFor(data);
    const abort = new AbortController();

    await expect(
      fetchRealizedGains(request, 'FIFO', abort.signal)
    ).resolves.toEqual(data);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith(
      '/api/v1/tax/realized-gains?method=FIFO',
      expect.objectContaining({ method: 'GET', signal: abort.signal })
    );
    expect(
      (await fetchRealizedGains(request, 'FIFO')).sales[0].grossRealizedGain
    ).toBe('-0.000000000000000000001');
  });

  it('requests average cost, keeping pool decimal strings unchanged', async () => {
    const data: RealizedGainsData = {
      method: 'AVERAGE_COST',
      sales: [averageSale]
    };
    const { mock, request } = requestFor(data);
    await expect(fetchRealizedGains(request, 'AVERAGE_COST')).resolves.toEqual(
      data
    );
    expect(mock).toHaveBeenCalledWith(
      '/api/v1/tax/realized-gains?method=AVERAGE_COST',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('accepts zero sales and an incomplete-history diagnostic without inventing totals', async () => {
    const data: RealizedGainsData = {
      diagnostics: [
        {
          affectedSellActivityIds: ['sell-1'],
          code: 'TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY',
          excludedActivityIds: ['excluded-1'],
          message: 'History may be incomplete.'
        }
      ],
      isComplete: false,
      method: 'FIFO',
      sales: []
    };
    const { request } = requestFor(data);
    await expect(fetchRealizedGains(request, 'FIFO')).resolves.toEqual(data);
  });

  it.each([
    { method: 'FIFO', sales: [{ ...sale, grossProceeds: 1.25 }] },
    { method: 'FIFO', sales: [{ ...sale, grossProceeds: '1e-7' }] },
    {
      method: 'FIFO',
      sales: [
        { ...sale, matches: [{ ...sale.matches[0], matchedQuantity: 0.5 }] }
      ]
    },
    { method: 'FIFO', sales: [{ ...sale, sellDate: '2026-01-01' }] },
    { method: 'FIFO', sales: [{ ...sale, currency: 5 }] },
    { method: 'FIFO', sales: [{ ...sale, allocatedBuyFees: undefined }] },
    { method: 'FIFO', sales: [{ ...sale, matches: null }] },
    { method: 'AVERAGE_COST', sales: [averageSale] },
    { method: 'FIFO', sales: [], isComplete: true },
    { method: 'FIFO', sales: [], diagnostics: [{ code: 'OTHER' }] },
    { method: 'FIFO', sales: null },
    { sales: [sale] }
  ])(
    'rejects invalid, imprecise or method-mismatched API response %#',
    async (data) => {
      const { request } = requestFor(data);
      await expect(fetchRealizedGains(request, 'FIFO')).rejects.toMatchObject({
        code: 'INVALID_RESPONSE'
      });
    }
  );

  it('rejects a non-contract method without sending a request', async () => {
    const { mock, request } = requestFor({ method: 'FIFO', sales: [] });
    await expect(fetchRealizedGains(request, 'fifo' as 'FIFO')).rejects.toThrow(
      'Unsupported realized-gains calculation method'
    );
    expect(mock).not.toHaveBeenCalled();
  });

  it.each([401, 403, 422, 500])(
    'preserves status and error code for HTTP %s without leaking server detail',
    async (status) => {
      const mock = jest.fn().mockResolvedValue(
        response(
          {
            data: null,
            error: {
              code: 'TAX_REALIZED_GAINS_FAILED',
              message: 'private server detail'
            },
            meta: {}
          },
          status
        )
      );
      const request = mock as unknown as AuthenticatedFetch;
      const error = await fetchRealizedGains(request, 'FIFO').catch(
        (failure: unknown) => failure
      );
      expect(error).toBeInstanceOf(ApiRequestError);
      expect(error).toMatchObject({
        status,
        code: 'TAX_REALIZED_GAINS_FAILED'
      });
      expect((error as Error).message).not.toContain('private server detail');
    }
  );
});
