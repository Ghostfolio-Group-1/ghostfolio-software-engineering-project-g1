import { EvaluationResult } from '@ghostfolio/api/models/interfaces/evaluation-result.interface';
import { Rule } from '@ghostfolio/api/models/rule';
import { groupHoldingsByWeightedAttribute } from '@ghostfolio/api/models/rules/concentration/weighted-attribute-grouping.util';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import { DEFAULT_CURRENCY } from '@ghostfolio/common/config';
import {
  PortfolioPosition,
  RuleSettings,
  TargetAllocationGroupBy,
  UserSettings
} from '@ghostfolio/common/interfaces';

// Spec: docs/sesha-notes/05-deviation-from-target-allocation-spec.md.
// This is the one category that is optional at the DATA level, not just the
// toggle level: with no target configured, isActive becomes false in
// getSettings() below, so the rule simply does not run - not even a fail.
export interface TargetDeviationBucket {
  actual: number;
  deviation: number;
  key: string;
  passed: boolean;
  target: number;
}

export interface TargetDeviationEvaluationResult extends EvaluationResult {
  buckets?: TargetDeviationBucket[];
}

export class TargetDeviation extends Rule<Settings> {
  private holdings: PortfolioPosition[];

  public constructor(
    exchangeRateDataService: ExchangeRateDataService,
    holdings: PortfolioPosition[]
  ) {
    super(exchangeRateDataService, {
      key: TargetDeviation.name
    });

    this.holdings = holdings;
  }

  public evaluate(ruleSettings: Settings): TargetDeviationEvaluationResult {
    const { buckets: actualBuckets, totalValue } =
      groupHoldingsByWeightedAttribute({
        baseCurrency: ruleSettings.baseCurrency,
        exchangeRateDataService: this.exchangeRateDataService,
        holdings: this.holdings,
        getBuckets: (holding) =>
          this.getBucketsForHolding(holding, ruleSettings.groupBy)
      });

    const actualByKey = new Map(
      actualBuckets.map(({ key, value }) => [
        key,
        totalValue > 0 ? value / totalValue : 0
      ])
    );

    // Every bucket the user actually holds counts, even ones missing from
    // their stated target (those are an implicit 0% target).
    const allKeys = new Set([
      ...ruleSettings.targets.map((target) => target.key),
      ...actualByKey.keys()
    ]);

    const buckets: TargetDeviationBucket[] = Array.from(allKeys).map((key) => {
      const target =
        ruleSettings.targets.find((entry) => entry.key === key)?.percentage ??
        0;
      const actual = actualByKey.get(key) ?? 0;
      const deviation = actual - target;

      return {
        actual,
        deviation,
        key,
        target,
        passed: Math.abs(deviation) <= ruleSettings.thresholdMax
      };
    });

    const worstBucket = buckets.reduce<TargetDeviationBucket | null>(
      (worst, bucket) =>
        !worst || Math.abs(bucket.deviation) > Math.abs(worst.deviation)
          ? bucket
          : worst,
      null
    );

    if (!worstBucket) {
      return {
        evaluation: 'No holdings to compare against the target.',
        value: true
      };
    }

    const passed = buckets.every((bucket) => bucket.passed);
    const points = Math.abs(worstBucket.deviation * 100).toFixed(1);
    const direction = worstBucket.deviation >= 0 ? 'above' : 'below';

    return {
      evaluation: `${worstBucket.key} is ${(worstBucket.actual * 100).toFixed(1)}% of your portfolio, ${points} points ${direction} your ${(worstBucket.target * 100).toFixed(1)}% target.`,
      value: passed,
      buckets
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
    return 'Target Allocation Deviation';
  }

  public getSettings({
    baseCurrency = DEFAULT_CURRENCY,
    locale,
    targetAllocation,
    xRayRules
  }: UserSettings): Settings {
    const isTargetSet = targetAllocation?.isActive === true;

    return {
      baseCurrency,
      locale,
      groupBy: targetAllocation?.groupBy ?? 'assetClass',
      isActive: (xRayRules?.[this.getKey()]?.isActive ?? true) && isTargetSet,
      targets: targetAllocation?.targets ?? [],
      thresholdMax: xRayRules?.[this.getKey()]?.thresholdMax ?? 0.05
    };
  }

  private getBucketsForHolding(
    holding: PortfolioPosition,
    groupBy: TargetAllocationGroupBy
  ): { key: string; weight: number }[] | undefined {
    switch (groupBy) {
      case 'sector':
        return holding.assetProfile.sectors?.map(({ name, weight }) => ({
          key: name,
          weight
        }));
      case 'country':
        return holding.assetProfile.countries?.map(({ code, weight }) => ({
          key: code,
          weight
        }));
      case 'currency':
        return holding.assetProfile.currency
          ? [{ key: holding.assetProfile.currency, weight: 1 }]
          : undefined;
      case 'symbol':
        return holding.assetProfile.symbol
          ? [{ key: holding.assetProfile.symbol, weight: 1 }]
          : undefined;
      case 'assetClass':
      default:
        return holding.assetProfile.assetClass
          ? [{ key: holding.assetProfile.assetClass, weight: 1 }]
          : undefined;
    }
  }
}

interface Settings extends RuleSettings {
  baseCurrency: string;
  groupBy: TargetAllocationGroupBy;
  targets: { key: string; percentage: number }[];
  thresholdMax: number;
}
