import { WHERE_ACCOUNT_NOT_EXCLUDED } from '@ghostfolio/api/helper/account.helper';
import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import {
  DEFAULT_CURRENCY,
  TAG_ID_DRAFT,
  TAG_ID_EXCLUDE_FROM_ANALYSIS
} from '@ghostfolio/common/config';
import type { UserSettings } from '@ghostfolio/common/interfaces';

import { Injectable } from '@nestjs/common';
import type { Order } from '@prisma/client';
import { Prisma, Type as ActivityType } from '@prisma/client';

import type { DividendRecordSource } from './dividend-record';
import { FifoRealizedGainActivitySource } from './fifo-realized-gain';
import { FifoTaxActivitySource, orderFifoActivities } from './fifo-tax-lot';
import {
  TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY,
  type TaxScopeDiagnostic
} from './interfaces/tax-diagnostic.interface';
import type { TaxCalculationMethod } from './tax-calculator';

type TaxHistoryActivity = Pick<
  Order,
  | 'accountId'
  | 'date'
  | 'id'
  | 'isTaxRelevant'
  | 'symbolProfileId'
  | 'type'
  | 'userId'
>;

interface MixedHistoryWindow {
  endDateExclusive?: Date;
  sellDateFrom?: Date;
}

// Data-access layer for the tax engine.
//
// Tax activity eligibility is intentionally stricter than normal portfolio
// eligibility: an activity must satisfy Ghostfolio's existing analysis
// exclusions and also be explicitly tax relevant.
//
// FIFO/average-cost calculations consume BUY and SELL activities.
// DIVIDEND activities use the same shared tax filter for yearly tax analytics.
@Injectable()
export class TaxDataService {
  public constructor(private readonly prismaService: PrismaService) {}

  public async getFifoActivities(
    userId: string
  ): Promise<FifoTaxActivitySource[]> {
    const activities = await this.prismaService.order.findMany({
      where: this.getTaxActivityWhere(userId, [
        ActivityType.BUY,
        ActivityType.SELL
      ]),
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
      }
    });

    return orderFifoActivities(activities);
  }

  public async getFifoRealizedGainActivities(
    userId: string,
    endDateExclusive?: Date
  ): Promise<FifoRealizedGainActivitySource[]> {
    const where = this.getTaxActivityWhere(userId, [
      ActivityType.BUY,
      ActivityType.SELL
    ]);

    if (endDateExclusive) {
      where.date = {
        lt: endDateExclusive
      };
    }

    const activities = await this.prismaService.order.findMany({
      where,
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
      }
    });

    return orderFifoActivities(activities);
  }

  public async getDividendActivities(
    userId: string,
    {
      endDateExclusive,
      startDate
    }: {
      endDateExclusive: Date;
      startDate: Date;
    }
  ): Promise<DividendRecordSource[]> {
    return this.prismaService.order.findMany({
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
      where: {
        ...this.getTaxActivityWhere(userId, [ActivityType.DIVIDEND]),
        date: {
          gte: startDate,
          lt: endDateExclusive
        }
      },
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
      }
    });
  }

  public async getBaseCurrency(userId: string): Promise<string> {
    const settings = await this.prismaService.settings.findUnique({
      select: {
        settings: true
      },
      where: {
        userId
      }
    });

    const userSettings = (settings?.settings ?? {}) as UserSettings;

    if (
      typeof userSettings.baseCurrency === 'string' &&
      userSettings.baseCurrency.length > 0
    ) {
      return userSettings.baseCurrency;
    }

    return DEFAULT_CURRENCY;
  }

  public async getMixedHistoryDiagnostic(
    userId: string,
    method: TaxCalculationMethod,
    { endDateExclusive, sellDateFrom }: MixedHistoryWindow = {}
  ): Promise<TaxScopeDiagnostic | null> {
    const where = this.getNormalTaxActivityWhere(userId, [
      ActivityType.BUY,
      ActivityType.SELL
    ]);

    if (endDateExclusive) {
      where.date = {
        lt: endDateExclusive
      };
    }

    const activities = await this.prismaService.order.findMany({
      where,
      select: {
        accountId: true,
        date: true,
        id: true,
        isTaxRelevant: true,
        symbolProfileId: true,
        type: true,
        userId: true
      }
    });

    const orderedActivities = [...activities].sort((left, right) =>
      this.compareTaxHistoryActivities(left, right)
    );

    const taxRelevantSells = orderedActivities.filter(
      ({ date, isTaxRelevant, type }) => {
        if (!isTaxRelevant || type !== ActivityType.SELL) {
          return false;
        }

        if (sellDateFrom && date.getTime() < sellDateFrom.getTime()) {
          return false;
        }

        if (endDateExclusive && date.getTime() >= endDateExclusive.getTime()) {
          return false;
        }

        return true;
      }
    );

    const excludedInvestmentActivities = orderedActivities.filter(
      ({ isTaxRelevant }) => {
        return isTaxRelevant === false;
      }
    );

    const affectedSellActivityIds = new Set<string>();
    const excludedActivityIds = new Set<string>();

    for (const sell of taxRelevantSells) {
      for (const excludedActivity of excludedInvestmentActivities) {
        if (excludedActivity.date.getTime() > sell.date.getTime()) {
          continue;
        }

        if (
          !this.isSameTaxCalculationScope({
            activity: excludedActivity,
            method,
            sell
          })
        ) {
          continue;
        }

        affectedSellActivityIds.add(sell.id);
        excludedActivityIds.add(excludedActivity.id);
      }
    }

    if (affectedSellActivityIds.size === 0) {
      return null;
    }

    return {
      code: TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY,
      message:
        'Excluded BUY or SELL activity exists in the same tax scope before or at a tax-relevant SELL; basis-dependent tax results may be incomplete.',
      affectedSellActivityIds: [...affectedSellActivityIds],
      excludedActivityIds: [...excludedActivityIds]
    };
  }

  public getTaxActivityWhere(
    userId: string,
    types: ActivityType[]
  ): Prisma.OrderWhereInput {
    return {
      ...this.getNormalTaxActivityWhere(userId, types),
      isTaxRelevant: true
    };
  }

  private getNormalTaxActivityWhere(
    userId: string,
    types: ActivityType[]
  ): Prisma.OrderWhereInput {
    return {
      OR: [{ account: null }, { account: WHERE_ACCOUNT_NOT_EXCLUDED }],
      tags: {
        none: {
          id: {
            in: [TAG_ID_DRAFT, TAG_ID_EXCLUDE_FROM_ANALYSIS]
          }
        }
      },
      type: {
        in: types
      },
      userId
    };
  }

  private compareTaxHistoryActivities(
    left: TaxHistoryActivity,
    right: TaxHistoryActivity
  ): number {
    const dateDifference = left.date.getTime() - right.date.getTime();

    if (dateDifference !== 0) {
      return dateDifference;
    }

    return left.id.localeCompare(right.id);
  }

  private isSameTaxCalculationScope({
    activity,
    method,
    sell
  }: {
    activity: TaxHistoryActivity;
    method: TaxCalculationMethod;
    sell: TaxHistoryActivity;
  }): boolean {
    if (
      activity.userId !== sell.userId ||
      activity.symbolProfileId !== sell.symbolProfileId
    ) {
      return false;
    }

    if (method === 'AVERAGE_COST') {
      return true;
    }

    return activity.accountId === sell.accountId;
  }
}
