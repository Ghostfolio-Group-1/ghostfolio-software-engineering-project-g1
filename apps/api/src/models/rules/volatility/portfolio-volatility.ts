import { RiskEvaluationResult } from '@ghostfolio/api/app/risk/interfaces/risk-evaluation-result.interface';
import { Rule } from '@ghostfolio/api/models/rule';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import { RuleSettings, UserSettings } from '@ghostfolio/common/interfaces';

// Reads a precomputed annualized volatility value (nightly cache, see
// volatility-cache.service.ts) rather than recalculating a covariance
// matrix per request. Spec: docs/sesha-notes/04-volatility-cash-allocation-spec.md.
const MINIMUM_HISTORY_DAYS = 20;

export class PortfolioVolatility extends Rule<Settings> {
  public constructor(
    exchangeRateDataService: ExchangeRateDataService,
    private annualizedVolatility: number | null,
    private historyDays: number
  ) {
    super(exchangeRateDataService, {
      key: PortfolioVolatility.name
    });
  }

  public evaluate(ruleSettings: Settings): RiskEvaluationResult {
    if (
      this.annualizedVolatility === null ||
      this.historyDays < MINIMUM_HISTORY_DAYS
    ) {
      return {
        evaluation: `Not enough price history to estimate volatility (${this.historyDays} days, need at least ${MINIMUM_HISTORY_DAYS}).`,
        value: true,
        details: { hasSufficientData: false, historyDays: this.historyDays }
      };
    }

    const percentage = (this.annualizedVolatility * 100).toFixed(1);

    if (
      this.annualizedVolatility < ruleSettings.thresholdMin ||
      this.annualizedVolatility > ruleSettings.thresholdMax
    ) {
      return {
        evaluation: `Estimated annualized volatility is ${percentage}%, outside the ${(ruleSettings.thresholdMin * 100).toFixed(0)}%-${(ruleSettings.thresholdMax * 100).toFixed(0)}% band.`,
        value: false,
        actual: this.annualizedVolatility,
        details: { hasSufficientData: true, historyDays: this.historyDays }
      };
    }

    return {
      evaluation: `Estimated annualized volatility is ${percentage}%, within the ${(ruleSettings.thresholdMin * 100).toFixed(0)}%-${(ruleSettings.thresholdMax * 100).toFixed(0)}% band.`,
      value: true,
      actual: this.annualizedVolatility,
      details: { hasSufficientData: true, historyDays: this.historyDays }
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
    return 'Volatility Estimate';
  }

  public getSettings({ locale, xRayRules }: UserSettings): Settings {
    return {
      locale,
      isActive: xRayRules?.[this.getKey()]?.isActive ?? true,
      thresholdMax: xRayRules?.[this.getKey()]?.thresholdMax ?? 0.25,
      thresholdMin: xRayRules?.[this.getKey()]?.thresholdMin ?? 0.1
    };
  }
}

interface Settings extends RuleSettings {
  thresholdMax: number;
  thresholdMin: number;
}
