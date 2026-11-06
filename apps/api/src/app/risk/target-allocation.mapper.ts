import { TargetDeviation } from '@ghostfolio/api/models/rules/target-deviation/target-deviation';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import {
  PortfolioPosition,
  TargetAllocationSettings
} from '@ghostfolio/common/interfaces';

import { AssetClass } from '@prisma/client';

import { UpdateTargetAllocationDto } from './dtos/update-target-allocation.dto';
import {
  TargetAllocationBucket,
  TargetAllocationResponse
} from './interfaces/target-allocation-response.interface';
import { toRiskThresholds } from './risk-score.mapper';
import { ThresholdEngineService } from './threshold-engine.service';
import { getThresholdDefault } from './warning-threshold.model';

// Spec: docs/sesha-notes/10-risk-api-contract.md, Sections 6.5-6.7.
const SUM_TOLERANCE = 0.0001;
// "Missing buckets count as a 0% target" (Section 6.6) plus the special
// CASH key (Section 11): valid keys for groupBy "assetClass" only.
const VALID_ASSET_CLASS_KEYS = [...Object.values(AssetClass), 'CASH'];

export interface TargetAllocationValidationError {
  code:
    | 'RISK_TARGET_DUPLICATE_KEY'
    | 'RISK_TARGET_INVALID_KEY'
    | 'RISK_TARGET_INVALID_SUM';
  message: string;
}

// Validates the PUT body before anything is saved (Section 6.6). Keys for
// groupBy values other than "assetClass" (country/currency/sector/symbol)
// are not checked against market data here - that would need a holdings/
// security lookup this pure function doesn't have, so an invalid key for
// those groupBy values is only caught once the target is evaluated, not at
// save time. Flagging this rather than silently accepting it.
export function validateTargetAllocationInput(
  dto: UpdateTargetAllocationDto
): TargetAllocationValidationError | null {
  const keys = dto.targets.map((target) => target.key);

  if (new Set(keys).size !== keys.length) {
    return {
      code: 'RISK_TARGET_DUPLICATE_KEY',
      message: 'Each target key may only appear once.'
    };
  }

  const outOfRange = dto.targets.find(
    (target) => target.percentage < 0 || target.percentage > 1
  );

  if (outOfRange) {
    return {
      code: 'RISK_TARGET_INVALID_SUM',
      message: `percentage for "${outOfRange.key}" must be between 0 and 1 (got ${outOfRange.percentage}).`
    };
  }

  const sum = dto.targets.reduce(
    (total, target) => total + target.percentage,
    0
  );

  if (Math.abs(sum - 1) > SUM_TOLERANCE) {
    return {
      code: 'RISK_TARGET_INVALID_SUM',
      message: `Target percentages must add up to 100%. They currently add up to ${Math.round(sum * 1000) / 10}%.`
    };
  }

  if (dto.groupBy === 'assetClass') {
    const invalidKey = keys.find(
      (key) => !VALID_ASSET_CLASS_KEYS.includes(key as AssetClass | 'CASH')
    );

    if (invalidKey) {
      return {
        code: 'RISK_TARGET_INVALID_KEY',
        message: `"${invalidKey}" is not a valid key for groupBy "assetClass".`
      };
    }
  }

  return null;
}

export function toEmptyTargetAllocationResponse(): TargetAllocationResponse {
  return {
    buckets: [],
    groupBy: null,
    isSet: false,
    targets: [],
    thresholds: null
  };
}

export function toTargetAllocationResponse({
  baseCurrency,
  cashBalance,
  exchangeRateDataService,
  holdings,
  targetAllocation,
  thresholdEngineService
}: {
  baseCurrency: string;
  cashBalance: number;
  exchangeRateDataService: ExchangeRateDataService;
  holdings: PortfolioPosition[];
  targetAllocation?: TargetAllocationSettings;
  thresholdEngineService: ThresholdEngineService;
}): TargetAllocationResponse {
  if (!targetAllocation?.isActive) {
    return toEmptyTargetAllocationResponse();
  }

  const groupBy = targetAllocation.groupBy ?? 'assetClass';
  const rule = new TargetDeviation(exchangeRateDataService, holdings);
  const { buckets } = rule.evaluate({
    baseCurrency,
    cashBalance,
    groupBy,
    isActive: true,
    locale: 'en',
    targets: targetAllocation.targets ?? [],
    thresholdMax: 0.05
  });

  const mappedBuckets: TargetAllocationBucket[] = (buckets ?? [])
    .map((bucket): TargetAllocationBucket => {
      const severity = thresholdEngineService.calculateSeverity({
        actual: Math.abs(bucket.deviation),
        ruleKey: 'TargetAllocationDeviation',
        subject: { type: 'bucket', value: bucket.key }
      });

      return {
        severity,
        actual: bucket.actual,
        deviation: bucket.deviation,
        key: bucket.key,
        target: bucket.target
      };
    })
    .sort((left, right) => right.actual - left.actual);

  const definition = getThresholdDefault('TargetAllocationDeviation');

  return {
    groupBy,
    buckets: mappedBuckets,
    isSet: true,
    targets: targetAllocation.targets ?? [],
    thresholds: definition ? toRiskThresholds(definition.defaults) : null
  };
}
