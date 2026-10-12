import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';

import { Injectable } from '@nestjs/common';
import { Type as ActivityType } from '@prisma/client';

import { FifoTaxActivitySource, orderFifoActivities } from './fifo-tax-lot';

// Data-access layer for the tax engine: loads the user's confirmed BUY and
// SELL activities and returns them in deterministic FIFO order (DR-3).
@Injectable()
export class TaxDataService {
  public constructor(private readonly prismaService: PrismaService) {}

  public async getFifoActivities(
    userId: string
  ): Promise<FifoTaxActivitySource[]> {
    const activities = await this.prismaService.order.findMany({
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
        isDraft: false,
        type: { in: [ActivityType.BUY, ActivityType.SELL] },
        userId
      }
    });

    return orderFifoActivities(activities);
  }
}
