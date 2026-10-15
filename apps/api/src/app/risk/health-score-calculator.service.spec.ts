import { HealthScoreCalculatorService } from './health-score-calculator.service';
import { WeightedRuleResult } from './interfaces/health-score.interface';

function result(overrides: Partial<WeightedRuleResult>): WeightedRuleResult {
  return {
    categoryKey: 'fees',
    categoryName: 'Fees',
    categoryWeight: 15,
    isActive: true,
    key: 'FeeRatioTotalInvestmentVolume',
    message: '',
    name: 'Fee Ratio',
    passed: true,
    weight: 15,
    ...overrides
  };
}

describe('HealthScoreCalculatorService', () => {
  const service = new HealthScoreCalculatorService();

  it('returns 100 when every active rule passes', () => {
    const score = service.calculate([
      result({ passed: true, weight: 15 }),
      result({
        passed: true,
        weight: 10,
        categoryKey: 'liquidity',
        categoryWeight: 10
      })
    ]);

    expect(score.score).toBe(100);
    expect(score.grade).toBe('A');
    expect(score.severity).toBe('GREEN');
  });

  it('matches a hand-worked mixed pass/fail example', () => {
    // 15 of 25 active weight passed -> 60%
    const score = service.calculate([
      result({ passed: true, weight: 15 }),
      result({
        categoryKey: 'liquidity',
        categoryWeight: 10,
        passed: false,
        weight: 10
      })
    ]);

    expect(score.score).toBe(60);
    expect(score.grade).toBe('D');
    expect(score.severity).toBe('YELLOW');
  });

  it('returns null with NO_ACTIVE_RULES when every rule is inactive', () => {
    const score = service.calculate([result({ isActive: false })]);

    expect(score.score).toBeNull();
    expect(score.grade).toBeNull();
    expect(score.severity).toBe('NO_DATA');
    expect(score.unavailableReason).toBe('NO_ACTIVE_RULES');
  });

  it('excludes inactive rules from both sides of the fraction (renormalizes)', () => {
    // Active: one 15-weight pass, one 10-weight fail -> 15/25 = 60%.
    // The inactive 50-weight rule must not appear in the denominator.
    const score = service.calculate([
      result({ passed: true, weight: 15 }),
      result({
        categoryKey: 'liquidity',
        categoryWeight: 10,
        passed: false,
        weight: 10
      }),
      result({ isActive: false, weight: 50 })
    ]);

    expect(score.activeWeight).toBe(25);
    expect(score.score).toBe(60);
  });

  it('computes an independent sub-score per category', () => {
    const score = service.calculate([
      result({
        categoryKey: 'fees',
        categoryWeight: 15,
        passed: true,
        weight: 15
      }),
      result({
        categoryKey: 'currency',
        categoryName: 'Currency',
        categoryWeight: 15,
        key: 'CurrencyA',
        passed: true,
        weight: 7.5
      }),
      result({
        categoryKey: 'currency',
        categoryName: 'Currency',
        categoryWeight: 15,
        key: 'CurrencyB',
        passed: false,
        weight: 7.5
      })
    ]);

    const currencyCategory = score.categories.find((c) => c.key === 'currency');
    expect(currencyCategory.score).toBe(50);

    const feesCategory = score.categories.find((c) => c.key === 'fees');
    expect(feesCategory.score).toBe(100);
  });
});
