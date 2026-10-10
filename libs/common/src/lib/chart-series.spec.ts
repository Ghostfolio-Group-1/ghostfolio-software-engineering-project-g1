import { resolveChartGranularity, toChartSeriesResponse } from './chart-series';
import { HistoricalDataItem } from './interfaces/historical-data-item.interface';

describe('chart series adapter', () => {
  const history: HistoricalDataItem[] = [
    {
      date: '2020-01-06',
      totalCashInBaseCurrency: 10,
      totalInvestment: 100,
      valueWithCurrencyEffect: 110
    },
    {
      date: '2020-01-08',
      totalCashInBaseCurrency: 12,
      totalInvestment: 100,
      valueWithCurrencyEffect: 120
    },
    {
      date: '2020-01-13',
      totalCashInBaseCurrency: 12,
      totalInvestment: 140,
      valueWithCurrencyEffect: 160
    },
    {
      date: '2026-02-01',
      value: 5
    }
  ];

  it('keeps every day when the requested range is within two years', () => {
    expect(
      toChartSeriesResponse({
        endDate: '2020-12-31',
        history,
        startDate: '2020-01-01'
      })
    ).toEqual({
      endDate: '2020-12-31',
      granularity: 'daily',
      kind: 'portfolioValue',
      points: [
        { date: '2020-01-06', value: 120 },
        { date: '2020-01-08', value: 132 },
        { date: '2020-01-13', value: 172 }
      ],
      startDate: '2020-01-01'
    });
  });

  it('treats a range of exactly two years as daily', () => {
    expect(
      resolveChartGranularity({
        endDate: '2026-01-01',
        startDate: '2024-01-01'
      })
    ).toBe('daily');

    expect(
      resolveChartGranularity({
        endDate: '2026-02-28',
        startDate: '2024-02-29'
      })
    ).toBe('daily');
  });

  it('keeps the last point of each week when the range is longer than two years', () => {
    expect(
      toChartSeriesResponse({
        endDate: '2026-01-02',
        history,
        startDate: '2024-01-01'
      }).granularity
    ).toBe('weekly');

    expect(
      toChartSeriesResponse({
        endDate: '2022-01-07',
        history,
        startDate: '2020-01-06'
      })
    ).toEqual({
      endDate: '2022-01-07',
      granularity: 'weekly',
      kind: 'portfolioValue',
      points: [
        { date: '2020-01-08', value: 132 },
        { date: '2020-01-13', value: 172 }
      ],
      startDate: '2020-01-06'
    });
  });

  it('reads invested capital and cash from the existing history fields', () => {
    expect(
      toChartSeriesResponse({
        endDate: '2020-01-13',
        history,
        kind: 'investedCapital',
        startDate: '2020-01-06'
      }).points
    ).toEqual([
      { date: '2020-01-06', value: 100 },
      { date: '2020-01-08', value: 100 },
      { date: '2020-01-13', value: 140 }
    ]);

    expect(
      toChartSeriesResponse({
        endDate: '2020-01-08',
        history,
        kind: 'cash',
        startDate: '2020-01-06'
      }).points
    ).toEqual([
      { date: '2020-01-06', value: 10 },
      { date: '2020-01-08', value: 12 }
    ]);
  });

  it('uses netWorth when the calculator already aggregated holdings and cash', () => {
    expect(
      toChartSeriesResponse({
        endDate: '2026-03-01',
        history: [
          {
            date: '2026-03-01',
            netWorth: 1200,
            totalCashInBaseCurrency: 200,
            valueWithCurrencyEffect: 1000
          }
        ],
        startDate: '2026-03-01'
      }).points
    ).toEqual([{ date: '2026-03-01', value: 1200 }]);
  });

  it('uses the base-currency value when the currency-effect value is absent', () => {
    expect(
      toChartSeriesResponse({
        endDate: '2026-02-01',
        history,
        startDate: '2026-02-01'
      }).points
    ).toEqual([{ date: '2026-02-01', value: 5 }]);
  });

  it('returns no points when the history has no values in the range', () => {
    expect(
      toChartSeriesResponse({
        endDate: '2019-01-01',
        history,
        startDate: '2019-01-01'
      })
    ).toEqual({
      endDate: '2019-01-01',
      granularity: 'daily',
      kind: 'portfolioValue',
      points: [],
      startDate: '2019-01-01'
    });
  });
});
