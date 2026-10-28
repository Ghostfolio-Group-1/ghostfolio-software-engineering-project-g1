import { AccountService } from '@ghostfolio/api/app/account/account.service';
import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import { DataGatheringService } from '@ghostfolio/api/services/queues/data-gathering/data-gathering.service';
import { TagService } from '@ghostfolio/api/services/tag/tag.service';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, Type as ActivityType } from '@prisma/client';

import { ActivitiesService } from './activities.service';

type CreateActivityData = Parameters<ActivitiesService['createActivity']>[0];
type UpdateActivityArgs = Parameters<ActivitiesService['updateActivity']>[0];
type UpdateActivityData = UpdateActivityArgs['data'];

describe('ActivitiesService withholdingTax persistence', () => {
  let activitiesService: ActivitiesService;
  let eventEmitter: { emit: jest.Mock };
  let prismaService: {
    order: {
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let tagService: { validateTagIds: jest.Mock };
  let dataGatheringService: {
    addJobToQueue: jest.Mock;
    gatherSymbols: jest.Mock;
  };

  beforeEach(() => {
    eventEmitter = {
      emit: jest.fn()
    };

    prismaService = {
      order: {
        create: jest.fn(),
        update: jest.fn()
      }
    };

    tagService = {
      validateTagIds: jest.fn().mockResolvedValue(undefined)
    };

    dataGatheringService = {
      addJobToQueue: jest.fn(),
      gatherSymbols: jest.fn()
    };

    activitiesService = new ActivitiesService(
      null,
      {} as AccountService,
      null,
      null,
      dataGatheringService as unknown as DataGatheringService,
      null,
      eventEmitter as unknown as EventEmitter2,
      null,
      null,
      prismaService as unknown as PrismaService,
      null,
      tagService as unknown as TagService
    );
  });

  describe('createActivity', () => {
    it.each([
      { label: 'null', withholdingTax: null },
      { label: 'zero', withholdingTax: 0 },
      { label: 'a positive amount', withholdingTax: 5.25 }
    ])('persists $label withholdingTax', async ({ withholdingTax }) => {
      prismaService.order.create.mockResolvedValue(
        persistedActivity(withholdingTax)
      );

      await activitiesService.createActivity(
        createDividendData({ withholdingTax })
      );

      expect(prismaService.order.create).toHaveBeenCalledTimes(1);
      expect(
        prismaService.order.create.mock.calls[0][0].data.withholdingTax
      ).toBe(withholdingTax);
    });

    it('accepts withholdingTax equal to the gross dividend', async () => {
      prismaService.order.create.mockResolvedValue(persistedActivity(20));

      await activitiesService.createActivity(
        createDividendData({
          quantity: 10,
          unitPrice: 2,
          withholdingTax: 20
        })
      );

      expect(prismaService.order.create).toHaveBeenCalledTimes(1);
    });

    it('rejects withholdingTax greater than the gross dividend', async () => {
      await expect(
        activitiesService.createActivity(
          createDividendData({
            quantity: 10,
            unitPrice: 2,
            withholdingTax: 20.01
          })
        )
      ).rejects.toThrow('Withholding tax cannot exceed the gross dividend.');

      expect(tagService.validateTagIds).not.toHaveBeenCalled();
      expect(prismaService.order.create).not.toHaveBeenCalled();
    });

    it('rejects negative withholdingTax', async () => {
      await expect(
        activitiesService.createActivity(
          createDividendData({ withholdingTax: -0.01 })
        )
      ).rejects.toThrow(
        'Withholding tax must be greater than or equal to zero.'
      );

      expect(prismaService.order.create).not.toHaveBeenCalled();
    });

    it('rejects withholdingTax on a non-dividend activity', async () => {
      await expect(
        activitiesService.createActivity(
          createDividendData({
            type: ActivityType.BUY,
            withholdingTax: 1
          })
        )
      ).rejects.toThrow(
        'Withholding tax is only valid for dividend activities.'
      );

      expect(prismaService.order.create).not.toHaveBeenCalled();
    });

    it('rejects positive withholdingTax on a zero-value dividend', async () => {
      await expect(
        activitiesService.createActivity(
          createDividendData({
            quantity: 0,
            unitPrice: 100,
            withholdingTax: 0.01
          })
        )
      ).rejects.toThrow('Withholding tax cannot exceed the gross dividend.');

      expect(prismaService.order.create).not.toHaveBeenCalled();
    });
  });

  describe('updateActivity', () => {
    it.each([
      { label: 'zero', withholdingTax: 0 },
      { label: 'a positive amount', withholdingTax: 7.5 }
    ])(
      'persists $label when explicitly supplied',
      async ({ withholdingTax }) => {
        prismaService.order.update.mockResolvedValue(
          persistedActivity(withholdingTax)
        );

        await activitiesService.updateActivity({
          data: createUpdateData({ withholdingTax }),
          originalDate: new Date('2026-10-01T00:00:00.000Z'),
          originalWithholdingTax: null,
          userId: 'user-id',
          where: { id: 'activity-id' }
        });

        expect(prismaService.order.update).toHaveBeenCalledTimes(1);
        expect(
          prismaService.order.update.mock.calls[0][0].data.withholdingTax
        ).toBe(withholdingTax);
      }
    );

    it('persists explicit null as unknown withholding', async () => {
      prismaService.order.update.mockResolvedValue(persistedActivity(null));

      await activitiesService.updateActivity({
        data: createUpdateData({ withholdingTax: null }),
        originalDate: new Date('2026-10-01T00:00:00.000Z'),
        originalWithholdingTax: 7.5,
        userId: 'user-id',
        where: { id: 'activity-id' }
      });

      expect(
        prismaService.order.update.mock.calls[0][0].data.withholdingTax
      ).toBe(null);
    });

    it('leaves withholdingTax out of the update when the field is omitted', async () => {
      prismaService.order.update.mockResolvedValue(persistedActivity(7.5));

      await activitiesService.updateActivity({
        data: createUpdateData(),
        originalDate: new Date('2026-10-01T00:00:00.000Z'),
        originalWithholdingTax: 7.5,
        userId: 'user-id',
        where: { id: 'activity-id' }
      });

      const persistedData = prismaService.order.update.mock.calls[0][0].data;

      expect(
        Object.prototype.hasOwnProperty.call(persistedData, 'withholdingTax')
      ).toBe(false);
    });

    it('validates omitted withholdingTax against the existing stored value', async () => {
      await expect(
        activitiesService.updateActivity({
          data: createUpdateData({
            quantity: 2,
            unitPrice: 2
          }),
          originalDate: new Date('2026-10-01T00:00:00.000Z'),
          originalWithholdingTax: 5,
          userId: 'user-id',
          where: { id: 'activity-id' }
        })
      ).rejects.toThrow('Withholding tax cannot exceed the gross dividend.');

      expect(prismaService.order.update).not.toHaveBeenCalled();
    });

    it('rejects changing a dividend with stored withholding into a non-dividend when withholding is omitted', async () => {
      await expect(
        activitiesService.updateActivity({
          data: createUpdateData({
            type: ActivityType.BUY
          }),
          originalDate: new Date('2026-10-01T00:00:00.000Z'),
          originalWithholdingTax: 5,
          userId: 'user-id',
          where: { id: 'activity-id' }
        })
      ).rejects.toThrow(
        'Withholding tax is only valid for dividend activities.'
      );

      expect(prismaService.order.update).not.toHaveBeenCalled();
    });

    it('allows changing a dividend to a non-dividend when withholding is explicitly cleared', async () => {
      prismaService.order.update.mockResolvedValue(persistedActivity(null));

      await activitiesService.updateActivity({
        data: createUpdateData({
          type: ActivityType.BUY,
          withholdingTax: null
        }),
        originalDate: new Date('2026-10-01T00:00:00.000Z'),
        originalWithholdingTax: 5,
        userId: 'user-id',
        where: { id: 'activity-id' }
      });

      expect(prismaService.order.update).toHaveBeenCalledTimes(1);
      expect(
        prismaService.order.update.mock.calls[0][0].data.withholdingTax
      ).toBe(null);
    });
  });
});

function createDividendData({
  quantity = 10,
  type = ActivityType.DIVIDEND,
  unitPrice = 2,
  withholdingTax
}: {
  quantity?: number;
  type?: ActivityType;
  unitPrice?: number;
  withholdingTax?: number | null;
} = {}): CreateActivityData {
  return {
    currency: 'USD',
    date: new Date('2026-10-07T00:00:00.000Z'),
    fee: 0,
    quantity,
    type,
    unitPrice,
    withholdingTax,
    userId: 'user-id',
    SymbolProfile: {
      connectOrCreate: {
        create: {
          currency: 'USD',
          dataSource: DataSource.MANUAL,
          symbol: 'DIVIDEND'
        },
        where: {
          dataSource_symbol: {
            dataSource: DataSource.MANUAL,
            symbol: 'DIVIDEND'
          }
        }
      }
    },
    user: {
      connect: {
        id: 'user-id'
      }
    }
  } as unknown as CreateActivityData;
}

function createUpdateData({
  quantity = 10,
  type = ActivityType.DIVIDEND,
  unitPrice = 2,
  withholdingTax
}: {
  quantity?: number;
  type?: ActivityType;
  unitPrice?: number;
  withholdingTax?: number | null;
} = {}): UpdateActivityData {
  const data = {
    date: new Date('2026-10-07T00:00:00.000Z'),
    fee: 0,
    quantity,
    type,
    unitPrice,
    SymbolProfile: {
      connect: {
        dataSource_symbol: {
          dataSource: DataSource.MANUAL,
          symbol: 'DIVIDEND'
        }
      },
      update: {
        name: 'DIVIDEND'
      }
    },
    user: {
      connect: {
        id: 'user-id'
      }
    }
  } as unknown as UpdateActivityData;

  if (withholdingTax !== undefined) {
    data.withholdingTax = withholdingTax;
  }

  return data;
}

function persistedActivity(withholdingTax: number | null) {
  return {
    currency: 'USD',
    date: new Date('2026-10-07T00:00:00.000Z'),
    fee: 0,
    id: 'activity-id',
    quantity: 10,
    symbolProfileId: 'symbol-profile-id',
    type: ActivityType.DIVIDEND,
    unitPrice: 2,
    withholdingTax,
    userId: 'user-id',
    SymbolProfile: {
      currency: 'USD',
      dataSource: DataSource.MANUAL,
      symbol: 'DIVIDEND'
    }
  };
}
