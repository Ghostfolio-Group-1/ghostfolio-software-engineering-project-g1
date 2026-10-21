import { PortfolioPosition } from '@ghostfolio/common/interfaces';

import { ExposureCalculatorService } from './exposure-calculator.service';
import { ExposureService } from './exposure.service';
import { HealthScoreCalculatorService } from './health-score-calculator.service';
import { WhatIfRequest } from './interfaces/what-if.interface';
import { RiskEvaluationService } from './risk-evaluation.service';
import { ThresholdEngineService } from './threshold-engine.service';
import { WhatIfService } from './what-if.service';

function holding({
  dataSource = 'YAHOO',
  symbol,
  value
}: {
  dataSource?: string;
  symbol: string;
  value: number;
}): PortfolioPosition {
  return {
    assetProfile: {
      assetSubClass: 'STOCK',
      currency: 'USD',
      dataSource,
      symbol
    },
    quantity: value,
    marketPrice: 1
  } as unknown as PortfolioPosition;
}

const exchangeRateDataServiceMock = {
  toCurrency: (value: number) => value
} as any;

describe('WhatIfService', () => {
  const exposureCalculatorService = new ExposureCalculatorService(
    exchangeRateDataServiceMock
  );
  const exposureService = new ExposureService(
    exchangeRateDataServiceMock,
    exposureCalculatorService
  );
  const thresholdEngineService = new ThresholdEngineService();
  const riskEvaluationService = new RiskEvaluationService(
    exchangeRateDataServiceMock,
    exposureService,
    thresholdEngineService
  );
  const healthScoreCalculatorService = new HealthScoreCalculatorService();
  const service = new WhatIfService(
    exchangeRateDataServiceMock,
    healthScoreCalculatorService,
    riskEvaluationService,
    thresholdEngineService
  );

  const baseRequest = (
    overrides: Partial<WhatIfRequest> = {}
  ): WhatIfRequest => ({
    baseCurrency: 'USD',
    cashBalance: 10000,
    holdings: [
      holding({ symbol: 'AAPL', value: 30000 }),
      holding({ symbol: 'MSFT', value: 60000 })
    ],
    scenario: { dataSource: 'YAHOO', dropPercentage: 0.4, symbol: 'AAPL' },
    ...overrides
  });

  it('matches the worked example: portfolio value includes cash, holding allocation does not', () => {
    const result = service.calculateWhatIf(baseRequest());

    // Holdings: AAPL 30,000 + MSFT 60,000 = 90,000. Cash 10,000.
    // Portfolio (holdings + cash): 100,000 before.
    // AAPL drops 40%: 30,000 -> 18,000, so holdings go to 78,000 and
    // portfolio (cash unchanged) goes to 88,000 - exactly Section 6.11's
    // worked numbers.
    expect(result.holding.valueBefore).toEqual({
      amount: 30000,
      currency: 'USD'
    });
    expect(result.holding.valueAfter).toEqual({
      amount: 18000,
      currency: 'USD'
    });
    expect(result.holding.allocationBefore).toBeCloseTo(0.3333, 4); // 30000/90000
    expect(result.holding.allocationAfter).toBeCloseTo(0.2308, 4); // 18000/78000

    expect(result.portfolio.valueBefore).toEqual({
      amount: 100000,
      currency: 'USD'
    });
    expect(result.portfolio.valueAfter).toEqual({
      amount: 88000,
      currency: 'USD'
    });
    expect(result.portfolio.change).toEqual({
      amount: -12000,
      currency: 'USD'
    });
    expect(result.portfolio.changePercentage).toBeCloseTo(-0.12, 4);
  });

  it('recomputes the health score and warnings from the real rule pipeline on the shocked copy, not caller-supplied values', () => {
    const result = service.calculateWhatIf(baseRequest());

    // Before the shock: MSFT is the worst single-stock holding at
    // 60000/90000 = 0.6667 (RED, > 0.25 ceiling). After a 40% AAPL drop,
    // MSFT is 60000/78000 = 0.7692 - still the worst and still RED, but the
    // actual percentage moved, so it is a genuine rule change, not a
    // placeholder.
    const singleStockChange = result.ruleChanges.find(
      (change) => change.ruleKey === 'SingleStockConcentration'
    );

    expect(singleStockChange.severityBefore).toBe('RED');
    expect(singleStockChange.severityAfter).toBe('RED');
    expect(singleStockChange.actualBefore).toBeCloseTo(0.6667, 4);
    expect(singleStockChange.actualAfter).toBeCloseTo(0.7692, 4);

    expect(
      result.changedWarnings.some(
        (warning) => warning.ruleKey === 'SingleStockConcentration'
      )
    ).toBe(true);
  });

  it('rejects a dropPercentage of 0 or below', () => {
    expect(() =>
      service.calculateWhatIf(
        baseRequest({
          scenario: { dataSource: 'YAHOO', dropPercentage: 0, symbol: 'AAPL' }
        })
      )
    ).toThrow(/dropPercentage/);
  });

  it('rejects a dropPercentage above 1', () => {
    expect(() =>
      service.calculateWhatIf(
        baseRequest({
          scenario: { dataSource: 'YAHOO', dropPercentage: 1.5, symbol: 'AAPL' }
        })
      )
    ).toThrow(/dropPercentage/);
  });

  it('throws when the scenario symbol has no matching open holding', () => {
    expect(() =>
      service.calculateWhatIf(
        baseRequest({
          scenario: { dataSource: 'YAHOO', dropPercentage: 0.4, symbol: 'TSLA' }
        })
      )
    ).toThrow(/TSLA/);
  });

  it('does not mutate the real holdings array while building the shocked copy', () => {
    const request = baseRequest();
    const originalMarketPrice = request.holdings[0].marketPrice;

    service.calculateWhatIf(request);

    expect(request.holdings[0].marketPrice).toBe(originalMarketPrice);
  });

  it('passes RiskEvaluationService.skippedRuleKeys through as skippedRules', () => {
    const result = service.calculateWhatIf(baseRequest());

    expect(result.skippedRules).toEqual(['TargetAllocationDeviation']);
  });
});
