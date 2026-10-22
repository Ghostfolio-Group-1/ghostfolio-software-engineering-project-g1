import { REQUIRES_SCOPE_KEY } from '@ghostfolio/api/decorators/requires-scope.decorator';
import { ImpersonationService } from '@ghostfolio/api/services/impersonation/impersonation.service';
import { scopes } from '@ghostfolio/common/scopes';
import type { ImpersonationContext } from '@ghostfolio/common/types';

import { HttpException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Type as ActivityType } from '@prisma/client';

import { TaxDataService } from './tax-data.service';
import { TaxController } from './tax.controller';
import { TaxService } from './tax.service';

const activities = [
  {
    accountId: 'account-1',
    currency: 'USD',
    date: new Date('2026-03-01T00:00:00.000Z'),
    fee: 2,
    id: 'buy-1',
    quantity: 100,
    symbolProfileId: 'symbol-1',
    type: ActivityType.BUY,
    unitPrice: 10,
    userId: 'user-1'
  },
  {
    accountId: 'account-1',
    currency: 'USD',
    date: new Date('2026-03-02T00:00:00.000Z'),
    fee: 1,
    id: 'buy-2',
    quantity: 50,
    symbolProfileId: 'symbol-1',
    type: ActivityType.BUY,
    unitPrice: 12,
    userId: 'user-1'
  },
  {
    accountId: 'account-1',
    currency: 'USD',
    date: new Date('2026-03-03T00:00:00.000Z'),
    fee: 3,
    id: 'sell-1',
    quantity: 120,
    symbolProfileId: 'symbol-1',
    type: ActivityType.SELL,
    unitPrice: 15,
    userId: 'user-1'
  }
];

describe('TaxController integration: GET /tax/realized-gains', () => {
  const context = {
    userId: 'user-1'
  } as unknown as ImpersonationContext;

  let controller: TaxController;
  let getFifoRealizedGainActivities: jest.Mock;

  beforeEach(async () => {
    getFifoRealizedGainActivities = jest.fn().mockResolvedValue(activities);

    const moduleRef = await Test.createTestingModule({
      controllers: [TaxController],
      providers: [
        TaxService,
        {
          provide: ImpersonationService,
          useValue: {}
        },
        {
          provide: TaxDataService,
          useValue: { getFifoRealizedGainActivities }
        }
      ]
    }).compile();

    controller = moduleRef.get(TaxController);
  });

  it('is routed at /tax/realized-gains and requires portfolio-read scope', () => {
    expect(Reflect.getMetadata('path', TaxController)).toBe('tax');

    expect(
      Reflect.getMetadata('path', TaxController.prototype.getRealizedGains)
    ).toBe('realized-gains');

    expect(
      Reflect.getMetadata(
        REQUIRES_SCOPE_KEY,
        TaxController.prototype.getRealizedGains
      )
    ).toEqual([scopes.portfolioRead]);
  });

  it('loads activities for the authenticated user', async () => {
    await controller.getRealizedGains(context, {});

    expect(getFifoRealizedGainActivities).toHaveBeenCalledWith('user-1');
  });

  it('returns exact FIFO realized gains with multi-lot traceability', async () => {
    const response = await controller.getRealizedGains(context, {});

    expect(response).toEqual({
      data: {
        method: 'FIFO',
        sales: [
          {
            sellActivityId: 'sell-1',
            sellDate: '2026-03-03T00:00:00.000Z',
            currency: 'USD',
            sellQuantity: '120',
            matchedQuantity: '120',
            grossProceeds: '1800',
            grossCostBasis: '1240',
            grossRealizedGain: '560',
            allocatedAcquisitionFees: '2.4',
            allocatedBuyFees: '2.4',
            sellFee: '3',
            allocatedSellFee: '3',
            realizedGainAfterActivityFees: '554.6',
            matches: [
              {
                lotId: 'buy-1',
                buyActivityId: 'buy-1',
                sellActivityId: 'sell-1',
                matchedQuantity: '100',
                grossAcquisitionValue: '1000',
                grossProceeds: '1500',
                grossRealizedGain: '500',
                buyFeeAllocated: '2',
                sellFeeAllocated: '2.5',
                realizedGainAfterActivityFees: '495.5'
              },
              {
                lotId: 'buy-2',
                buyActivityId: 'buy-2',
                sellActivityId: 'sell-1',
                matchedQuantity: '20',
                grossAcquisitionValue: '240',
                grossProceeds: '300',
                grossRealizedGain: '60',
                buyFeeAllocated: '0.4',
                sellFeeAllocated: '0.5',
                realizedGainAfterActivityFees: '59.1'
              }
            ]
          }
        ]
      },
      error: null,
      meta: {}
    });
  });

  it('supports explicit FIFO method selection', async () => {
    const response = await controller.getRealizedGains(context, {
      method: 'FIFO'
    });

    expect(response.data?.method).toBe('FIFO');
  });

  it('returns average-cost realized gains when AVERAGE_COST is selected', async () => {
    const response = await controller.getRealizedGains(context, {
      method: 'AVERAGE_COST'
    });

    expect(response).toEqual({
      data: {
        method: 'AVERAGE_COST',
        sales: [
          {
            sellActivityId: 'sell-1',
            sellDate: '2026-03-03T00:00:00.000Z',
            currency: 'USD',
            sellQuantity: '120',
            matchedQuantity: '120',
            grossProceeds: '1800',
            grossCostBasis: '1280',
            grossRealizedGain: '520',
            allocatedAcquisitionFees: '2.4',
            sellFee: '3',
            allocatedSellFee: '3',
            realizedGainAfterActivityFees: '514.6',
            poolBefore: {
              quantity: '150',
              grossCost: '1600',
              acquisitionFeePool: '3'
            },
            poolAfter: {
              quantity: '30',
              grossCost: '320',
              acquisitionFeePool: '0.6'
            }
          }
        ]
      },
      error: null,
      meta: {}
    });
  });

  it('rejects an unsupported calculation method with a TAX error envelope', async () => {
    const exception = await controller
      .getRealizedGains(context, { method: 'INVALID' })
      .then(
        () => {
          throw new Error('Expected invalid method calculation to fail');
        },
        (error: HttpException) => error
      );

    expect(exception.getStatus()).toBe(422);
    expect(exception.getResponse()).toMatchObject({
      data: null,
      error: {
        code: 'TAX_REALIZED_GAINS_FAILED',
        message: 'Unsupported tax calculation method: INVALID'
      },
      meta: {}
    });
  });

  it('returns an empty sales list when the user has no eligible activities', async () => {
    getFifoRealizedGainActivities.mockResolvedValue([]);

    await expect(controller.getRealizedGains(context, {})).resolves.toEqual({
      data: {
        method: 'FIFO',
        sales: []
      },
      error: null,
      meta: {}
    });
  });

  it('returns a TAX error envelope when FIFO calculation fails', async () => {
    getFifoRealizedGainActivities.mockResolvedValue([
      ...activities.slice(0, 2),
      {
        ...activities[2],
        quantity: 160
      }
    ]);

    const exception = await controller.getRealizedGains(context, {}).then(
      () => {
        throw new Error('Expected FIFO calculation to fail');
      },
      (error: HttpException) => error
    );

    expect(exception.getStatus()).toBe(422);
    expect(exception.getResponse()).toMatchObject({
      data: null,
      error: {
        code: 'TAX_REALIZED_GAINS_FAILED',
        message: 'FIFO SELL sell-1 exceeds available holdings by 10.'
      },
      meta: {}
    });
  });
});

describe('TaxController integration: GET /tax/lots', () => {
  const context = {
    userId: 'user-1'
  } as unknown as ImpersonationContext;

  let controller: TaxController;
  let getFifoActivities: jest.Mock;

  beforeEach(async () => {
    getFifoActivities = jest.fn().mockResolvedValue(activities);

    const moduleRef = await Test.createTestingModule({
      controllers: [TaxController],
      providers: [
        TaxService,
        {
          provide: ImpersonationService,
          useValue: {}
        },
        {
          provide: TaxDataService,
          useValue: {
            getFifoActivities
          }
        }
      ]
    }).compile();

    controller = moduleRef.get(TaxController);
  });

  it('is routed at /tax/lots and requires portfolio-read scope', () => {
    expect(Reflect.getMetadata('path', TaxController)).toBe('tax');

    expect(
      Reflect.getMetadata('path', TaxController.prototype.getTaxLots)
    ).toBe('lots');

    expect(
      Reflect.getMetadata(
        REQUIRES_SCOPE_KEY,
        TaxController.prototype.getTaxLots
      )
    ).toEqual([scopes.portfolioRead]);
  });

  it('loads FIFO activities for the authenticated user', async () => {
    await controller.getTaxLots(context);

    expect(getFifoActivities).toHaveBeenCalledWith('user-1');
  });

  it('returns derived closed and partially consumed tax lots', async () => {
    const response = await controller.getTaxLots(context);

    expect(response).toEqual({
      data: {
        lots: [
          {
            lotId: 'buy-1',
            sourceActivityId: 'buy-1',
            accountId: 'account-1',
            symbolProfileId: 'symbol-1',
            acquiredAt: '2026-03-01T00:00:00.000Z',
            currency: 'USD',
            originalQuantity: '100',
            consumedQuantity: '100',
            remainingQuantity: '0',
            status: 'CLOSED',
            relatedSellActivityIds: ['sell-1']
          },
          {
            lotId: 'buy-2',
            sourceActivityId: 'buy-2',
            accountId: 'account-1',
            symbolProfileId: 'symbol-1',
            acquiredAt: '2026-03-02T00:00:00.000Z',
            currency: 'USD',
            originalQuantity: '50',
            consumedQuantity: '20',
            remainingQuantity: '30',
            status: 'PARTIALLY_CONSUMED',
            relatedSellActivityIds: ['sell-1']
          }
        ]
      },
      error: null,
      meta: {}
    });
  });

  it('serializes tiny quantities without exponential notation', async () => {
    getFifoActivities.mockResolvedValue([
      {
        ...activities[0],
        id: 'buy-tiny',
        quantity: 0.00000001
      }
    ]);

    const response = await controller.getTaxLots(context);

    expect(response).toEqual({
      data: {
        lots: [
          {
            lotId: 'buy-tiny',
            sourceActivityId: 'buy-tiny',
            accountId: 'account-1',
            symbolProfileId: 'symbol-1',
            acquiredAt: '2026-03-01T00:00:00.000Z',
            currency: 'USD',
            originalQuantity: '0.00000001',
            consumedQuantity: '0',
            remainingQuantity: '0.00000001',
            status: 'OPEN',
            relatedSellActivityIds: []
          }
        ]
      },
      error: null,
      meta: {}
    });
  });

  it('returns an empty lot list when the user has no eligible activities', async () => {
    getFifoActivities.mockResolvedValue([]);

    await expect(controller.getTaxLots(context)).resolves.toEqual({
      data: {
        lots: []
      },
      error: null,
      meta: {}
    });
  });

  it('returns TAX_LOTS_FAILED when the activity history cannot be reconciled', async () => {
    getFifoActivities.mockResolvedValue([
      ...activities.slice(0, 2),
      {
        ...activities[2],
        quantity: 160
      }
    ]);

    const exception = await controller.getTaxLots(context).then(
      () => {
        throw new Error('Expected tax-lot derivation to fail');
      },
      (error: HttpException) => error
    );

    expect(exception.getStatus()).toBe(422);
    expect(exception.getResponse()).toMatchObject({
      data: null,
      error: {
        code: 'TAX_LOTS_FAILED',
        message: 'FIFO SELL sell-1 exceeds available holdings by 10.'
      },
      meta: {}
    });
  });
});
