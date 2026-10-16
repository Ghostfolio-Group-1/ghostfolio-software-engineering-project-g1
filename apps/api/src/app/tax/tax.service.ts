import { Injectable } from '@nestjs/common';

import {
  calculateFifoRealizedGains,
  FifoRealizedGainMatch,
  FifoRealizedGainSale
} from './fifo-realized-gain';
import {
  TaxRealizedGainMatchResponse,
  TaxRealizedGainSaleResponse,
  TaxRealizedGainsResponse
} from './interfaces/tax-realized-gains-response.interface';
import { TaxDataService } from './tax-data.service';

@Injectable()
export class TaxService {
  public constructor(private readonly taxDataService: TaxDataService) {}

  public async getFifoRealizedGains(
    userId: string
  ): Promise<TaxRealizedGainsResponse> {
    const activities =
      await this.taxDataService.getFifoRealizedGainActivities(userId);

    const result = calculateFifoRealizedGains(activities);

    return {
      method: 'FIFO',
      sales: result.sales.map((sale) => this.toSaleResponse(sale))
    };
  }

  private toSaleResponse(
    sale: FifoRealizedGainSale
  ): TaxRealizedGainSaleResponse {
    return {
      sellActivityId: sale.sellActivityId,
      sellDate: sale.sellDate.toISOString(),
      currency: sale.currency,
      sellQuantity: sale.sellQuantity.toString(),
      matchedQuantity: sale.matchedQuantity.toString(),
      grossProceeds: sale.grossProceeds.toString(),
      grossCostBasis: sale.grossCostBasis.toString(),
      grossRealizedGain: sale.grossRealizedGain.toString(),
      allocatedBuyFees: sale.allocatedBuyFees.toString(),
      sellFee: sale.sellFee.toString(),
      allocatedSellFee: sale.allocatedSellFee.toString(),
      realizedGainAfterActivityFees:
        sale.realizedGainAfterActivityFees.toString(),
      matches: sale.matches.map((match) => this.toMatchResponse(match))
    };
  }

  private toMatchResponse(
    match: FifoRealizedGainMatch
  ): TaxRealizedGainMatchResponse {
    return {
      lotId: match.lotId,
      buyActivityId: match.buyActivityId,
      sellActivityId: match.sellActivityId,
      matchedQuantity: match.matchedQuantity.toString(),
      grossAcquisitionValue: match.grossAcquisitionValue.toString(),
      grossProceeds: match.grossProceeds.toString(),
      grossRealizedGain: match.grossRealizedGain.toString(),
      buyFeeAllocated: match.buyFeeAllocated.toString(),
      sellFeeAllocated: match.sellFeeAllocated.toString(),
      realizedGainAfterActivityFees:
        match.realizedGainAfterActivityFees.toString()
    };
  }
}
