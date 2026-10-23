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
    const score = service.calculateHealthScore([
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
  });

  it('matches a hand-worked mixed pass/fail example', () => {
    // 15 of 25 active weight passed -> 60%
    const score = service.calculateHealthScore([
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
  });

  it('returns null with NO_ACTIVE_RULES when every rule is inactive', () => {
    const score = service.calculateHealthScore([result({ isActive: false })]);

    expect(score.score).toBeNull();
    expect(score.grade).toBeNull();
    expect(score.unavailableReason).toBe('NO_ACTIVE_RULES');
  });

  it('excludes inactive rules from both sides of the fraction (renormalizes)', () => {
    // Active: one 15-weight pass, one 10-weight fail -> 15/25 = 60%.
    // The inactive 50-weight rule must not appear in the denominator.
    const score = service.calculateHealthScore([
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

  it('excludes a whole category when every rule in it is inactive', () => {
    // Fees: one active 15-weight pass. Liquidity: its only rule is
    // inactive, so the category must not appear in categories at all -
    // not as a 0-weight or NO_DATA entry - and must not affect the
    // overall score or active weight.
    const score = service.calculateHealthScore([
      result({ passed: true, weight: 15 }),
      result({
        categoryKey: 'liquidity',
        categoryName: 'Liquidity',
        categoryWeight: 10,
        isActive: false,
        key: 'CashAllocation',
        weight: 10
      })
    ]);

    expect(score.categories.map((category) => category.key)).toEqual(['fees']);
    expect(
      score.categories.find((category) => category.key === 'liquidity')
    ).toBeUndefined();
    expect(score.activeWeight).toBe(15);
    expect(score.score).toBe(100);
  });

  it('computes an independent sub-score per category', () => {
    const score = service.calculateHealthScore([
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
