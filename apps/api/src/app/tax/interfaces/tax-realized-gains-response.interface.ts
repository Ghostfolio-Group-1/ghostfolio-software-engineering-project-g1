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

export interface TaxRealizedGainSaleResponse {
  sellActivityId: string;
  sellDate: string;
  currency: string | null;
  sellQuantity: string;
  matchedQuantity: string;
  grossProceeds: string;
  grossCostBasis: string;
  grossRealizedGain: string;
  allocatedBuyFees: string;
  sellFee: string;
  allocatedSellFee: string;
  realizedGainAfterActivityFees: string;
  matches: TaxRealizedGainMatchResponse[];
}

export interface TaxRealizedGainsResponse {
  method: 'FIFO';
  sales: TaxRealizedGainSaleResponse[];
}
