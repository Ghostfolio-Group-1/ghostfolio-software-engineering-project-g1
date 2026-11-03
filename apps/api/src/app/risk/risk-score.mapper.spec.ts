import Ajv from 'ajv';

import { riskScoreResponseSchema } from './contracts/risk-score.schema';
import { CategoryScore } from './interfaces/category-score.interface';
import { HealthScore } from './interfaces/health-score.interface';
import { RiskEvaluation } from './risk-evaluation.service';
import { getOverallSeverity, toRiskScoreResponse } from './risk-score.mapper';
import { ThresholdEngineInput } from './threshold-engine.service';
import { ThresholdEngineService } from './threshold-engine.service';

function category(overrides: Partial<CategoryScore>): CategoryScore {
  return {
    key: 'concentration',
    name: 'Concentration',
    rules: [],
    score: 100,
    weight: 1,
    ...overrides
  };
}

function healthScore(overrides: Partial<HealthScore>): HealthScore {
  return {
    activeWeight: 1,
    calculatedAt: new Date('2026-09-26T09:14:00Z'),
    categories: [],
    grade: 'A',
    score: 100,
    unavailableReason: null,
    ...overrides
  };
}

function evaluation(overrides: Partial<RiskEvaluation>): RiskEvaluation {
  return {
    cashBalance: 0,
    holdingsValue: 0,
    portfolioValue: 0,
    ruleResults: [],
    skippedRuleKeys: [],
    thresholdInputs: [],
    warningInputs: [],
    ...overrides
  };
}

describe('getOverallSeverity', () => {
  // Section 6.2: "severity uses the 80 / 60 bands from the Sep 22 doc."
  it.each([
    [100, 'GREEN'],
    [80, 'GREEN'],
    [79.9, 'YELLOW'],
    [60, 'YELLOW'],
    [59.9, 'RED'],
    [0, 'RED']
  ])('maps score %s to %s', (score, expected) => {
    expect(getOverallSeverity(score)).toBe(expected);
  });

  it('maps a null score (no active rules) to NO_DATA', () => {
    expect(getOverallSeverity(null)).toBe('NO_DATA');
  });
});

describe('toRiskScoreResponse', () => {
  const thresholdEngineService = new ThresholdEngineService();

  // Worked example from Section 6.2: AAPL is 33.3% of the portfolio, which
  // is above the 25% red limit for SingleStockConcentration
  // (defaults: max 0.1, redMax 0.25).
  it('matches the documented SingleStockConcentration worked example', () => {
    const thresholdInput: ThresholdEngineInput = {
      actual: 0.333,
      ruleKey: 'SingleStockConcentration',
      subject: { type: 'stock', value: 'AAPL' }
    };

    const response = toRiskScoreResponse({
      thresholdEngineService,
      evaluation: evaluation({ thresholdInputs: [thresholdInput] }),
      healthScore: healthScore({
        grade: 'C',
        score: 72,
        categories: [
          category({
            key: 'concentration',
            name: 'Concentration',
            score: 45,
            weight: 15,
            rules: [
              {
                actual: null,
                isActive: true,
                key: 'SingleStockConcentration',
                message: 'AAPL is above its limit.',
                name: 'Single stock concentration',
                passed: false,
                weight: 5
              }
            ]
          })
        ]
      })
    });

    const [concentration] = response.categories;
    const [rule] = concentration.rules;

    expect(rule.severity).toBe('RED');
    expect(rule.actual).toBe(0.333);
    expect(rule.thresholds).toEqual({ max: 0.1, redMax: 0.25 });
    expect(concentration.severity).toBe('RED');
    expect(response.score).toBe(72);
    expect(response.grade).toBe('C');
    expect(response.severity).toBe('YELLOW'); // 72 falls in the 60-79.9 band
  });

  it('sorts categories RED first, then YELLOW, then GREEN, then by weight', () => {
    const response = toRiskScoreResponse({
      thresholdEngineService,
      evaluation: evaluation({
        thresholdInputs: [
          {
            actual: 0.05,
            ruleKey: 'CashAllocation',
            subject: { type: 'bucket', value: 'cash' }
          },
          {
            actual: 0.6,
            ruleKey: 'SectorConcentration',
            subject: { type: 'sector', value: 'Technology' }
          },
          {
            actual: 0.18,
            ruleKey: 'PortfolioVolatility',
            subject: { type: 'portfolio', value: 'volatility' }
          }
        ]
      }),
      healthScore: healthScore({
        categories: [
          category({
            key: 'volatility',
            name: 'Volatility',
            weight: 5,
            rules: [
              {
                actual: null,
                isActive: true,
                key: 'PortfolioVolatility',
                message: '',
                name: 'Volatility estimate',
                passed: true,
                weight: 5
              }
            ]
          }),
          category({
            key: 'concentration',
            name: 'Concentration',
            weight: 20,
            rules: [
              {
                actual: null,
                isActive: true,
                key: 'SectorConcentration',
                message: '',
                name: 'Sector concentration',
                passed: false,
                weight: 20
              }
            ]
          }),
          category({
            key: 'cash',
            name: 'Cash Allocation',
            weight: 10,
            rules: [
              {
                actual: null,
                isActive: true,
                key: 'CashAllocation',
                message: '',
                name: 'Cash allocation',
                passed: false,
                weight: 10
              }
            ]
          })
        ]
      })
    });

    // SectorConcentration (0.6) is RED (> 0.5 redMax) -> concentration first.
    // CashAllocation (0.05) and PortfolioVolatility (0.18) are both GREEN
    // (within their bands), so they tie-break by category weight descending:
    // cash (10) before volatility (5).
    expect(response.categories.map((c) => c.severity)).toEqual([
      'RED',
      'GREEN',
      'GREEN'
    ]);
    expect(response.categories.map((c) => c.key)).toEqual([
      'concentration',
      'cash',
      'volatility'
    ]);
  });

  it('lists a category as excluded when every one of its rules is inactive', () => {
    const response = toRiskScoreResponse({
      thresholdEngineService,
      evaluation: evaluation({
        ruleResults: [
          {
            categoryKey: 'volatility',
            categoryName: 'Volatility',
            categoryWeight: 1,
            isActive: false,
            key: 'PortfolioVolatility',
            message: 'no data',
            name: 'Volatility estimate',
            passed: false,
            weight: 1
          }
        ]
      }),
      healthScore: healthScore({ categories: [] })
    });

    expect(response.excluded).toEqual([
      { key: 'volatility', reason: 'NO_ACTIVE_RULES' }
    ]);
  });

  it('maps a null score to severity NO_DATA and an unavailable reason', () => {
    const response = toRiskScoreResponse({
      thresholdEngineService,
      evaluation: evaluation({}),
      healthScore: healthScore({
        activeWeight: 0,
        grade: null,
        score: null,
        unavailableReason: 'NO_ACTIVE_RULES'
      })
    });

    expect(response.score).toBeNull();
    expect(response.grade).toBeNull();
    expect(response.severity).toBe('NO_DATA');
    expect(response.unavailableReason).toBe('NO_ACTIVE_RULES');
  });

  it('matches the contract schema', () => {
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(riskScoreResponseSchema);

    const response = {
      error: null,
      meta: {},
      data: toRiskScoreResponse({
        thresholdEngineService,
        evaluation: evaluation({
          thresholdInputs: [
            {
              actual: 0.333,
              ruleKey: 'SingleStockConcentration',
              subject: { type: 'stock', value: 'AAPL' }
            }
          ]
        }),
        healthScore: healthScore({
          score: 72,
          grade: 'C',
          categories: [
            category({
              rules: [
                {
                  actual: null,
                  isActive: true,
                  key: 'SingleStockConcentration',
                  message: 'AAPL is above its limit.',
                  name: 'Single stock concentration',
                  passed: false,
                  weight: 5
                }
              ]
            })
          ]
        })
      })
    };

    validate(response);

    expect(validate.errors ?? []).toEqual([]);
  });
});
