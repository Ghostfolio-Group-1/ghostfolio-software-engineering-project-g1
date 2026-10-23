import { PortfolioPosition } from '@ghostfolio/common/interfaces';

import { ExposureBucket } from './exposure-calculator.service';
import {
  RiskConcentrationBucket,
  RiskConcentrationGroup,
  RiskConcentrationResponse
} from './interfaces/risk-concentration-response.interface';
import { RiskSummary } from './interfaces/risk-summary.interface';

export const DEFAULT_CONCENTRATION_LIMIT = 5;
export const MAX_CONCENTRATION_LIMIT = 20;

export function parseConcentrationLimit(value?: string): number | null {
  if (value === undefined) {
    return DEFAULT_CONCENTRATION_LIMIT;
  }

  const limit = Number(value);

  return Number.isInteger(limit) &&
    limit >= 1 &&
    limit <= MAX_CONCENTRATION_LIMIT
    ? limit
    : null;
}

export function toRiskConcentrationResponse({
  holdings,
  limit,
  summary
}: {
  holdings: PortfolioPosition[];
  limit: number;
  summary: RiskSummary;
}): RiskConcentrationResponse {
  const stockNames = new Map<string, string>();

  for (const { assetProfile } of holdings) {
    if (assetProfile?.symbol) {
      stockNames.set(
        assetProfile.symbol,
        assetProfile.name ? assetProfile.name : assetProfile.symbol
      );
    }
  }

  return {
    country: toGroup(summary.concentration.country, limit),
    currency: toGroup(summary.concentration.currency, limit),
    sector: toGroup(summary.concentration.sector, limit),
    stock: toGroup(summary.concentration.stock, limit, stockNames)
  };
}

// Severity and thresholds come from the threshold engine (planned Oct 16-19).
// Until then every bucket is NO_DATA and thresholds is null.
function toGroup(
  buckets: ExposureBucket[],
  limit: number,
  names?: Map<string, string>
): RiskConcentrationGroup {
  return {
    buckets: [...buckets]
      .sort((left, right) => right.percentage - left.percentage)
      .slice(0, limit)
      .map(({ key, percentage }): RiskConcentrationBucket => {
        return {
          percentage,
          name: names?.get(key) ?? key,
          severity: 'NO_DATA',
          value: key
        };
      }),
    thresholds: null
  };
}
