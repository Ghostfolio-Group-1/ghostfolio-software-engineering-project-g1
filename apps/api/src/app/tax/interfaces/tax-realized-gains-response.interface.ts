import type { TaxResultCompleteness } from './tax-diagnostic.interface';

export interface TaxRealizedGainMatchResponse {
  lotId: string;
  buyActivityId: string;
  sellActivityId: string;
  matchedQuantity: string;
  grossAcquisitionValue: string;
  grossProceeds: string;
  grossRealizedGain: string;
  buyFeeAllocated: string;
  sellFeeAllocated: string;
  realizedGainAfterActivityFees: string;
}

export interface TaxRealizedGainSaleBaseResponse {
  sellActivityId: string;
  sellDate: string;
  currency: string | null;
  sellQuantity: string;
  matchedQuantity: string;
  grossProceeds: string;
  grossCostBasis: string;
  grossRealizedGain: string;
  allocatedAcquisitionFees: string;
  sellFee: string;
  allocatedSellFee: string;
  realizedGainAfterActivityFees: string;
}

export interface TaxFifoRealizedGainSaleResponse extends TaxRealizedGainSaleBaseResponse {
  allocatedBuyFees: string;
  matches: TaxRealizedGainMatchResponse[];
}

export interface TaxAverageCostPoolResponse {
  quantity: string;
  grossCost: string;
  acquisitionFeePool: string;
}

export interface TaxAverageCostRealizedGainSaleResponse extends TaxRealizedGainSaleBaseResponse {
  poolBefore: TaxAverageCostPoolResponse;
  poolAfter: TaxAverageCostPoolResponse;
}

export type TaxRealizedGainSaleResponse =
  TaxFifoRealizedGainSaleResponse | TaxAverageCostRealizedGainSaleResponse;

export type TaxRealizedGainsResponse = (
  | {
      method: 'FIFO';
      sales: TaxFifoRealizedGainSaleResponse[];
    }
  | {
      method: 'AVERAGE_COST';
      sales: TaxAverageCostRealizedGainSaleResponse[];
    }
) &
  TaxResultCompleteness;
