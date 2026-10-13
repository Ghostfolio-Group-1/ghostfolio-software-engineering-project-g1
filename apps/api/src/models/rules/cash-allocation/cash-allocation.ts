import { Rule } from '@ghostfolio/api/models/rule';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import { RuleSettings, UserSettings } from '@ghostfolio/common/interfaces';

// Distinct from the existing BuyingPower rule: BuyingPower is an absolute
// dollar floor ("enough cash for near-term needs"); this is a ratio/band
// check ("is the cash-to-invested split efficient"). The two can legitimately
// disagree without double-counting. Spec: docs/sesha-notes/04, Section 3.
export class CashAllocation extends Rule<Settings> {
  public constructor(
    exchangeRateDataService: ExchangeRateDataService,
    private cashBalance: number,
    private totalPortfolioValue: number
  ) {
    super(exchangeRateDataService, {
      key: CashAllocation.name
    });
  }

  public evaluate(ruleSettings: Settings) {
    const ratio =
      this.totalPortfolioValue > 0
        ? this.cashBalance / this.totalPortfolioValue
        : 0;
    const percentage = (ratio * 100).toFixed(1);
    const minPercentage = (ruleSettings.thresholdMin * 100).toFixed(0);
    const maxPercentage = (ruleSettings.thresholdMax * 100).toFixed(0);

    // Band is inclusive on both ends: a ratio exactly at thresholdMin or
    // thresholdMax passes, matching the warning-threshold design (green
    // band = [min, max]).
    if (
      ratio < ruleSettings.thresholdMin ||
      ratio > ruleSettings.thresholdMax
    ) {
      return {
        evaluation: `${percentage}% of your portfolio is in cash, outside the ${minPercentage}%-${maxPercentage}% target band.`,
        value: false,
        actual: ratio
      };
    }

    return {
      evaluation: `${percentage}% of your portfolio is in cash, within the ${minPercentage}%-${maxPercentage}% target band.`,
      value: true,
      actual: ratio
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
      thresholdMax: true,
      thresholdMin: true
    };
  }

  public getName() {
    return 'Cash Allocation';
  }

  public getSettings({ locale, xRayRules }: UserSettings): Settings {
    return {
      locale,
      isActive: xRayRules?.[this.getKey()]?.isActive ?? true,
      thresholdMax: xRayRules?.[this.getKey()]?.thresholdMax ?? 0.15,
      thresholdMin: xRayRules?.[this.getKey()]?.thresholdMin ?? 0.02
    };
  }
}

interface Settings extends RuleSettings {
  thresholdMax: number;
  thresholdMin: number;
}
