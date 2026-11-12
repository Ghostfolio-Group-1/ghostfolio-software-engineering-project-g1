import { PortfolioPosition } from '@ghostfolio/common/interfaces';

import { RiskSummary } from './interfaces/risk-summary.interface';
import { toRiskConcentrationResponse } from './risk-concentration.mapper';
import { ThresholdEngineService } from './threshold-engine.service';

const summaryFixture: RiskSummary = {
  concentration: {
    country: [{ key: 'US', percentage: 0.48, value: 4320 }],
    currency: [{ key: 'USD', percentage: 0.58, value: 5220 }],
    sector: [{ key: 'Technology', percentage: 0.41, value: 3690 }],
    stock: [{ key: 'AAPL', percentage: 0.9, value: 8100 }]
  },
  exposure: {
    assetClass: [{ key: 'EQUITY', percentage: 1, value: 9000 }],
    currency: [{ key: 'USD', percentage: 1, value: 9000 }]
  },
  totalValue: 9000
};

describe('toRiskConcentrationResponse (#240, #281 review feedback)', () => {
  const thresholdEngineService = new ThresholdEngineService();

  const load = (
    xRayRules?: Parameters<typeof toRiskConcentrationResponse>[0]['xRayRules']
  ) =>
    toRiskConcentrationResponse({
      holdings: [] as PortfolioPosition[],
      limit: 5,
      summary: summaryFixture,
      thresholdEngineService,
      xRayRules
    });

  it('computes severity from the rule default thresholds when no override is set', () => {
    const { stock } = load();

    // SingleStockConcentration defaults: thresholdMax 0.1, redThresholdMax
    // 0.25 - 90% blows through both.
    expect(stock.buckets[0]).toMatchObject({
      percentage: 0.9,
      severity: 'RED'
    });
    expect(stock.thresholds).toEqual({ max: 0.1, redMax: 0.25 });
  });

  it('computes severity from the user override, and returns those same effective thresholds', () => {
    const { stock } = load({
      SingleStockConcentration: {
        isActive: true,
        redThresholdMax: 0.95,
        thresholdMax: 0.92
      }
    });

    // 90% is now under both the raised thresholds, so GREEN instead of RED.
    expect(stock.buckets[0]).toMatchObject({
      percentage: 0.9,
      severity: 'GREEN'
    });
    // The response's thresholds must match what severity was actually
    // computed against, not the rule's unrelated defaults (#281 review).
    expect(stock.thresholds).toEqual({ max: 0.92, redMax: 0.95 });
  });

  it('reports NO_DATA when the user has disabled the rule, regardless of the actual percentage', () => {
    const { stock } = load({
      SingleStockConcentration: { isActive: false }
    });

    expect(stock.buckets[0]).toMatchObject({
      percentage: 0.9,
      severity: 'NO_DATA'
    });
  });

  it('falls back to the default thresholds for a group with no override', () => {
    const { country } = load({
      SingleStockConcentration: { isActive: false }
    });

    // CountryConcentration defaults: thresholdMax 0.5, redThresholdMax 0.75
    // - 48% is under both, GREEN.
    expect(country.buckets[0]).toMatchObject({
      percentage: 0.48,
      severity: 'GREEN'
    });
    expect(country.thresholds).toEqual({ max: 0.5, redMax: 0.75 });
  });
});
