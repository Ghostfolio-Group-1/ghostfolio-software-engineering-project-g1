import type { TaxResultCompleteness } from './tax-diagnostic.interface';

export type TaxLotStatus = 'OPEN' | 'PARTIALLY_CONSUMED' | 'CLOSED';

export interface TaxLotResponse {
  lotId: string;
  sourceActivityId: string;
  accountId: string | null;
  symbolProfileId: string;
  acquiredAt: string;
  currency: string | null;
  originalQuantity: string;
  consumedQuantity: string;
  remainingQuantity: string;
  status: TaxLotStatus;
  relatedSellActivityIds: string[];
}

export interface TaxLotsResponse extends TaxResultCompleteness {
  lots: TaxLotResponse[];
}
