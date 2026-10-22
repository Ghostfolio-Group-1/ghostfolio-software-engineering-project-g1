import { AccountService } from '@ghostfolio/api/app/account/account.service';
import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import { DataGatheringService } from '@ghostfolio/api/services/queues/data-gathering/data-gathering.service';
import { TagService } from '@ghostfolio/api/services/tag/tag.service';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, Type as ActivityType } from '@prisma/client';

import { ActivitiesService } from './activities.service';

type UpdateActivityArgs = Parameters<ActivitiesService['updateActivity']>[0];
type UpdateActivityData = UpdateActivityArgs['data'];

describe('ActivitiesService isTaxRelevant persistence', () => {
  let activitiesService: ActivitiesService;

  let eventEmitter: {
    emit: jest.Mock;
  };

  let prismaService: {
    order: {
      update: jest.Mock;
    };
  };

  let tagService: {
    validateTagIds: jest.Mock;
  };

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
        update: jest.fn().mockResolvedValue({
          id: 'activity-id',
          isTaxRelevant: false,
          userId: 'user-id'
        })
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

  it.each([true, false])(
    'persists isTaxRelevant=%s when explicitly supplied',
    async (isTaxRelevant) => {
      await activitiesService.updateActivity({
        data: createUpdateData({ isTaxRelevant }),
        originalDate: new Date('2026-10-01T00:00:00.000Z'),
        originalWithholdingTax: null,
        userId: 'user-id',
        where: {
          id: 'activity-id'
        }
      });

      expect(prismaService.order.update).toHaveBeenCalledTimes(1);

      expect(
        prismaService.order.update.mock.calls[0][0].data.isTaxRelevant
      ).toBe(isTaxRelevant);
    }
  );

  it('leaves isTaxRelevant out of the update when the field is omitted', async () => {
    await activitiesService.updateActivity({
      data: createUpdateData(),
      originalDate: new Date('2026-10-01T00:00:00.000Z'),
      originalWithholdingTax: null,
      userId: 'user-id',
      where: {
        id: 'activity-id'
      }
    });

    const persistedData = prismaService.order.update.mock.calls[0][0].data;

    expect(
      Object.prototype.hasOwnProperty.call(persistedData, 'isTaxRelevant')
    ).toBe(false);
  });

  it('therefore does not reset an existing false value when the field is omitted', async () => {
    prismaService.order.update.mockResolvedValue({
      id: 'activity-id',
      isTaxRelevant: false,
      userId: 'user-id'
    });

    const activity = await activitiesService.updateActivity({
      data: createUpdateData(),
      originalDate: new Date('2026-10-01T00:00:00.000Z'),
      originalWithholdingTax: null,
      userId: 'user-id',
      where: {
        id: 'activity-id'
      }
    });

    const persistedData = prismaService.order.update.mock.calls[0][0].data;

    expect(
      Object.prototype.hasOwnProperty.call(persistedData, 'isTaxRelevant')
    ).toBe(false);

    expect(activity.isTaxRelevant).toBe(false);
  });
});

function createUpdateData({
  isTaxRelevant
}: {
  isTaxRelevant?: boolean;
} = {}): UpdateActivityData {
  const data = {
    date: new Date('2026-10-07T00:00:00.000Z'),
    fee: 0,
    quantity: 10,
    type: ActivityType.DIVIDEND,
    unitPrice: 2,
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

  if (isTaxRelevant !== undefined) {
    data.isTaxRelevant = isTaxRelevant;
  }

  return data;
}
