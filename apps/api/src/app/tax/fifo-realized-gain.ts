import { Order, Type as ActivityType } from '@prisma/client';
import { Big } from 'big.js';

import {
  consumeFifoTaxLots,
  FifoTaxActivitySource,
  TaxLot
} from './fifo-tax-lot';

export type FifoRealizedGainActivitySource = FifoTaxActivitySource &
  Pick<Order, 'fee' | 'unitPrice'>;

export interface FifoRealizedGainMatch {
  lotId: string;
  buyActivityId: string;
  sellActivityId: string;
  matchedQuantity: Big;
  grossAcquisitionValue: Big;
  grossProceeds: Big;
  grossRealizedGain: Big;
  buyFeeAllocated: Big;
  sellFeeAllocated: Big;
  realizedGainAfterActivityFees: Big;
}

export interface FifoRealizedGainSale {
  sellActivityId: string;
  sellDate: Date;
  currency: string | null;
  sellQuantity: Big;
  matchedQuantity: Big;
  grossProceeds: Big;
  grossCostBasis: Big;
  grossRealizedGain: Big;
  allocatedBuyFees: Big;
  sellFee: Big;
  allocatedSellFee: Big;
  realizedGainAfterActivityFees: Big;
  matches: FifoRealizedGainMatch[];
}

export interface FifoRealizedGainResult {
  lots: TaxLot[];
  sales: FifoRealizedGainSale[];
}

export function calculateFifoRealizedGains(
  activities: readonly FifoRealizedGainActivitySource[]
): FifoRealizedGainResult {
  const { lots, consumptions } = consumeFifoTaxLots(activities);
  const activityById = new Map(
    activities.map((activity) => [activity.id, activity])
  );
  const buyAllocatedFees = new Map<string, Big>();
  const buyMatchedQuantities = new Map<string, Big>();
  const sellAllocatedFees = new Map<string, Big>();
  const sellMatchedQuantities = new Map<string, Big>();
  const matchesBySell = new Map<string, FifoRealizedGainMatch[]>();

  for (const consumption of consumptions) {
    const buy = getActivity(activityById, consumption.buyActivityId);
    const sell = getActivity(activityById, consumption.sellActivityId);

    if (buy.type !== ActivityType.BUY || sell.type !== ActivityType.SELL) {
      throw new Error(
        'FIFO consumption trace contains invalid activity types.'
      );
    }

    const matchedQuantity = new Big(consumption.matchedQuantity);
    const grossAcquisitionValue = matchedQuantity.times(buy.unitPrice);
    const grossProceeds = matchedQuantity.times(sell.unitPrice);
    const grossRealizedGain = grossProceeds.minus(grossAcquisitionValue);

    const buyMatchedQuantity = addToTotal(
      buyMatchedQuantities,
      buy.id,
      matchedQuantity
    );
    const buyFeeAllocated = allocateFee(
      new Big(buy.fee),
      matchedQuantity,
      new Big(buy.quantity),
      buyAllocatedFees.get(buy.id) ?? new Big(0),
      buyMatchedQuantity.eq(buy.quantity)
    );
    addToTotal(buyAllocatedFees, buy.id, buyFeeAllocated);

    const sellMatchedQuantity = addToTotal(
      sellMatchedQuantities,
      sell.id,
      matchedQuantity
    );
    const sellFeeAllocated = allocateFee(
      new Big(sell.fee),
      matchedQuantity,
      new Big(sell.quantity),
      sellAllocatedFees.get(sell.id) ?? new Big(0),
      sellMatchedQuantity.eq(sell.quantity)
    );
    addToTotal(sellAllocatedFees, sell.id, sellFeeAllocated);

    const realizedGainAfterActivityFees = grossRealizedGain
      .minus(buyFeeAllocated)
      .minus(sellFeeAllocated);

    const match: FifoRealizedGainMatch = {
      lotId: consumption.lotId,
      buyActivityId: buy.id,
      sellActivityId: sell.id,
      matchedQuantity,
      grossAcquisitionValue,
      grossProceeds,
      grossRealizedGain,
      buyFeeAllocated,
      sellFeeAllocated,
      realizedGainAfterActivityFees
    };

    const sellMatches = matchesBySell.get(sell.id) ?? [];
    sellMatches.push(match);
    matchesBySell.set(sell.id, sellMatches);
  }

  const sales = Array.from(matchesBySell.entries()).map(
    ([sellActivityId, matches]) => {
      const sell = getActivity(activityById, sellActivityId);

      return {
        sellActivityId,
        sellDate: sell.date,
        currency: sell.currency,
        sellQuantity: new Big(sell.quantity),
        matchedQuantity: sum(matches, ({ matchedQuantity }) => matchedQuantity),
        grossProceeds: sum(matches, ({ grossProceeds }) => grossProceeds),
        grossCostBasis: sum(
          matches,
          ({ grossAcquisitionValue }) => grossAcquisitionValue
        ),
        grossRealizedGain: sum(
          matches,
          ({ grossRealizedGain }) => grossRealizedGain
        ),
        allocatedBuyFees: sum(
          matches,
          ({ buyFeeAllocated }) => buyFeeAllocated
        ),
        sellFee: new Big(sell.fee),
        allocatedSellFee: sum(
          matches,
          ({ sellFeeAllocated }) => sellFeeAllocated
        ),
        realizedGainAfterActivityFees: sum(
          matches,
          ({ realizedGainAfterActivityFees }) => realizedGainAfterActivityFees
        ),
        matches
      };
    }
  );

  return { lots, sales };
}

function allocateFee(
  totalFee: Big,
  matchedQuantity: Big,
  totalQuantity: Big,
  allocatedSoFar: Big,
  isFinalAllocation: boolean
): Big {
  if (isFinalAllocation) {
    return totalFee.minus(allocatedSoFar);
  }

  return totalFee.times(matchedQuantity).div(totalQuantity);
}

function addToTotal(totals: Map<string, Big>, id: string, value: Big): Big {
  const next = (totals.get(id) ?? new Big(0)).plus(value);
  totals.set(id, next);

  return next;
}

function getActivity(
  activityById: ReadonlyMap<string, FifoRealizedGainActivitySource>,
  activityId: string
): FifoRealizedGainActivitySource {
  const activity = activityById.get(activityId);

  if (!activity) {
    throw new Error(
      `FIFO activity ${activityId} is missing from source input.`
    );
  }

  return activity;
}

function sum<T>(items: readonly T[], select: (item: T) => Big): Big {
  return items.reduce((total, item) => total.plus(select(item)), new Big(0));
}
