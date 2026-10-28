import { groupHoldingsByWeightedAttribute } from '@ghostfolio/api/models/rules/concentration/weighted-attribute-grouping.util';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import { PortfolioPosition } from '@ghostfolio/common/interfaces';

import { Injectable } from '@nestjs/common';

export interface ExposureBucket {
  key: string;
  percentage: number;
  value: number;
}

export interface ExposureBreakdown {
  buckets: ExposureBucket[];
  totalValue: number;
}

// Raw breakdowns (not pass/fail rules) - these back the dashboard's
// concentration panel and ExposureService's RiskSummary, independent of the
// X-Ray rule engine's thresholds. Spec: docs/sesha-notes/10-risk-api-contract.md,
// Section 6.4 (GET /risk/concentration).
@Injectable()
export class ExposureCalculatorService {
  public constructor(
    private exchangeRateDataService: ExchangeRateDataService
  ) {}

  public calculateCurrencyExposure(
    holdings: PortfolioPosition[],
    baseCurrency: string
  ): ExposureBreakdown {
    return this.toBreakdown(
      groupHoldingsByWeightedAttribute({
        baseCurrency,
        holdings,
        exchangeRateDataService: this.exchangeRateDataService,
        getBuckets: (holding) =>
          holding.assetProfile.currency
            ? [{ key: holding.assetProfile.currency, weight: 1 }]
            : undefined
      })
    );
  }

  public calculateAssetClassExposure(
    holdings: PortfolioPosition[],
    baseCurrency: string
  ): ExposureBreakdown {
    return this.toBreakdown(
      groupHoldingsByWeightedAttribute({
        baseCurrency,
        holdings,
        exchangeRateDataService: this.exchangeRateDataService,
        getBuckets: (holding) =>
          holding.assetProfile.assetClass
            ? [{ key: holding.assetProfile.assetClass, weight: 1 }]
            : undefined
      })
    );
  }

  private toBreakdown({
    buckets,
    totalValue
  }: {
    buckets: { key: string; value: number }[];
    totalValue: number;
  }): ExposureBreakdown {
    return {
      totalValue,
      buckets: buckets.map(({ key, value }) => ({
        key,
        value,
        percentage: totalValue > 0 ? value / totalValue : 0
      }))
    };
  }
}
