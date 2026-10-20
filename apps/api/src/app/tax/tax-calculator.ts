import type { Order } from '@prisma/client';

import {
  calculateAverageCostRealizedGains,
  type AverageCostRealizedGainResult
} from './average-cost-realized-gain';
import {
  calculateFifoRealizedGains,
  type FifoRealizedGainResult
} from './fifo-realized-gain';

export const TAX_CALCULATION_METHODS = ['FIFO', 'AVERAGE_COST'] as const;

export type TaxCalculationMethod = (typeof TAX_CALCULATION_METHODS)[number];

export type TaxRealizedGainActivitySource = Pick<
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

export type TaxCalculatorResult =
  FifoRealizedGainResult | AverageCostRealizedGainResult;

export interface TaxCalculator<
  TMethod extends TaxCalculationMethod,
  TResult extends TaxCalculatorResult
> {
  readonly method: TMethod;

  calculate(activities: readonly TaxRealizedGainActivitySource[]): TResult;
}

export type AnyTaxCalculator =
  | TaxCalculator<'FIFO', FifoRealizedGainResult>
  | TaxCalculator<'AVERAGE_COST', AverageCostRealizedGainResult>;

export const fifoTaxCalculator: TaxCalculator<'FIFO', FifoRealizedGainResult> =
  {
    method: 'FIFO',
    calculate: calculateFifoRealizedGains
  };

export const averageCostTaxCalculator: TaxCalculator<
  'AVERAGE_COST',
  AverageCostRealizedGainResult
> = {
  method: 'AVERAGE_COST',
  calculate: calculateAverageCostRealizedGains
};

export function getTaxCalculator(
  method: TaxCalculationMethod
): AnyTaxCalculator {
  if (method === 'FIFO') {
    return fifoTaxCalculator;
  }

  if (method === 'AVERAGE_COST') {
    return averageCostTaxCalculator;
  }

  throw new Error(`Unsupported tax calculation method: ${String(method)}`);
}
