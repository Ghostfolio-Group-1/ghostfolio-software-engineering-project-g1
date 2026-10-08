import { groupHoldingsByWeightedAttribute } from '@ghostfolio/api/models/rules/concentration/weighted-attribute-grouping.util';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import { PortfolioPosition } from '@ghostfolio/common/interfaces';

import { Injectable } from '@nestjs/common';

import {
  ExposureBucket,
  ExposureCalculatorService
} from './exposure-calculator.service';
import { RiskSummary } from './interfaces/risk-summary.interface';

const ELIGIBLE_STOCK_SUB_CLASSES = ['CRYPTOCURRENCY', 'STOCK'];

// Combines the concentration breakdowns (stock/sector/country/currency - the
// same buckets the X-Ray rules evaluate internally) with the exposure
// breakdowns (currency/asset-class) into one RiskSummary, per
// docs/sesha-notes/10-risk-api-contract.md Sections 6.2 and 6.4.
@Injectable()
export class ExposureService {
  public constructor(
    private exchangeRateDataService: ExchangeRateDataService,
    private exposureCalculatorService: ExposureCalculatorService
  ) {}

  public buildRiskSummary(
    holdings: PortfolioPosition[],
    baseCurrency: string
  ): RiskSummary {
    const totalValue = holdings.reduce((sum, holding) => {
      return (
        sum +
        this.exchangeRateDataService.toCurrency(
          holding.quantity * (holding.marketPrice ?? 0),
          holding.assetProfile.currency ?? baseCurrency,
          baseCurrency
        )
      );
    }, 0);

    const stockHoldings = holdings.filter((holding) =>
      ELIGIBLE_STOCK_SUB_CLASSES.includes(holding.assetProfile.assetSubClass)
    );

    return {
      totalValue,
      concentration: {
        stock: this.toBuckets(
          groupHoldingsByWeightedAttribute({
            baseCurrency,
            holdings: stockHoldings,
            exchangeRateDataService: this.exchangeRateDataService,
            getBuckets: (holding) =>
              holding.assetProfile.symbol
                ? [{ key: holding.assetProfile.symbol, weight: 1 }]
                : undefined
          }).buckets,
          totalValue
        ),
        sector: this.toBuckets(
          groupHoldingsByWeightedAttribute({
            baseCurrency,
            holdings,
            exchangeRateDataService: this.exchangeRateDataService,
            getBuckets: (holding) =>
              holding.assetProfile.sectors?.map(({ name, weight }) => ({
                key: name,
                weight
              }))
          }).buckets,
          totalValue
        ),
        country: this.toBuckets(
          groupHoldingsByWeightedAttribute({
            baseCurrency,
            holdings,
            exchangeRateDataService: this.exchangeRateDataService,
            getBuckets: (holding) =>
              holding.assetProfile.countries?.map(({ code, weight }) => ({
                key: code,
                weight
              }))
          }).buckets,
          totalValue
        ),
        currency: this.exposureCalculatorService.calculateCurrencyExposure(
          holdings,
          baseCurrency
        ).buckets
      },
      exposure: {
        currency: this.exposureCalculatorService.calculateCurrencyExposure(
          holdings,
          baseCurrency
        ).buckets,
        assetClass: this.exposureCalculatorService.calculateAssetClassExposure(
          holdings,
          baseCurrency
        ).buckets
      }
    };
  }

  private toBuckets(
    buckets: { key: string; value: number }[],
    totalValue: number
  ): ExposureBucket[] {
    return buckets.map(({ key, value }) => ({
      key,
      value,
      percentage: totalValue > 0 ? value / totalValue : 0
    }));
  }
}
