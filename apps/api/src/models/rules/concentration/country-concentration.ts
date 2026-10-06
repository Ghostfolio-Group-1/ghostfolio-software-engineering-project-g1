import { Rule } from '@ghostfolio/api/models/rule';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import { DEFAULT_CURRENCY } from '@ghostfolio/common/config';
import {
  PortfolioPosition,
  RuleSettings,
  UserSettings
} from '@ghostfolio/common/interfaces';

import { groupHoldingsByWeightedAttribute } from './weighted-attribute-grouping.util';

export class CountryConcentration extends Rule<Settings> {
  private holdings: PortfolioPosition[];

  public constructor(
    exchangeRateDataService: ExchangeRateDataService,
    holdings: PortfolioPosition[]
  ) {
    super(exchangeRateDataService, {
      key: CountryConcentration.name
    });

    this.holdings = holdings;
  }

  public evaluate(ruleSettings: Settings) {
    const { buckets, totalValue } = groupHoldingsByWeightedAttribute({
      baseCurrency: ruleSettings.baseCurrency,
      exchangeRateDataService: this.exchangeRateDataService,
      holdings: this.holdings,
      getBuckets: (holding) =>
        holding.assetProfile.countries?.map(({ code, weight }) => ({
          key: code,
          weight
        }))
    });

    const maxBucket = buckets[0];
    const ratio =
      maxBucket && totalValue > 0 ? maxBucket.value / totalValue : 0;
    const percentage = (ratio * 100).toFixed(1);
    const thresholdPercentage = (ruleSettings.thresholdMax * 100).toFixed(0);

    if (!maxBucket) {
      return { evaluation: 'No country data available.', value: true };
    }

    if (ratio > ruleSettings.thresholdMax) {
      return {
        evaluation: `${maxBucket.key} is ${percentage}% of your portfolio, above the ${thresholdPercentage}% threshold.`,
        value: false
      };
    }

    return {
      evaluation: `${maxBucket.key} is ${percentage}% of your portfolio, below the ${thresholdPercentage}% threshold.`,
      value: true
    };
  }

  public getConfiguration() {
    return {
      threshold: { max: 1, min: 0, step: 0.01, unit: '%' },
      thresholdMax: true
    };
  }

  public getName() {
    return 'Country Concentration';
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
      thresholdMax: xRayRules?.[this.getKey()]?.thresholdMax ?? 0.5
    };
  }
}

interface Settings extends RuleSettings {
  baseCurrency: string;
  thresholdMax: number;
}
