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
  grossProceeds: string;
  grossCostBasis: string;
  grossRealizedGain: string;
  sellFee: string;
  realizedGainAfterActivityFees: string;
}

export interface TaxFifoRealizedGainSaleResponse extends TaxRealizedGainSaleBaseResponse {
  matchedQuantity: string;
  allocatedBuyFees: string;
  allocatedSellFee: string;
  matches: TaxRealizedGainMatchResponse[];
}

export interface TaxAverageCostPoolResponse {
  quantity: string;
  grossCost: string;
  acquisitionFeePool: string;
}

export interface TaxAverageCostRealizedGainSaleResponse extends TaxRealizedGainSaleBaseResponse {
  allocatedAcquisitionFees: string;
  poolBefore: TaxAverageCostPoolResponse;
  poolAfter: TaxAverageCostPoolResponse;
}

export type TaxRealizedGainSaleResponse =
  TaxFifoRealizedGainSaleResponse | TaxAverageCostRealizedGainSaleResponse;

export type TaxRealizedGainsResponse =
  | {
      method: 'FIFO';
      sales: TaxFifoRealizedGainSaleResponse[];
    }
  | {
      method: 'AVERAGE_COST';
      sales: TaxAverageCostRealizedGainSaleResponse[];
    };
