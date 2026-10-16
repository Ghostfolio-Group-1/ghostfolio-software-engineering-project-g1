import { Order, Type as ActivityType } from '@prisma/client';
import { Big } from 'big.js';

export type AverageCostActivitySource = Pick<
  Order,
  | 'accountId'
  | 'date'
  | 'fee'
  | 'id'
  | 'quantity'
  | 'symbolProfileId'
  | 'type'
  | 'unitPrice'
  | 'userId'
>;

export interface AverageCostPoolScope {
  userId: string;
  symbolProfileId: string;
}

export interface AverageCostPool {
  scope: AverageCostPoolScope;
  quantity: Big;
  grossCost: Big;
  acquisitionFeePool: Big;
  sourceActivityIds: string[];
}

export function orderAverageCostActivities<T extends AverageCostActivitySource>(
  activities: readonly T[]
): T[] {
  activities.forEach(assertEligibleAverageCostActivity);

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

export function calculateAverageCostPools(
  activities: readonly AverageCostActivitySource[]
): AverageCostPool[] {
  const pools = new Map<string, AverageCostPool>();

  for (const activity of orderAverageCostActivities(activities)) {
    const pool = getOrCreatePool(pools, activity);

    if (activity.type === ActivityType.BUY) {
      applyBuyToPool(pool, activity);
    } else {
      applySellToPool(pool, activity);
    }

    pool.sourceActivityIds.push(activity.id);
  }

  return Array.from(pools.values());
}

function getOrCreatePool(
  pools: Map<string, AverageCostPool>,
  activity: AverageCostActivitySource
): AverageCostPool {
  const key = createPoolKey(activity.userId, activity.symbolProfileId);
  const existingPool = pools.get(key);

  if (existingPool) {
    return existingPool;
  }

  const pool: AverageCostPool = {
    scope: {
      userId: activity.userId,
      symbolProfileId: activity.symbolProfileId
    },
    quantity: new Big(0),
    grossCost: new Big(0),
    acquisitionFeePool: new Big(0),
    sourceActivityIds: []
  };

  pools.set(key, pool);

  return pool;
}

function applyBuyToPool(
  pool: AverageCostPool,
  activity: AverageCostActivitySource
): void {
  const quantity = new Big(activity.quantity);
  const unitPrice = new Big(activity.unitPrice);
  const fee = new Big(activity.fee);

  pool.quantity = pool.quantity.plus(quantity);
  pool.grossCost = pool.grossCost.plus(quantity.times(unitPrice));
  pool.acquisitionFeePool = pool.acquisitionFeePool.plus(fee);
}

function applySellToPool(
  pool: AverageCostPool,
  activity: AverageCostActivitySource
): void {
  const sellQuantity = new Big(activity.quantity);

  if (sellQuantity.gt(pool.quantity)) {
    throw new Error(
      `Average-cost SELL ${activity.id} exceeds available holdings by ${sellQuantity
        .minus(pool.quantity)
        .toString()}.`
    );
  }

  const disposalRatio = sellQuantity.div(pool.quantity);
  const grossCostReduction = pool.grossCost.times(disposalRatio);
  const feePoolReduction = pool.acquisitionFeePool.times(disposalRatio);

  pool.quantity = pool.quantity.minus(sellQuantity);

  if (pool.quantity.eq(0)) {
    pool.grossCost = new Big(0);
    pool.acquisitionFeePool = new Big(0);

    return;
  }

  pool.grossCost = pool.grossCost.minus(grossCostReduction);
  pool.acquisitionFeePool = pool.acquisitionFeePool.minus(feePoolReduction);
}

function createPoolKey(userId: string, symbolProfileId: string): string {
  return JSON.stringify([userId, symbolProfileId]);
}

function assertEligibleAverageCostActivity(
  activity: AverageCostActivitySource
): void {
  if (
    activity.type !== ActivityType.BUY &&
    activity.type !== ActivityType.SELL
  ) {
    throw new Error(
      'Average-cost input can only contain eligible BUY and SELL activities.'
    );
  }

  const quantity = new Big(activity.quantity);

  if (quantity.lte(0)) {
    throw new Error(
      `Average-cost ${activity.type} quantity must be greater than zero.`
    );
  }

  const fee = new Big(activity.fee);

  if (fee.lt(0)) {
    throw new Error(`Average-cost ${activity.type} fee must not be negative.`);
  }
}
