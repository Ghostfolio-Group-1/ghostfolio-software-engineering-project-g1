import { Order, Type as ActivityType } from '@prisma/client';
import { Big } from 'big.js';

export type FifoTaxActivitySource = Pick<
  Order,
  | 'accountId'
  | 'currency'
  | 'date'
  | 'id'
  | 'quantity'
  | 'symbolProfileId'
  | 'type'
  | 'userId'
>;

export interface TaxCalculationScope {
  userId: string;
  accountId: string | null;
  symbolProfileId: string;
}

export interface TaxLot {
  lotId: string;
  sourceActivityId: string;
  scope: TaxCalculationScope;
  acquiredAt: Date;
  initialQuantity: Big;
  remainingQuantity: Big;
  currency: string | null;
}

export function orderFifoActivities(
  activities: readonly FifoTaxActivitySource[]
): FifoTaxActivitySource[] {
  activities.forEach(assertEligibleFifoActivity);

  return [...activities].sort((left, right) => {
    const dateDifference = left.date.getTime() - right.date.getTime();

    if (dateDifference !== 0) {
      return dateDifference;
    }

    if (left.id < right.id) {
      return -1;
    }

    if (left.id > right.id) {
      return 1;
    }

    return 0;
  });
}

export function createFifoTaxLots(
  activities: readonly FifoTaxActivitySource[]
): TaxLot[] {
  return orderFifoActivities(activities)
    .filter((activity) => activity.type === ActivityType.BUY)
    .map(createTaxLotFromBuy);
}

function createTaxLotFromBuy(activity: FifoTaxActivitySource): TaxLot {
  const quantity = new Big(activity.quantity);

  if (quantity.lte(0)) {
    throw new Error('FIFO BUY quantity must be greater than zero.');
  }

  return {
    lotId: activity.id,
    sourceActivityId: activity.id,
    scope: {
      userId: activity.userId,
      accountId: activity.accountId,
      symbolProfileId: activity.symbolProfileId
    },
    acquiredAt: activity.date,
    initialQuantity: quantity,
    remainingQuantity: new Big(quantity),
    currency: activity.currency
  };
}

function assertEligibleFifoActivity(activity: FifoTaxActivitySource): void {
  if (
    activity.type !== ActivityType.BUY &&
    activity.type !== ActivityType.SELL
  ) {
    throw new Error(
      'FIFO input can only contain eligible BUY and SELL activities.'
    );
  }
}
