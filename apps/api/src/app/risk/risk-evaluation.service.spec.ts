import { PortfolioPosition } from '@ghostfolio/common/interfaces';

import { ExposureCalculatorService } from './exposure-calculator.service';
import { ExposureService } from './exposure.service';
import { HealthScoreCalculatorService } from './health-score-calculator.service';
import { RiskEvaluationService } from './risk-evaluation.service';
import { ThresholdEngineService } from './threshold-engine.service';

function holding({
  currency = 'USD',
  symbol,
  value
}: {
  currency?: string;
  symbol: string;
  value: number;
}): PortfolioPosition {
  return {
    assetProfile: { assetSubClass: 'STOCK', currency, symbol },
    quantity: value,
    marketPrice: 1
  } as unknown as PortfolioPosition;
}

const exchangeRateDataServiceMock = {
  toCurrency: (value: number) => value
} as any;

describe('RiskEvaluationService', () => {
  const exposureCalculatorService = new ExposureCalculatorService(
    exchangeRateDataServiceMock
  );
  const exposureService = new ExposureService(
    exchangeRateDataServiceMock,
    exposureCalculatorService
  );
  const thresholdEngineService = new ThresholdEngineService();
  const service = new RiskEvaluationService(
    exchangeRateDataServiceMock,
    exposureService,
    thresholdEngineService
  );

  const holdings = [
    holding({ symbol: 'AAPL', value: 30000 }),
    holding({ symbol: 'MSFT', value: 60000 })
  ];

  it('flags single-stock concentration using the worst holding and includes cash in portfolio value', () => {
    const evaluation = service.evaluate({
      baseCurrency: 'USD',
      cashBalance: 10000,
      holdings
    });

    expect(evaluation.holdingsValue).toBe(90000);
    expect(evaluation.portfolioValue).toBe(100000);

    const singleStock = evaluation.thresholdInputs.find(
      (input) => input.ruleKey === 'SingleStockConcentration'
    );

    // MSFT is 60000/90000 = 0.6667, the worst of the two holdings.
    expect(singleStock.actual).toBeCloseTo(0.6667, 4);
    expect(singleStock.subject).toEqual({ type: 'stock', value: 'MSFT' });

    const ruleResult = evaluation.ruleResults.find(
      (result) => result.key === 'SingleStockConcentration'
    );
    expect(ruleResult.passed).toBe(false);
    expect(ruleResult.categoryKey).toBe('concentration');
  });

  it('warningInputs carries every holding for a rule, not just the worst one thresholdInputs keeps', () => {
    const evaluation = service.evaluate({
      baseCurrency: 'USD',
      cashBalance: 10000,
      holdings
    });

    const singleStockWarningInputs = evaluation.warningInputs.filter(
      (input) => input.ruleKey === 'SingleStockConcentration'
    );

    expect(
      singleStockWarningInputs.map((input) => input.subject.value).sort()
    ).toEqual(['AAPL', 'MSFT']);

    const aapl = singleStockWarningInputs.find(
      (input) => input.subject.value === 'AAPL'
    );
    expect(aapl.actual).toBeCloseTo(0.3333, 4); // 30000/90000

    // thresholdInputs still only keeps the single worst subject per rule.
    expect(
      evaluation.thresholdInputs.filter(
        (input) => input.ruleKey === 'SingleStockConcentration'
      )
    ).toHaveLength(1);
  });

  it('computes CashAllocation against total portfolio value (holdings + cash)', () => {
    const evaluation = service.evaluate({
      baseCurrency: 'USD',
      cashBalance: 10000,
      holdings
    });

    const cash = evaluation.thresholdInputs.find(
      (input) => input.ruleKey === 'CashAllocation'
    );

    expect(cash.actual).toBeCloseTo(0.1, 4); // 10000 / 100000
  });

  it('reports PortfolioVolatility as NO_DATA when no volatility input is supplied', () => {
    const evaluation = service.evaluate({
      baseCurrency: 'USD',
      cashBalance: 0,
      holdings
    });

    const volatility = evaluation.thresholdInputs.find(
      (input) => input.ruleKey === 'PortfolioVolatility'
    );
    const volatilityResult = evaluation.ruleResults.find(
      (result) => result.key === 'PortfolioVolatility'
    );

    expect(volatility.actual).toBeNull();
    // NO_DATA does not count toward the score at all (excluded, not a free
    // pass) - it is marked inactive and reported as skipped.
    expect(volatilityResult.isActive).toBe(false);
    expect(evaluation.skippedRuleKeys).toContain('PortfolioVolatility');
  });

  it('does not let a NO_DATA PortfolioVolatility inflate the health score', () => {
    const evaluation = service.evaluate({
      baseCurrency: 'USD',
      cashBalance: 0,
      holdings
      // No volatility input -> PortfolioVolatility is NO_DATA.
    });

    const withoutVolatility = evaluation.ruleResults.filter(
      (result) => result.key !== 'PortfolioVolatility'
    );

    // If NO_DATA were counted as a pass, scoring the full ruleResults array
    // (including the inactive PortfolioVolatility entry) would differ from
    // scoring the exact same results with that entry removed entirely -
    // whichever gives PortfolioVolatility a free pass would score higher.
    // They must be identical: isActive: false means excluded either way.
    const healthScoreCalculatorService = new HealthScoreCalculatorService();
    const withVolatilityEntry =
      healthScoreCalculatorService.calculateHealthScore(evaluation.ruleResults);
    const withoutVolatilityEntry =
      healthScoreCalculatorService.calculateHealthScore(withoutVolatility);

    expect(withVolatilityEntry.score).toBe(withoutVolatilityEntry.score);
    expect(withVolatilityEntry.activeWeight).toBe(
      withoutVolatilityEntry.activeWeight
    );
  });

  it('uses the supplied volatility figure when there is enough history', () => {
    const evaluation = service.evaluate({
      baseCurrency: 'USD',
      cashBalance: 0,
      holdings,
      volatility: { annualizedVolatility: 0.4, historyDays: 90 }
    });

    const volatility = evaluation.thresholdInputs.find(
      (input) => input.ruleKey === 'PortfolioVolatility'
    );
    expect(volatility.actual).toBe(0.4);
  });

  it('skips TargetAllocationDeviation and reports it in skippedRuleKeys when no target is configured', () => {
    const evaluation = service.evaluate({
      baseCurrency: 'USD',
      cashBalance: 0,
      holdings
    });

    // PortfolioVolatility is also skipped here since no volatility input was
    // supplied (NO_DATA) - see the dedicated NO_DATA tests above.
    expect(evaluation.skippedRuleKeys.slice().sort()).toEqual([
      'PortfolioVolatility',
      'TargetAllocationDeviation'
    ]);
    expect(
      evaluation.thresholdInputs.some(
        (input) => input.ruleKey === 'TargetAllocationDeviation'
      )
    ).toBe(false);
  });

  it('evaluates TargetAllocationDeviation against the worst bucket when a target is configured', () => {
    const evaluation = service.evaluate({
      baseCurrency: 'USD',
      cashBalance: 0,
      holdings,
      targetAllocation: {
        groupBy: 'symbol',
        isActive: true,
        targets: [
          { key: 'AAPL', percentage: 0.5 },
          { key: 'MSFT', percentage: 0.5 }
        ]
      }
    });

    // PortfolioVolatility is still skipped (no volatility input supplied),
    // but TargetAllocationDeviation is not, since a target is configured.
    expect(evaluation.skippedRuleKeys).toEqual(['PortfolioVolatility']);

    const target = evaluation.thresholdInputs.find(
      (input) => input.ruleKey === 'TargetAllocationDeviation'
    );
    // AAPL: actual 0.3333 vs target 0.5 -> |deviation| 0.1667
    // MSFT: actual 0.6667 vs target 0.5 -> |deviation| 0.1667 (tie; either
    // can be "worst", so just assert the magnitude).
    expect(target.actual).toBeCloseTo(0.1667, 4);
  });

  it('calculateWarnings() returns the same warnings ThresholdEngineService would produce from the evaluation', () => {
    const evaluation = service.evaluate({
      baseCurrency: 'USD',
      cashBalance: 10000,
      holdings
    });

    const warnings = service.calculateWarnings(evaluation);

    expect(
      warnings.some((warning) => warning.ruleKey === 'SingleStockConcentration')
    ).toBe(true);
  });
});
