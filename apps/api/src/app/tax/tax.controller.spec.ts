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
    await controller.getRealizedGains(context);

    expect(getFifoRealizedGainActivities).toHaveBeenCalledWith('user-1');
  });

  it('returns exact FIFO realized gains with multi-lot traceability', async () => {
    const response = await controller.getRealizedGains(context);

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

  it('returns an empty sales list when the user has no eligible activities', async () => {
    getFifoRealizedGainActivities.mockResolvedValue([]);

    await expect(controller.getRealizedGains(context)).resolves.toEqual({
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

    const exception = await controller.getRealizedGains(context).then(
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
