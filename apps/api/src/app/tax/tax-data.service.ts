import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import { TAG_ID_DRAFT } from '@ghostfolio/common/config';

import { Injectable } from '@nestjs/common';
import { Prisma, Type as ActivityType } from '@prisma/client';

import { FifoRealizedGainActivitySource } from './fifo-realized-gain';
import { FifoTaxActivitySource, orderFifoActivities } from './fifo-tax-lot';

// Data-access layer for the tax engine: loads the user's non-draft BUY and
// SELL activities and returns them in deterministic FIFO order (DR-3).
// Drafts are tag-based in this codebase (see isDraftActivity in helper.ts).
@Injectable()
export class TaxDataService {
  public constructor(private readonly prismaService: PrismaService) {}

  public async getFifoActivities(
    userId: string
  ): Promise<FifoTaxActivitySource[]> {
    const activities = await this.prismaService.order.findMany({
      where: this.getFifoActivityWhere(userId),
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
    userId: string
  ): Promise<FifoRealizedGainActivitySource[]> {
    const activities = await this.prismaService.order.findMany({
      where: this.getFifoActivityWhere(userId),
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

  private getFifoActivityWhere(userId: string): Prisma.OrderWhereInput {
    return {
      tags: { none: { id: TAG_ID_DRAFT } },
      type: { in: [ActivityType.BUY, ActivityType.SELL] },
      userId
    };
  }
}
