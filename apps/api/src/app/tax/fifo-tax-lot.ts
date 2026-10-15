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
  | 'unitPrice'
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
  unitPrice: Big;
  costBasis: Big;
  currency: string | null;
}

export interface LotConsumption {
  lotId: string;
  buyActivityId: string;
  sellActivityId: string;
  matchedQuantity: Big;
}

export interface FifoLotConsumptionResult {
  lots: TaxLot[];
  consumptions: LotConsumption[];
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

export function consumeFifoTaxLots(
  activities: readonly FifoTaxActivitySource[]
): FifoLotConsumptionResult {
  const lots: TaxLot[] = [];
  const consumptions: LotConsumption[] = [];

  for (const activity of orderFifoActivities(activities)) {
    if (activity.type === ActivityType.BUY) {
      lots.push(createTaxLotFromBuy(activity));
      continue;
    }

    let quantityToMatch = new Big(activity.quantity);

    for (const lot of lots) {
      if (quantityToMatch.lte(0)) {
        break;
      }

      if (!isSameScope(lot.scope, activity) || lot.remainingQuantity.lte(0)) {
        continue;
      }

      const matchedQuantity = quantityToMatch.lt(lot.remainingQuantity)
        ? quantityToMatch
        : lot.remainingQuantity;

      lot.remainingQuantity = lot.remainingQuantity.minus(matchedQuantity);
      lot.costBasis = lot.remainingQuantity.times(lot.unitPrice);
      quantityToMatch = quantityToMatch.minus(matchedQuantity);

      consumptions.push({
        lotId: lot.lotId,
        buyActivityId: lot.sourceActivityId,
        sellActivityId: activity.id,
        matchedQuantity
      });
    }
  }

  return {
    lots,
    consumptions
  };
}

function createTaxLotFromBuy(activity: FifoTaxActivitySource): TaxLot {
  const quantity = new Big(activity.quantity);
  const unitPrice = new Big(activity.unitPrice);

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
    unitPrice,
    costBasis: quantity.times(unitPrice),
    currency: activity.currency
  };
}

function isSameScope(
  scope: TaxCalculationScope,
  activity: FifoTaxActivitySource
): boolean {
  return (
    scope.userId === activity.userId &&
    scope.accountId === activity.accountId &&
    scope.symbolProfileId === activity.symbolProfileId
  );
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
