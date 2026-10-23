import { Injectable } from '@nestjs/common';

import { AverageCostRealizedGainSale } from './average-cost-realized-gain';
import {
  FifoRealizedGainMatch,
  FifoRealizedGainSale
} from './fifo-realized-gain';
import { deriveFifoTaxLots, DerivedFifoTaxLot } from './fifo-tax-lot';
import type {
  TaxResultCompleteness,
  TaxScopeDiagnostic
} from './interfaces/tax-diagnostic.interface';
import {
  TaxLotResponse,
  TaxLotsResponse
} from './interfaces/tax-lots-response.interface';
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

      const response: TaxRealizedGainsResponse = {
        method: 'AVERAGE_COST',
        sales: averageCostResult.sales.map((sale) =>
          this.toAverageCostSaleResponse(sale)
        )
      };

      const diagnostic = await this.taxDataService.getMixedHistoryDiagnostic(
        userId,
        'AVERAGE_COST'
      );

      return this.withDiagnostic(response, diagnostic);
    }

    const fifoResult = calculator.calculate(activities);

    const response: TaxRealizedGainsResponse = {
      method: 'FIFO',
      sales: fifoResult.sales.map((sale) => this.toFifoSaleResponse(sale))
    };

    const diagnostic = await this.taxDataService.getMixedHistoryDiagnostic(
      userId,
      'FIFO'
    );

    return this.withDiagnostic(response, diagnostic);
  }

  public async getFifoRealizedGains(
    userId: string
  ): Promise<TaxRealizedGainsResponse> {
    return this.getRealizedGains(userId, 'FIFO');
  }

  public async getTaxLots(userId: string): Promise<TaxLotsResponse> {
    const activities = await this.taxDataService.getFifoActivities(userId);

    const lots = deriveFifoTaxLots(activities);

    const response: TaxLotsResponse = {
      lots: lots.map((lot) => this.toTaxLotResponse(lot))
    };

    const diagnostic = await this.taxDataService.getMixedHistoryDiagnostic(
      userId,
      'FIFO'
    );

    return this.withDiagnostic(response, diagnostic);
  }

  private withDiagnostic<T extends TaxResultCompleteness>(
    response: T,
    diagnostic: TaxScopeDiagnostic | null
  ): T {
    if (!diagnostic) {
      return response;
    }

    return {
      ...response,
      diagnostics: [diagnostic],
      isComplete: false
    };
  }

  private toTaxLotResponse(lot: DerivedFifoTaxLot): TaxLotResponse {
    return {
      lotId: lot.lotId,
      sourceActivityId: lot.sourceActivityId,
      accountId: lot.scope.accountId,
      symbolProfileId: lot.scope.symbolProfileId,
      acquiredAt: lot.acquiredAt.toISOString(),
      currency: lot.currency,

      // Use toFixed() rather than toString() so very small quantities
      // remain normal decimal strings instead of exponential notation.
      originalQuantity: lot.originalQuantity.toFixed(),
      consumedQuantity: lot.consumedQuantity.toFixed(),
      remainingQuantity: lot.remainingQuantity.toFixed(),

      status: lot.status,
      relatedSellActivityIds: [...lot.relatedSellActivityIds]
    };
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
