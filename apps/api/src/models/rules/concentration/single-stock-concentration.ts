import { Rule } from '@ghostfolio/api/models/rule';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import { DEFAULT_CURRENCY } from '@ghostfolio/common/config';
import {
  PortfolioPosition,
  RuleSettings,
  UserSettings
} from '@ghostfolio/common/interfaces';

import { Big } from 'big.js';

// Concentration spec: docs/sesha-notes/03-concentration-formula-spec.md
// Only individual securities count towards "single stock" concentration -
// a diversified ETF/mutual fund holding 40% of a portfolio is not a single-
// stock risk, since it is already diversified internally.
const ELIGIBLE_ASSET_SUB_CLASSES = ['CRYPTOCURRENCY', 'STOCK'];

export class SingleStockConcentration extends Rule<Settings> {
  private holdings: PortfolioPosition[];

  public constructor(
    exchangeRateDataService: ExchangeRateDataService,
    holdings: PortfolioPosition[]
  ) {
    super(exchangeRateDataService, {
      key: SingleStockConcentration.name
    });

    this.holdings = holdings;
  }

  public evaluate(ruleSettings: Settings) {
    const totalValue = this.holdings.reduce(
      (sum, holding) =>
        sum + this.getValueInBaseCurrency(holding, ruleSettings.baseCurrency),
      0
    );

    const eligibleHoldings = this.holdings.filter((holding) => {
      return ELIGIBLE_ASSET_SUB_CLASSES.includes(
        holding.assetProfile.assetSubClass
      );
    });

    let maxHolding: PortfolioPosition | undefined;
    let maxValue = 0;

    for (const holding of eligibleHoldings) {
      const value = this.getValueInBaseCurrency(
        holding,
        ruleSettings.baseCurrency
      );

      if (value > maxValue) {
        maxValue = value;
        maxHolding = holding;
      }
    }

    const ratio = totalValue > 0 ? maxValue / totalValue : 0;

    if (!maxHolding) {
      return {
        evaluation: 'No individual stock or cryptocurrency holdings found.',
        value: true
      };
    }

    const symbol = maxHolding.assetProfile.symbol;
    const percentage = (ratio * 100).toFixed(1);
    const thresholdPercentage = (ruleSettings.thresholdMax * 100).toFixed(0);

    if (ratio > ruleSettings.thresholdMax) {
      return {
        evaluation: `${symbol} is ${percentage}% of your portfolio, above the ${thresholdPercentage}% threshold.`,
        value: false
      };
    }

    return {
      evaluation: `${symbol} is ${percentage}% of your portfolio, below the ${thresholdPercentage}% threshold.`,
      value: true
    };
  }

  public getConfiguration() {
    return {
      threshold: {
        max: 1,
        min: 0,
        step: 0.01,
        unit: '%'
      },
      thresholdMax: true
    };
  }

  public getName() {
    return 'Single Stock Concentration';
  }

  public getSettings({
    baseCurrency = DEFAULT_CURRENCY,
    locale,
    xRayRules
  }: UserSettings): Settings {
    return {
      baseCurrency,
      locale,
      isActive: xRayRules?.[this.getKey()]?.isActive ?? true,
      thresholdMax: xRayRules?.[this.getKey()]?.thresholdMax ?? 0.1
    };
  }

  private getValueInBaseCurrency(
    holding: PortfolioPosition,
    baseCurrency: string
  ) {
    return this.exchangeRateDataService.toCurrency(
      new Big(holding.quantity).mul(holding.marketPrice ?? 0).toNumber(),
      holding.assetProfile.currency ?? baseCurrency,
      baseCurrency
    );
  }
}

interface Settings extends RuleSettings {
  baseCurrency: string;
  thresholdMax: number;
}
