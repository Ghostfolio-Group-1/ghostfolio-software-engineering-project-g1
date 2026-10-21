import { PortfolioPosition } from '@ghostfolio/common/interfaces';

import { HealthScoreCalculatorService } from './health-score-calculator.service';
import { WeightedRuleResult } from './interfaces/health-score.interface';
import { RiskWarning } from './interfaces/risk-warning.interface';
import { WhatIfRequest } from './interfaces/what-if.interface';
import { WhatIfService } from './what-if.service';

function holding({
  currency = 'USD',
  dataSource = 'YAHOO',
  symbol,
  value
}: {
  currency?: string;
  dataSource?: string;
  symbol: string;
  value: number;
}): PortfolioPosition {
  return {
    assetProfile: { assetSubClass: 'STOCK', currency, dataSource, symbol },
    quantity: value,
    marketPrice: 1
  } as unknown as PortfolioPosition;
}

function ruleResult(
  overrides: Partial<WeightedRuleResult> = {}
): WeightedRuleResult {
  return {
    categoryKey: 'concentration',
    categoryName: 'Concentration',
    categoryWeight: 1,
    isActive: true,
    key: 'SingleStockConcentration',
    message: '',
    name: 'Single Stock Concentration',
    passed: true,
    weight: 1,
    ...overrides
  };
}

function warning(overrides: Partial<RiskWarning>): RiskWarning {
  return {
    actual: 0,
    message: '',
    ruleKey: 'SingleStockConcentration',
    severity: 'RED',
    subject: { type: 'stock', value: 'AAPL' },
    threshold: 0.25,
    ...overrides
  };
}

const exchangeRateDataServiceMock = {
  toCurrency: (value: number) => value
} as any;

describe('WhatIfService', () => {
  const healthScoreCalculatorService = new HealthScoreCalculatorService();
  const service = new WhatIfService(
    exchangeRateDataServiceMock,
    healthScoreCalculatorService
  );

  const baseRequest = (
    overrides: Partial<WhatIfRequest> = {}
  ): WhatIfRequest => ({
    baseCurrency: 'USD',
    holdings: [
      holding({ symbol: 'AAPL', value: 30000 }),
      holding({ symbol: 'MSFT', value: 60000 })
    ],
    ruleResultsAfter: [ruleResult({ passed: true })],
    ruleResultsBefore: [ruleResult({ passed: false })],
    scenario: { dataSource: 'YAHOO', dropPercentage: 0.4, symbol: 'AAPL' },
    warningsAfter: [],
    warningsBefore: [],
    ...overrides
  });

  it('matches the worked example: a 40% AAPL drop shrinks the holding and the portfolio, and re-ranks the warnings', () => {
    const result = service.calculateWhatIf(
      baseRequest({
        warningsBefore: [
          warning({
            actual: 0.3333,
            severity: 'RED',
            subject: { type: 'stock', value: 'AAPL' },
            threshold: 0.25
          }),
          warning({
            actual: 0.1923,
            severity: 'YELLOW',
            subject: { type: 'stock', value: 'MSFT' },
            threshold: 0.1
          })
        ],
        warningsAfter: [
          warning({
            actual: 0.2308,
            severity: 'YELLOW',
            subject: { type: 'stock', value: 'AAPL' },
            threshold: 0.1
          }),
          warning({
            actual: 0.2564,
            severity: 'RED',
            subject: { type: 'stock', value: 'MSFT' },
            threshold: 0.25
          })
        ]
      })
    );

    expect(result.holding.valueBefore).toEqual({
      amount: 30000,
      currency: 'USD'
    });
    expect(result.holding.valueAfter).toEqual({
      amount: 18000,
      currency: 'USD'
    });
    expect(result.holding.allocationBefore).toBeCloseTo(0.3333, 4);
    expect(result.holding.allocationAfter).toBeCloseTo(0.2308, 4);

    expect(result.portfolio.valueBefore).toEqual({
      amount: 90000,
      currency: 'USD'
    });
    expect(result.portfolio.valueAfter).toEqual({
      amount: 78000,
      currency: 'USD'
    });
    expect(result.portfolio.change).toEqual({
      amount: -12000,
      currency: 'USD'
    });
    expect(result.portfolio.changePercentage).toBeCloseTo(-0.1333, 4);

    // The rule stays RED overall (MSFT takes over from AAPL), so it is
    // reported as a rule change even though the severity label is the same -
    // the worst actual value changed.
    expect(result.ruleChanges).toEqual([
      {
        actualAfter: 0.2564,
        actualBefore: 0.3333,
        ruleKey: 'SingleStockConcentration',
        severityAfter: 'RED',
        severityBefore: 'RED'
      }
    ]);

    // Both warnings already existed (as RED/YELLOW) on both sides, so they
    // moved, not appeared/disappeared.
    expect(result.newWarnings).toEqual([]);
    expect(result.resolvedWarnings).toEqual([]);
    expect(result.changedWarnings.map((w) => w.subject.value).sort()).toEqual([
      'AAPL',
      'MSFT'
    ]);
  });

  it('recomputes the health score from the supplied before/after rule results', () => {
    const result = service.calculateWhatIf(baseRequest());

    expect(result.score).toEqual({ after: 100, before: 0, change: 100 });
    expect(result.categories).toEqual([
      { key: 'concentration', scoreAfter: 100, scoreBefore: 0 }
    ]);
  });

  it('reports a newly-appearing warning that had no match before', () => {
    const result = service.calculateWhatIf(
      baseRequest({
        warningsAfter: [
          warning({
            subject: { type: 'stock', value: 'MSFT' },
            severity: 'YELLOW'
          })
        ]
      })
    );

    expect(result.newWarnings).toHaveLength(1);
    expect(result.newWarnings[0].subject.value).toBe('MSFT');
    expect(result.resolvedWarnings).toEqual([]);
  });

  it('reports a warning that disappears entirely as resolved, not changed', () => {
    const result = service.calculateWhatIf(
      baseRequest({
        warningsBefore: [
          warning({
            subject: { type: 'stock', value: 'AAPL' },
            severity: 'RED'
          })
        ]
      })
    );

    expect(result.resolvedWarnings).toHaveLength(1);
    expect(result.resolvedWarnings[0].subject.value).toBe('AAPL');
    expect(result.newWarnings).toEqual([]);
    expect(result.changedWarnings).toEqual([]);
  });

  it('passes skippedRuleKeys through unchanged, defaulting to an empty array', () => {
    expect(service.calculateWhatIf(baseRequest()).skippedRules).toEqual([]);
    expect(
      service.calculateWhatIf(
        baseRequest({ skippedRuleKeys: ['PortfolioVolatility'] })
      ).skippedRules
    ).toEqual(['PortfolioVolatility']);
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
});
