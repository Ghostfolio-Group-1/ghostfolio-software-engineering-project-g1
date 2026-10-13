import {
  ReturnComparisonSymbolNotFoundError,
  toReturnComparison
} from './return-comparison';

describe('return comparison', () => {
  it('indexes both series to 100 and adds dividends only to total return', () => {
    expect(
      toReturnComparison({
        endDate: '2026-03-01',
        observations: [
          { date: '2026-01-01', symbol: 'AAPL', value: 100 },
          {
            date: '2026-02-01',
            dividend: 10,
            symbol: 'AAPL',
            value: 110
          },
          { date: '2026-03-01', symbol: 'AAPL', value: 120 }
        ],
        startDate: '2026-01-01',
        symbol: 'AAPL'
      })
    ).toEqual({
      endDate: '2026-03-01',
      granularity: 'daily',
      points: [
        { date: '2026-01-01', priceReturn: 100, totalReturn: 100 },
        { date: '2026-02-01', priceReturn: 110, totalReturn: 120 },
        { date: '2026-03-01', priceReturn: 120, totalReturn: 130 }
      ],
      startDate: '2026-01-01'
    });
  });

  it('keeps price return and total return equal when there are no dividends', () => {
    const comparison = toReturnComparison({
      endDate: '2026-02-01',
      observations: [
        { date: '2026-01-01', value: 50 },
        { date: '2026-02-01', value: 75 }
      ],
      startDate: '2026-01-01'
    });

    expect(comparison.points).toEqual([
      { date: '2026-01-01', priceReturn: 100, totalReturn: 100 },
      { date: '2026-02-01', priceReturn: 150, totalReturn: 150 }
    ]);
  });

  it('starts both series at 100 on the first date the holding exists in the range', () => {
    expect(
      toReturnComparison({
        endDate: '2026-06-01',
        observations: [
          { date: '2026-01-01', symbol: 'AAPL', value: 80 },
          { date: '2026-03-01', symbol: 'MSFT', value: 40 },
          { date: '2026-04-01', dividend: 4, symbol: 'MSFT', value: 44 }
        ],
        startDate: '2026-01-01',
        symbol: 'MSFT'
      }).points
    ).toEqual([
      { date: '2026-03-01', priceReturn: 100, totalReturn: 100 },
      { date: '2026-04-01', priceReturn: 110, totalReturn: 120 }
    ]);
  });

  it('holds both series flat after the holding is sold', () => {
    expect(
      toReturnComparison({
        endDate: '2026-06-01',
        observations: [
          { date: '2026-01-01', symbol: 'AAPL', value: 100 },
          { date: '2026-03-01', sold: true, symbol: 'AAPL', value: 120 },
          { date: '2026-04-01', symbol: 'AAPL', value: 0 }
        ],
        startDate: '2026-01-01',
        symbol: 'AAPL'
      }).points
    ).toEqual([
      { date: '2026-01-01', priceReturn: 100, totalReturn: 100 },
      { date: '2026-03-01', priceReturn: 120, totalReturn: 120 },
      { date: '2026-04-01', priceReturn: 120, totalReturn: 120 },
      { date: '2026-06-01', priceReturn: 120, totalReturn: 120 }
    ]);
  });

  it('aggregates every holding when no symbol is requested', () => {
    expect(
      toReturnComparison({
        endDate: '2026-02-01',
        observations: [
          { date: '2026-01-01', symbol: 'AAPL', value: 100 },
          { date: '2026-01-01', symbol: 'MSFT', value: 100 },
          { date: '2026-02-01', dividend: 10, symbol: 'AAPL', value: 110 },
          { date: '2026-02-01', symbol: 'MSFT', value: 100 }
        ],
        startDate: '2026-01-01'
      }).points
    ).toEqual([
      { date: '2026-01-01', priceReturn: 100, totalReturn: 100 },
      { date: '2026-02-01', priceReturn: 105, totalReturn: 110 }
    ]);
  });

  it('rejects a symbol that is not held in the range', () => {
    expect(() => {
      toReturnComparison({
        endDate: '2026-06-01',
        observations: [{ date: '2026-01-01', symbol: 'AAPL', value: 100 }],
        startDate: '2026-01-01',
        symbol: 'MSFT'
      });
    }).toThrow(ReturnComparisonSymbolNotFoundError);
  });
});
