import { calculateBenchmarkTrend } from './helper';
import { MarketData } from './interfaces/market-data.interface';

function prices(values: number[]): MarketData[] {
  return values.map((marketPrice, index) => {
    return {
      date: `2026-01-${String(index + 1).padStart(2, '0')}`,
      marketPrice
    };
  });
}

describe('calculateBenchmarkTrend', () => {
  it('returns UNKNOWN when there are fewer than two full windows', () => {
    expect(
      calculateBenchmarkTrend({
        days: 2,
        historicalData: prices([12, 10, 8])
      })
    ).toBe('UNKNOWN');
  });

  it('returns UP when the recent window averages above the previous window', () => {
    expect(
      calculateBenchmarkTrend({
        days: 2,
        historicalData: prices([12, 10, 8, 8])
      })
    ).toBe('UP');
  });

  it('returns DOWN when the recent window averages below the previous window', () => {
    expect(
      calculateBenchmarkTrend({
        days: 2,
        historicalData: prices([4, 4, 10, 10])
      })
    ).toBe('DOWN');
  });

  it('returns NEUTRAL when the two windows have the same average', () => {
    expect(
      calculateBenchmarkTrend({
        days: 2,
        historicalData: prices([10, 10, 10, 10])
      })
    ).toBe('NEUTRAL');
  });
});
