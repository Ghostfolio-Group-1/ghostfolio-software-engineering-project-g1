import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import { TAG_ID_DRAFT } from '@ghostfolio/common/config';

import { Injectable } from '@nestjs/common';
import { Prisma, Type as ActivityType } from '@prisma/client';

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
    // Explicitly typed so an unknown field is a compile error, not a runtime one.
    const where: Prisma.OrderWhereInput = {
      tags: { none: { id: TAG_ID_DRAFT } },
      type: { in: [ActivityType.BUY, ActivityType.SELL] },
      userId
    };

    const activities = await this.prismaService.order.findMany({
      where,
      select: {
        accountId: true,
        currency: true,
        date: true,
        id: true,
        quantity: true,
        symbolProfileId: true,
        type: true,
        userId: true
      }
    });

    return orderFifoActivities(activities);
  }
}
