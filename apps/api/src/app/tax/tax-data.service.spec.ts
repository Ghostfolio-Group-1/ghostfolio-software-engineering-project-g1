import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import { TAG_ID_DRAFT } from '@ghostfolio/common/config';

import { Test } from '@nestjs/testing';
import Ajv from 'ajv';

import { fifoActivitiesSchema } from './contracts/fifo-activity.schema';
import { TaxDataService } from './tax-data.service';

const row = (id: string, date: string, type: 'BUY' | 'SELL', quantity = 1) => ({
  accountId: 'account-1',
  currency: 'USD',
  date: new Date(date),
  id,
  quantity,
  symbolProfileId: 'symbol-1',
  type,
  userId: 'user-1'
});

describe('TaxDataService contract', () => {
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(fifoActivitiesSchema);

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
});
