import { WHERE_ACCOUNT_NOT_EXCLUDED } from '@ghostfolio/api/helper/account.helper';
import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import {
  TAG_ID_DRAFT,
  TAG_ID_EXCLUDE_FROM_ANALYSIS
} from '@ghostfolio/common/config';

import { Test } from '@nestjs/testing';
import { Type as ActivityType } from '@prisma/client';
import Ajv from 'ajv';

import { fifoActivitiesSchema } from './contracts/fifo-activity.schema';
import { fifoRealizedGainActivitiesSchema } from './contracts/fifo-realized-gain-activity.schema';
import {
  TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY,
  TaxScopeDiagnostic
} from './interfaces/tax-diagnostic.interface';
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

const historyRow = ({
  accountId = 'account-1',
  date,
  id,
  isTaxRelevant,
  symbolProfileId = 'symbol-1',
  type,
  userId = 'user-1'
}: {
  accountId?: string | null;
  date: string;
  id: string;
  isTaxRelevant: boolean;
  symbolProfileId?: string;
  type: 'BUY' | 'SELL';
  userId?: string;
}) => ({
  accountId,
  date: new Date(date),
  id,
  isTaxRelevant,
  symbolProfileId,
  type,
  userId
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
        {
          provide: PrismaService,
          useValue: {
            order: {
              findMany
            }
          }
        }
      ]
    }).compile();

    service = moduleRef.get(TaxDataService);
  });

  it('reads only tax-relevant, analysis-eligible user BUY and SELL activities', async () => {
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
        isTaxRelevant: true,
        OR: [
          {
            account: null
          },
          {
            account: WHERE_ACCOUNT_NOT_EXCLUDED
          }
        ],
        tags: {
          none: {
            id: {
              in: [TAG_ID_DRAFT, TAG_ID_EXCLUDE_FROM_ANALYSIS]
            }
          }
        },
        type: {
          in: [ActivityType.BUY, ActivityType.SELL]
        },
        userId: 'user-1'
      }
    });
  });

  it('builds the shared tax filter for dividend activities', () => {
    expect(
      service.getTaxActivityWhere('user-1', [ActivityType.DIVIDEND])
    ).toEqual({
      isTaxRelevant: true,
      OR: [
        {
          account: null
        },
        {
          account: WHERE_ACCOUNT_NOT_EXCLUDED
        }
      ],
      tags: {
        none: {
          id: {
            in: [TAG_ID_DRAFT, TAG_ID_EXCLUDE_FROM_ANALYSIS]
          }
        }
      },
      type: {
        in: [ActivityType.DIVIDEND]
      },
      userId: 'user-1'
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
    const dividend = {
      ...row('d', '2026-03-03T00:00:00.000Z', 'BUY')
    };

    expect(
      validate(
        JSON.parse(
          JSON.stringify([
            {
              ...dividend,
              type: 'DIVIDEND'
            }
          ])
        )
      )
    ).toBe(false);

    expect(
      validate(
        JSON.parse(
          JSON.stringify([
            {
              ...dividend,
              fee: 1
            }
          ])
        )
      )
    ).toBe(false);
  });

  it('loads the realized-gain fields with the shared tax filter', async () => {
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
        isTaxRelevant: true,
        OR: [
          {
            account: null
          },
          {
            account: WHERE_ACCOUNT_NOT_EXCLUDED
          }
        ],
        tags: {
          none: {
            id: {
              in: [TAG_ID_DRAFT, TAG_ID_EXCLUDE_FROM_ANALYSIS]
            }
          }
        },
        type: {
          in: [ActivityType.BUY, ActivityType.SELL]
        },
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

  describe('mixed tax-relevance history diagnostics', () => {
    it('queries otherwise eligible BUY and SELL history without filtering out isTaxRelevant false rows', async () => {
      findMany.mockResolvedValue([]);

      await service.getMixedHistoryDiagnostic('user-1', 'FIFO');

      expect(findMany).toHaveBeenCalledWith({
        select: {
          accountId: true,
          date: true,
          id: true,
          isTaxRelevant: true,
          symbolProfileId: true,
          type: true,
          userId: true
        },
        where: {
          OR: [
            {
              account: null
            },
            {
              account: WHERE_ACCOUNT_NOT_EXCLUDED
            }
          ],
          tags: {
            none: {
              id: {
                in: [TAG_ID_DRAFT, TAG_ID_EXCLUDE_FROM_ANALYSIS]
              }
            }
          },
          type: {
            in: [ActivityType.BUY, ActivityType.SELL]
          },
          userId: 'user-1'
        }
      });
    });

    it('returns null when there is no excluded investment history', async () => {
      findMany.mockResolvedValue([
        historyRow({
          date: '2024-01-01T00:00:00.000Z',
          id: 'included-buy',
          isTaxRelevant: true,
          type: 'BUY'
        }),
        historyRow({
          date: '2026-01-01T00:00:00.000Z',
          id: 'included-sell',
          isTaxRelevant: true,
          type: 'SELL'
        })
      ]);

      await expect(
        service.getMixedHistoryDiagnostic('user-1', 'FIFO')
      ).resolves.toBeNull();
    });

    it('reports an excluded BUY in the same FIFO scope before a tax-relevant SELL', async () => {
      findMany.mockResolvedValue([
        historyRow({
          date: '2024-01-01T00:00:00.000Z',
          id: 'excluded-buy',
          isTaxRelevant: false,
          type: 'BUY'
        }),
        historyRow({
          date: '2026-01-01T00:00:00.000Z',
          id: 'included-sell',
          isTaxRelevant: true,
          type: 'SELL'
        })
      ]);

      await expect(
        service.getMixedHistoryDiagnostic('user-1', 'FIFO')
      ).resolves.toEqual({
        code: TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY,
        message:
          'Excluded BUY or SELL activity exists in the same tax scope before or at a tax-relevant SELL; basis-dependent tax results may be incomplete.',
        affectedSellActivityIds: ['included-sell'],
        excludedActivityIds: ['excluded-buy']
      } satisfies TaxScopeDiagnostic);
    });

    it('reports an excluded historical SELL in the same FIFO scope', async () => {
      findMany.mockResolvedValue([
        historyRow({
          date: '2024-01-01T00:00:00.000Z',
          id: 'included-buy',
          isTaxRelevant: true,
          type: 'BUY'
        }),
        historyRow({
          date: '2025-01-01T00:00:00.000Z',
          id: 'excluded-sell',
          isTaxRelevant: false,
          type: 'SELL'
        }),
        historyRow({
          date: '2026-01-01T00:00:00.000Z',
          id: 'included-sell',
          isTaxRelevant: true,
          type: 'SELL'
        })
      ]);

      const diagnostic = await service.getMixedHistoryDiagnostic(
        'user-1',
        'FIFO'
      );

      expect(diagnostic).toMatchObject({
        code: TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY,
        affectedSellActivityIds: ['included-sell'],
        excludedActivityIds: ['excluded-sell']
      });
    });

    it('does not report FIFO history excluded from another account', async () => {
      findMany.mockResolvedValue([
        historyRow({
          accountId: 'account-2',
          date: '2024-01-01T00:00:00.000Z',
          id: 'excluded-buy-other-account',
          isTaxRelevant: false,
          type: 'BUY'
        }),
        historyRow({
          accountId: 'account-1',
          date: '2026-01-01T00:00:00.000Z',
          id: 'included-sell',
          isTaxRelevant: true,
          type: 'SELL'
        })
      ]);

      await expect(
        service.getMixedHistoryDiagnostic('user-1', 'FIFO')
      ).resolves.toBeNull();
    });

    it('reports excluded history across accounts for average cost when the asset is the same', async () => {
      findMany.mockResolvedValue([
        historyRow({
          accountId: 'account-2',
          date: '2024-01-01T00:00:00.000Z',
          id: 'excluded-buy-other-account',
          isTaxRelevant: false,
          type: 'BUY'
        }),
        historyRow({
          accountId: 'account-1',
          date: '2026-01-01T00:00:00.000Z',
          id: 'included-sell',
          isTaxRelevant: true,
          type: 'SELL'
        })
      ]);

      const diagnostic = await service.getMixedHistoryDiagnostic(
        'user-1',
        'AVERAGE_COST'
      );

      expect(diagnostic).toMatchObject({
        code: TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY,
        affectedSellActivityIds: ['included-sell'],
        excludedActivityIds: ['excluded-buy-other-account']
      });
    });

    it('does not report history from another asset', async () => {
      findMany.mockResolvedValue([
        historyRow({
          date: '2024-01-01T00:00:00.000Z',
          id: 'excluded-other-asset-buy',
          isTaxRelevant: false,
          symbolProfileId: 'symbol-2',
          type: 'BUY'
        }),
        historyRow({
          date: '2026-01-01T00:00:00.000Z',
          id: 'included-sell',
          isTaxRelevant: true,
          symbolProfileId: 'symbol-1',
          type: 'SELL'
        })
      ]);

      await expect(
        service.getMixedHistoryDiagnostic('user-1', 'FIFO')
      ).resolves.toBeNull();
    });

    it('does not report an excluded investment activity that occurs after the tax-relevant SELL', async () => {
      findMany.mockResolvedValue([
        historyRow({
          date: '2026-01-01T00:00:00.000Z',
          id: 'included-sell',
          isTaxRelevant: true,
          type: 'SELL'
        }),
        historyRow({
          date: '2026-01-02T00:00:00.000Z',
          id: 'excluded-buy-after-sell',
          isTaxRelevant: false,
          type: 'BUY'
        })
      ]);

      await expect(
        service.getMixedHistoryDiagnostic('user-1', 'FIFO')
      ).resolves.toBeNull();
    });

    it('reports excluded investment history at the same timestamp as the tax-relevant SELL', async () => {
      findMany.mockResolvedValue([
        historyRow({
          date: '2026-01-01T00:00:00.000Z',
          id: 'excluded-sell',
          isTaxRelevant: false,
          type: 'SELL'
        }),
        historyRow({
          date: '2026-01-01T00:00:00.000Z',
          id: 'included-sell',
          isTaxRelevant: true,
          type: 'SELL'
        })
      ]);

      const diagnostic = await service.getMixedHistoryDiagnostic(
        'user-1',
        'FIFO'
      );

      expect(diagnostic).toMatchObject({
        code: TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY,
        affectedSellActivityIds: ['included-sell'],
        excludedActivityIds: ['excluded-sell']
      });
    });

    it('reports all affected SELL ids and excluded source ids deterministically', async () => {
      findMany.mockResolvedValue([
        historyRow({
          date: '2024-01-01T00:00:00.000Z',
          id: 'excluded-buy-1',
          isTaxRelevant: false,
          type: 'BUY'
        }),
        historyRow({
          date: '2025-01-01T00:00:00.000Z',
          id: 'included-sell-1',
          isTaxRelevant: true,
          type: 'SELL'
        }),
        historyRow({
          date: '2025-06-01T00:00:00.000Z',
          id: 'excluded-sell-2',
          isTaxRelevant: false,
          type: 'SELL'
        }),
        historyRow({
          date: '2026-01-01T00:00:00.000Z',
          id: 'included-sell-2',
          isTaxRelevant: true,
          type: 'SELL'
        })
      ]);

      await expect(
        service.getMixedHistoryDiagnostic('user-1', 'FIFO')
      ).resolves.toMatchObject({
        code: TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY,
        affectedSellActivityIds: ['included-sell-1', 'included-sell-2'],
        excludedActivityIds: ['excluded-buy-1', 'excluded-sell-2']
      });
    });
  });
});
