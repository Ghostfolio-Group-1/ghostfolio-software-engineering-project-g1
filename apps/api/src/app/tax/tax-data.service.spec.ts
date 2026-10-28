import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import { TAG_ID_DRAFT } from '@ghostfolio/common/config';

import { Test } from '@nestjs/testing';
import Ajv from 'ajv';

import { fifoActivitiesSchema } from './contracts/fifo-activity.schema';
import { fifoRealizedGainActivitiesSchema } from './contracts/fifo-realized-gain-activity.schema';
import { TaxDataService } from './tax-data.service';

const row = (id: string, date: string, type: 'BUY' | 'SELL', quantity = 1) => ({
  accountId: 'account-1',
  currency: 'USD',
  date: new Date(date),
  id,
  quantity,
  symbolProfileId: 'symbol-1',
  type,
  unitPrice: 50,
  userId: 'user-1'
});

const realizedGainRow = (
  id: string,
  date: string,
  type: 'BUY' | 'SELL',
  quantity = 1
) => ({
  ...row(id, date, type, quantity),
  fee: 1
});

describe('TaxDataService contract', () => {
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(fifoActivitiesSchema);
  const validateRealizedGainActivities = ajv.compile(
    fifoRealizedGainActivitiesSchema
  );

  let findMany: jest.Mock;
  let service: TaxDataService;

  beforeEach(async () => {
    findMany = jest
      .fn()
      .mockResolvedValue([
        row('c', '2026-03-02T00:00:00.000Z', 'SELL', 4),
        row('b', '2026-03-01T00:00:00.000Z', 'BUY', 10),
        row('a', '2026-03-01T00:00:00.000Z', 'BUY', 5)
      ]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        TaxDataService,
        { provide: PrismaService, useValue: { order: { findMany } } }
      ]
    }).compile();

    service = moduleRef.get(TaxDataService);
  });

  it('excludes draft-tagged activities and reads only the user BUY and SELL activities', async () => {
    await service.getFifoActivities('user-1');

    expect(findMany).toHaveBeenCalledWith({
      select: {
        accountId: true,
        currency: true,
        date: true,
        id: true,
        quantity: true,
        symbolProfileId: true,
        type: true,
        unitPrice: true,
        userId: true
      },
      where: {
        tags: { none: { id: TAG_ID_DRAFT } },
        type: { in: ['BUY', 'SELL'] },
        userId: 'user-1'
      }
    });
  });

  it('returns activities in FIFO order: date, then id for same-date ties', async () => {
    const activities = await service.getFifoActivities('user-1');

    expect(activities.map(({ id }) => id)).toEqual(['a', 'b', 'c']);
    expect(activities.map(({ quantity }) => quantity)).toEqual([5, 10, 4]);
  });

  it('matches the contract schema', async () => {
    const activities = await service.getFifoActivities('user-1');

    validate(JSON.parse(JSON.stringify(activities)));

    expect(validate.errors ?? []).toEqual([]);
  });

  it('returns an empty list when the user has no activities', async () => {
    findMany.mockResolvedValue([]);

    await expect(service.getFifoActivities('user-1')).resolves.toEqual([]);
  });

  it('fails validation for a dividend or an extra field', () => {
    const dividend = { ...row('d', '2026-03-03T00:00:00.000Z', 'BUY') };

    expect(
      validate(JSON.parse(JSON.stringify([{ ...dividend, type: 'DIVIDEND' }])))
    ).toBe(false);

    expect(
      validate(JSON.parse(JSON.stringify([{ ...dividend, fee: 1 }])))
    ).toBe(false);
  });

  it('loads the realized-gain fields with the shared FIFO filter', async () => {
    findMany.mockResolvedValue([
      realizedGainRow('c', '2026-03-02T00:00:00.000Z', 'SELL', 4),
      realizedGainRow('b', '2026-03-01T00:00:00.000Z', 'BUY', 10),
      realizedGainRow('a', '2026-03-01T00:00:00.000Z', 'BUY', 5)
    ]);

    await service.getFifoRealizedGainActivities('user-1');

    expect(findMany).toHaveBeenCalledWith({
      select: {
        accountId: true,
        currency: true,
        date: true,
        fee: true,
        id: true,
        quantity: true,
        symbolProfileId: true,
        type: true,
        unitPrice: true,
        userId: true
      },
      where: {
        tags: { none: { id: TAG_ID_DRAFT } },
        type: { in: ['BUY', 'SELL'] },
        userId: 'user-1'
      }
    });
  });

  it('returns realized-gain activities in FIFO order', async () => {
    findMany.mockResolvedValue([
      realizedGainRow('c', '2026-03-02T00:00:00.000Z', 'SELL', 4),
      realizedGainRow('b', '2026-03-01T00:00:00.000Z', 'BUY', 10),
      realizedGainRow('a', '2026-03-01T00:00:00.000Z', 'BUY', 5)
    ]);

    const activities = await service.getFifoRealizedGainActivities('user-1');

    expect(activities.map(({ id }) => id)).toEqual(['a', 'b', 'c']);
    expect(activities.map(({ fee }) => fee)).toEqual([1, 1, 1]);
  });

  it('matches the realized-gain activity contract', async () => {
    findMany.mockResolvedValue([
      realizedGainRow('a', '2026-03-01T00:00:00.000Z', 'BUY', 5),
      realizedGainRow('b', '2026-03-02T00:00:00.000Z', 'SELL', 4)
    ]);

    const activities = await service.getFifoRealizedGainActivities('user-1');

    validateRealizedGainActivities(JSON.parse(JSON.stringify(activities)));

    expect(validateRealizedGainActivities.errors ?? []).toEqual([]);
  });

  it('rejects a negative fee from the realized-gain activity contract', () => {
    const invalidActivity = {
      ...realizedGainRow('a', '2026-03-01T00:00:00.000Z', 'BUY'),
      fee: -1
    };

    expect(
      validateRealizedGainActivities(
        JSON.parse(JSON.stringify([invalidActivity]))
      )
    ).toBe(false);
  });

  it('returns an empty realized-gain activity list when the user has no activities', async () => {
    findMany.mockResolvedValue([]);

    await expect(
      service.getFifoRealizedGainActivities('user-1')
    ).resolves.toEqual([]);
  });
});
