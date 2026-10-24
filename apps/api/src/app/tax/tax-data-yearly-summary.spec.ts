import { WHERE_ACCOUNT_NOT_EXCLUDED } from '@ghostfolio/api/helper/account.helper';
import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import {
  DEFAULT_CURRENCY,
  TAG_ID_DRAFT,
  TAG_ID_EXCLUDE_FROM_ANALYSIS
} from '@ghostfolio/common/config';

import { Type as ActivityType } from '@prisma/client';

import { TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY } from './interfaces/tax-diagnostic.interface';
import { TaxDataService } from './tax-data.service';

describe('TaxDataService yearly tax summary support', () => {
  let findMany: jest.Mock;
  let findSettings: jest.Mock;
  let service: TaxDataService;

  beforeEach(() => {
    findMany = jest.fn().mockResolvedValue([]);
    findSettings = jest.fn().mockResolvedValue(null);

    service = new TaxDataService({
      order: {
        findMany
      },
      settings: {
        findUnique: findSettings
      }
    } as unknown as PrismaService);
  });

  it('loads complete investment history only through the selected year end', async () => {
    const endDateExclusive = new Date('2027-01-01T00:00:00.000Z');

    await service.getFifoRealizedGainActivities('user-1', endDateExclusive);

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
        date: {
          lt: endDateExclusive
        },
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

  it('loads only tax-relevant dividends inside the requested UTC year', async () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDateExclusive = new Date('2027-01-01T00:00:00.000Z');

    await service.getDividendActivities('user-1', {
      endDateExclusive,
      startDate
    });

    expect(findMany).toHaveBeenCalledWith({
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
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
        withholdingTax: true
      },
      where: {
        date: {
          gte: startDate,
          lt: endDateExclusive
        },
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
      }
    });
  });

  it('reads the user base currency from existing settings', async () => {
    findSettings.mockResolvedValue({
      settings: {
        baseCurrency: 'EUR'
      }
    });

    await expect(service.getBaseCurrency('user-1')).resolves.toBe('EUR');

    expect(findSettings).toHaveBeenCalledWith({
      select: {
        settings: true
      },
      where: {
        userId: 'user-1'
      }
    });
  });

  it('falls back to the Ghostfolio default currency when the user has no base currency setting', async () => {
    findSettings.mockResolvedValue({
      settings: {}
    });

    await expect(service.getBaseCurrency('user-1')).resolves.toBe(
      DEFAULT_CURRENCY
    );
  });

  it('falls back to the Ghostfolio default currency when no settings row exists', async () => {
    findSettings.mockResolvedValue(null);

    await expect(service.getBaseCurrency('user-1')).resolves.toBe(
      DEFAULT_CURRENCY
    );

    expect(findSettings).toHaveBeenCalledWith({
      select: {
        settings: true
      },
      where: {
        userId: 'user-1'
      }
    });
  });

  it('limits mixed-history diagnostics to SELLs in the requested summary year', async () => {
    findMany.mockResolvedValue([
      {
        accountId: 'account-1',
        date: new Date('2024-01-01T00:00:00.000Z'),
        id: 'excluded-buy',
        isTaxRelevant: false,
        symbolProfileId: 'symbol-1',
        type: ActivityType.BUY,
        userId: 'user-1'
      },
      {
        accountId: 'account-1',
        date: new Date('2025-06-01T00:00:00.000Z'),
        id: 'sell-2025',
        isTaxRelevant: true,
        symbolProfileId: 'symbol-1',
        type: ActivityType.SELL,
        userId: 'user-1'
      },
      {
        accountId: 'account-1',
        date: new Date('2026-06-01T00:00:00.000Z'),
        id: 'sell-2026',
        isTaxRelevant: true,
        symbolProfileId: 'symbol-1',
        type: ActivityType.SELL,
        userId: 'user-1'
      },
      {
        accountId: 'account-1',
        date: new Date('2027-06-01T00:00:00.000Z'),
        id: 'sell-2027',
        isTaxRelevant: true,
        symbolProfileId: 'symbol-1',
        type: ActivityType.SELL,
        userId: 'user-1'
      }
    ]);

    const diagnostic = await service.getMixedHistoryDiagnostic(
      'user-1',
      'FIFO',
      {
        endDateExclusive: new Date('2027-01-01T00:00:00.000Z'),
        sellDateFrom: new Date('2026-01-01T00:00:00.000Z')
      }
    );

    expect(diagnostic).toEqual({
      code: TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY,
      message:
        'Excluded BUY or SELL activity exists in the same tax scope before or at a tax-relevant SELL; basis-dependent tax results may be incomplete.',
      affectedSellActivityIds: ['sell-2026'],
      excludedActivityIds: ['excluded-buy']
    });
  });
});
