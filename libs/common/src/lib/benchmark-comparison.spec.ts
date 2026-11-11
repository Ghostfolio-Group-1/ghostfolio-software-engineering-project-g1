import { toBenchmarkComparisonResponse } from './benchmark-comparison';

describe('toBenchmarkComparisonResponse', () => {
  it('indexes portfolio and benchmark to 100 at the shared start date', () => {
    expect(
      toBenchmarkComparisonResponse({
        benchmarkSymbol: 'SPY',
        endDate: '2026-03-01',
        startDate: '2026-01-01',
        portfolioHistory: [
          { date: '2026-01-01', netWorth: 1000 },
          { date: '2026-02-01', netWorth: 1100 },
          { date: '2026-03-01', netWorth: 1200 }
        ],
        benchmarkHistory: [
          { date: '2026-01-01', marketPrice: 50 },
          { date: '2026-02-01', marketPrice: 55 },
          { date: '2026-03-01', marketPrice: 60 }
        ]
      })
    ).toEqual({
      benchmarkAvailableFrom: '2026-01-01',
      benchmarkSymbol: 'SPY',
      endDate: '2026-03-01',
      granularity: 'daily',
      startDate: '2026-01-01',
      points: [
        {
          date: '2026-01-01',
          portfolioReturn: 100,
          benchmarkReturn: 100
        },
        {
          date: '2026-02-01',
          portfolioReturn: (1100 / 1000) * 100,
          benchmarkReturn: (55 / 50) * 100
        },
        {
          date: '2026-03-01',
          portfolioReturn: (1200 / 1000) * 100,
          benchmarkReturn: (60 / 50) * 100
        }
      ]
    });
  });

  it('clamps the start date when the benchmark history begins later', () => {
    const result = toBenchmarkComparisonResponse({
      benchmarkSymbol: 'SPY',
      endDate: '2026-03-01',
      startDate: '2026-01-01',
      portfolioHistory: [
        { date: '2026-01-01', netWorth: 1000 },
        { date: '2026-02-01', netWorth: 1100 },
        { date: '2026-03-01', netWorth: 1210 }
      ],
      benchmarkHistory: [
        { date: '2026-02-01', marketPrice: 50 },
        { date: '2026-03-01', marketPrice: 55 }
      ]
    });

    expect(result.benchmarkAvailableFrom).toBe('2026-02-01');
    expect(result.startDate).toBe('2026-02-01');
    expect(result.points).toEqual([
      {
        date: '2026-02-01',
        portfolioReturn: 100,
        benchmarkReturn: 100
      },
      {
        date: '2026-03-01',
        portfolioReturn: (1210 / 1100) * 100,
        benchmarkReturn: (55 / 50) * 100
      }
    ]);
  });

  it('carries the last benchmark price forward across a gap', () => {
    const result = toBenchmarkComparisonResponse({
      benchmarkSymbol: 'SPY',
      endDate: '2026-03-01',
      startDate: '2026-01-01',
      portfolioHistory: [
        { date: '2026-01-01', netWorth: 1000 },
        { date: '2026-02-01', netWorth: 1050 },
        { date: '2026-03-01', netWorth: 1100 }
      ],
      benchmarkHistory: [
        { date: '2026-01-01', marketPrice: 100 },
        { date: '2026-03-01', marketPrice: 120 }
      ]
    });

    expect(result.points).toEqual([
      {
        date: '2026-01-01',
        portfolioReturn: 100,
        benchmarkReturn: 100
      },
      {
        date: '2026-02-01',
        portfolioReturn: (1050 / 1000) * 100,
        benchmarkReturn: 100
      },
      {
        date: '2026-03-01',
        portfolioReturn: (1100 / 1000) * 100,
        benchmarkReturn: (120 / 100) * 100
      }
    ]);
  });
});
