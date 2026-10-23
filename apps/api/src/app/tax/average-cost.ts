import { Order, Type as ActivityType } from '@prisma/client';
import { Big } from 'big.js';

export type AverageCostActivitySource = Pick<
  Order,
  | 'accountId'
  | 'currency'
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
  currency: string;
  quantity: Big;
  grossCost: Big;
  acquisitionFeePool: Big;
  sourceActivityIds: string[];
}

export interface AverageCostPoolSnapshot {
  scope: AverageCostPoolScope;
  currency: string;
  quantity: Big;
  grossCost: Big;
  acquisitionFeePool: Big;
  sourceActivityIds: string[];
}

export interface AverageCostPoolTransition {
  activityId: string;
  activityType: ActivityType;
  poolBefore: AverageCostPoolSnapshot;
  poolAfter: AverageCostPoolSnapshot;
}

export interface AverageCostPoolCalculation {
  pools: AverageCostPool[];
  transitions: AverageCostPoolTransition[];
}

export function orderAverageCostActivities<T extends AverageCostActivitySource>(
  activities: readonly T[]
): T[] {
  activities.forEach(assertEligibleAverageCostActivity);

  // DR-3 intentionally orders by the full activity timestamp and then
  // activity id. It does not force BUY before SELL. Therefore, if a SELL and
  // its supporting BUY have the exact same timestamp and the SELL id sorts
  // first, the SELL can fail for insufficient holdings.
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
  return calculateAverageCostPoolHistory(activities).pools;
}

export function calculateAverageCostPoolHistory(
  activities: readonly AverageCostActivitySource[]
): AverageCostPoolCalculation {
  const pools = new Map<string, AverageCostPool>();
  const transitions: AverageCostPoolTransition[] = [];

  for (const activity of orderAverageCostActivities(activities)) {
    const pool = getOrCreatePool(pools, activity);
    const poolBefore = snapshotPool(pool);

    if (activity.type === ActivityType.BUY) {
      applyBuyToPool(pool, activity);
    } else {
      applySellToPool(pool, activity);
    }

    pool.sourceActivityIds.push(activity.id);

    transitions.push({
      activityId: activity.id,
      activityType: activity.type,
      poolBefore,
      poolAfter: snapshotPool(pool)
    });
  }

  return {
    pools: Array.from(pools.values()),
    transitions
  };
}

function getOrCreatePool(
  pools: Map<string, AverageCostPool>,
  activity: AverageCostActivitySource
): AverageCostPool {
  const currency = requireAverageCostCurrency(activity);
  const key = createPoolKey(activity.userId, activity.symbolProfileId);
  const existingPool = pools.get(key);

  if (existingPool) {
    if (existingPool.currency !== currency) {
      throw new Error(
        `Average-cost pool requires historical FX conversion from ${currency} to ${existingPool.currency} for activity ${activity.id}.`
      );
    }

    return existingPool;
  }

  const pool: AverageCostPool = {
    scope: {
      userId: activity.userId,
      symbolProfileId: activity.symbolProfileId
    },
    currency,
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
  /*
   * Multiply before dividing to avoid introducing avoidable precision loss
   * from a repeating disposal ratio.
   */
  const grossCostReduction = pool.grossCost
    .times(sellQuantity)
    .div(pool.quantity);

  const feePoolReduction = pool.acquisitionFeePool
    .times(sellQuantity)
    .div(pool.quantity);
  pool.quantity = pool.quantity.minus(sellQuantity);

  // Reset exactly to zero after a full liquidation. This avoids carrying any
  // division residue into a later re-entry for the same user and asset.
  if (pool.quantity.eq(0)) {
    pool.grossCost = new Big(0);
    pool.acquisitionFeePool = new Big(0);

    return;
  }

  pool.grossCost = pool.grossCost.minus(grossCostReduction);
  pool.acquisitionFeePool = pool.acquisitionFeePool.minus(feePoolReduction);
}

function snapshotPool(pool: AverageCostPool): AverageCostPoolSnapshot {
  return {
    scope: {
      userId: pool.scope.userId,
      symbolProfileId: pool.scope.symbolProfileId
    },
    currency: pool.currency,
    quantity: new Big(pool.quantity),
    grossCost: new Big(pool.grossCost),
    acquisitionFeePool: new Big(pool.acquisitionFeePool),
    sourceActivityIds: [...pool.sourceActivityIds]
  };
}

function createPoolKey(userId: string, symbolProfileId: string): string {
  return JSON.stringify([userId, symbolProfileId]);
}

function requireAverageCostCurrency(
  activity: AverageCostActivitySource
): string {
  if (!activity.currency) {
    throw new Error(
      `Average-cost activity ${activity.id} requires a known transaction currency.`
    );
  }

  return activity.currency;
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

  requireAverageCostCurrency(activity);

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
