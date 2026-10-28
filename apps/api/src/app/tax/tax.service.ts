import { Injectable } from '@nestjs/common';

import { AverageCostRealizedGainSale } from './average-cost-realized-gain';
import {
  FifoRealizedGainMatch,
  FifoRealizedGainSale
} from './fifo-realized-gain';
import {
  TaxAverageCostPoolResponse,
  TaxAverageCostRealizedGainSaleResponse,
  TaxFifoRealizedGainSaleResponse,
  TaxRealizedGainMatchResponse,
  TaxRealizedGainsResponse
} from './interfaces/tax-realized-gains-response.interface';
import { getTaxCalculator } from './tax-calculator';
import { TaxDataService } from './tax-data.service';

@Injectable()
export class TaxService {
  public constructor(private readonly taxDataService: TaxDataService) {}

  public async getRealizedGains(
    userId: string,
    method: string = 'FIFO'
  ): Promise<TaxRealizedGainsResponse> {
    const activities =
      await this.taxDataService.getFifoRealizedGainActivities(userId);

    const calculator = getTaxCalculator(method);

    if (calculator.method === 'AVERAGE_COST') {
      const averageCostResult = calculator.calculate(activities);

      return {
        method: 'AVERAGE_COST',
        sales: averageCostResult.sales.map((sale) =>
          this.toAverageCostSaleResponse(sale)
        )
      };
    }

    const fifoResult = calculator.calculate(activities);

    return {
      method: 'FIFO',
      sales: fifoResult.sales.map((sale) => this.toFifoSaleResponse(sale))
    };
  }

  public async getFifoRealizedGains(
    userId: string
  ): Promise<TaxRealizedGainsResponse> {
    return this.getRealizedGains(userId, 'FIFO');
  }

  private toAverageCostPoolResponse(
    pool: AverageCostRealizedGainSale['poolBefore']
  ): TaxAverageCostPoolResponse {
    return {
      quantity: pool.quantity.toString(),
      grossCost: pool.grossCost.toString(),
      acquisitionFeePool: pool.acquisitionFeePool.toString()
    };
  }

  private toAverageCostSaleResponse(
    sale: AverageCostRealizedGainSale
  ): TaxAverageCostRealizedGainSaleResponse {
    return {
      sellActivityId: sale.sellActivityId,
      sellDate: sale.sellDate.toISOString(),
      currency: sale.currency,
      sellQuantity: sale.sellQuantity.toString(),
      matchedQuantity: sale.sellQuantity.toString(),
      grossProceeds: sale.grossProceeds.toString(),
      grossCostBasis: sale.grossCostBasis.toString(),
      grossRealizedGain: sale.grossRealizedGain.toString(),
      allocatedAcquisitionFees: sale.allocatedAcquisitionFees.toString(),
      sellFee: sale.sellFee.toString(),
      allocatedSellFee: sale.sellFee.toString(),
      realizedGainAfterActivityFees:
        sale.realizedGainAfterActivityFees.toString(),
      poolBefore: this.toAverageCostPoolResponse(sale.poolBefore),
      poolAfter: this.toAverageCostPoolResponse(sale.poolAfter)
    };
  }

  private toFifoSaleResponse(
    sale: FifoRealizedGainSale
  ): TaxFifoRealizedGainSaleResponse {
    return {
      sellActivityId: sale.sellActivityId,
      sellDate: sale.sellDate.toISOString(),
      currency: sale.currency,
      sellQuantity: sale.sellQuantity.toString(),
      matchedQuantity: sale.matchedQuantity.toString(),
      grossProceeds: sale.grossProceeds.toString(),
      grossCostBasis: sale.grossCostBasis.toString(),
      grossRealizedGain: sale.grossRealizedGain.toString(),
      allocatedAcquisitionFees: sale.allocatedBuyFees.toString(),
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
