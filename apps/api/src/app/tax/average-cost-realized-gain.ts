import { Type as ActivityType } from '@prisma/client';
import { Big } from 'big.js';

import {
  AverageCostActivitySource,
  AverageCostPool,
  AverageCostPoolSnapshot,
  calculateAverageCostPoolHistory
} from './average-cost';

export type AverageCostRealizedGainActivitySource = AverageCostActivitySource;

export interface AverageCostRealizedGainSale {
  sellActivityId: string;
  sellDate: Date;
  currency: string;
  sellQuantity: Big;
  grossProceeds: Big;
  grossCostBasis: Big;
  grossRealizedGain: Big;
  allocatedAcquisitionFees: Big;
  sellFee: Big;
  realizedGainAfterActivityFees: Big;
  poolBefore: AverageCostPoolSnapshot;
  poolAfter: AverageCostPoolSnapshot;
}

export interface AverageCostRealizedGainResult {
  pools: AverageCostPool[];
  sales: AverageCostRealizedGainSale[];
}

export function calculateAverageCostRealizedGains(
  activities: readonly AverageCostRealizedGainActivitySource[]
): AverageCostRealizedGainResult {
  const { pools, transitions } = calculateAverageCostPoolHistory(activities);

  const activityById = new Map(
    activities.map((activity) => [activity.id, activity])
  );

  const sales = transitions
    .filter(({ activityType }) => activityType === ActivityType.SELL)
    .map((transition) => {
      const sell = getActivity(activityById, transition.activityId);

      if (sell.type !== ActivityType.SELL) {
        throw new Error(
          `Average-cost transition ${transition.activityId} is not a SELL activity.`
        );
      }

      const sellQuantity = new Big(sell.quantity);
      const sellFee = new Big(sell.fee);

      const grossProceeds = sellQuantity.times(sell.unitPrice);

      /*
       * Derive the disposed basis from the actual pool transition rather than
       * recalculating the disposal ratio here. This keeps realized-gain
       * arithmetic aligned with the running-pool engine and preserves any
       * residual assigned on final liquidation.
       */
      const grossCostBasis = transition.poolBefore.grossCost.minus(
        transition.poolAfter.grossCost
      );

      const allocatedAcquisitionFees =
        transition.poolBefore.acquisitionFeePool.minus(
          transition.poolAfter.acquisitionFeePool
        );

      const grossRealizedGain = grossProceeds.minus(grossCostBasis);

      const realizedGainAfterActivityFees = grossRealizedGain
        .minus(allocatedAcquisitionFees)
        .minus(sellFee);

      return {
        sellActivityId: sell.id,
        sellDate: sell.date,
        currency: transition.poolBefore.currency,
        sellQuantity,
        grossProceeds,
        grossCostBasis,
        grossRealizedGain,
        allocatedAcquisitionFees,
        sellFee,
        realizedGainAfterActivityFees,
        poolBefore: transition.poolBefore,
        poolAfter: transition.poolAfter
      };
    });

  return {
    pools,
    sales
  };
}

function getActivity(
  activityById: ReadonlyMap<string, AverageCostRealizedGainActivitySource>,
  activityId: string
): AverageCostRealizedGainActivitySource {
  const activity = activityById.get(activityId);

  if (!activity) {
    throw new Error(
      `Average-cost activity ${activityId} is missing from source input.`
    );
  }

  return activity;
}
