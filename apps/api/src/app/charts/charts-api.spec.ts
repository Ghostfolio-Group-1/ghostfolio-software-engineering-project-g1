import { BadRequestException } from '@nestjs/common';

import { ChartsApi } from './charts-api';

describe('ChartsApi', () => {
  const api = new ChartsApi();
  const now = new Date(2026, 5, 1, 12, 0, 0);

  it('returns an empty skeleton when the range has no history', () => {
    expect(
      api.getSeries({
        endDate: '2026-01-31',
        history: [{ date: '2026-03-01', value: 10 }],
        now,
        startDate: '2026-01-01'
      })
    ).toEqual({
      endDate: '2026-01-31',
      granularity: 'daily',
      kind: 'portfolioValue',
      points: [],
      startDate: '2026-01-01'
    });
  });

  it('returns an empty skeleton when the range ends before the first activity', () => {
    expect(
      api.getSeries({
        earliestActivityDate: '2024-01-01',
        endDate: '2020-06-01',
        history: [{ date: '2024-01-01', valueWithCurrencyEffect: 10 }],
        now,
        startDate: '2020-01-01'
      })
    ).toEqual({
      endDate: '2020-06-01',
      granularity: 'daily',
      kind: 'portfolioValue',
      points: [],
      startDate: '2020-01-01'
    });
  });

  it('aggregates portfolio value from holding value and cash on the history', () => {
    expect(
      api.getSeries({
        endDate: '2026-03-02',
        history: [
          {
            date: '2026-03-01',
            totalCashInBaseCurrency: 200,
            valueWithCurrencyEffect: 1000
          },
          {
            date: '2026-03-02',
            netWorth: 1500,
            totalCashInBaseCurrency: 200,
            valueWithCurrencyEffect: 1300
          }
        ],
        now,
        startDate: '2026-03-01'
      }).points
    ).toEqual([
      { date: '2026-03-01', value: 1200 },
      { date: '2026-03-02', value: 1500 }
    ]);
  });

  it('keeps a single point on a single-day range', () => {
    expect(
      api.getSeries({
        endDate: '2026-03-01',
        history: [{ date: '2026-03-01', valueWithCurrencyEffect: 42 }],
        now,
        startDate: '2026-03-01'
      })
    ).toEqual({
      endDate: '2026-03-01',
      granularity: 'daily',
      kind: 'portfolioValue',
      points: [{ date: '2026-03-01', value: 42 }],
      startDate: '2026-03-01'
    });
  });

  it('returns an empty skeleton for a preset when no history is supplied', () => {
    expect(
      api.getSeries({
        now,
        range: '1y'
      })
    ).toEqual({
      endDate: '2026-06-01',
      granularity: 'daily',
      kind: 'portfolioValue',
      points: [],
      startDate: '2025-06-01'
    });
  });

  it('rejects a request that sends both a preset and a custom range', () => {
    expect(() => {
      api.getSeries({
        endDate: '2026-02-01',
        now,
        range: '1y',
        startDate: '2026-01-01'
      });
    }).toThrow(BadRequestException);
  });

  it('rejects a custom range that is missing one date', () => {
    expect(() => {
      api.getSeries({ now, startDate: '2026-01-01' });
    }).toThrow(BadRequestException);
  });

  it('rejects a custom range whose end is before its start', () => {
    expect(() => {
      api.getSeries({
        endDate: '2026-01-01',
        now,
        startDate: '2026-03-01'
      });
    }).toThrow(BadRequestException);
  });

  it('rejects an unknown series kind', () => {
    expect(() => {
      api.getSeries({
        kind: 'nav' as 'portfolioValue',
        now,
        range: '1y'
      });
    }).toThrow(BadRequestException);
  });

  it('rejects an unknown range preset', () => {
    expect(() => {
      api.getSeries({ now, range: '2y' });
    }).toThrow(BadRequestException);
  });

  it('maps range=1d onto the today window', () => {
    expect(
      api.getSeries({
        history: [{ date: '2026-06-01', valueWithCurrencyEffect: 8 }],
        now,
        range: '1d'
      })
    ).toEqual({
      endDate: '2026-06-01',
      granularity: 'daily',
      kind: 'portfolioValue',
      points: [{ date: '2026-06-01', value: 8 }],
      startDate: '2026-05-31'
    });
  });

  it('clamps a custom window to the first activity and to today', () => {
    expect(
      api.getSeries({
        earliestActivityDate: '2026-03-01',
        endDate: '2026-12-31',
        history: [
          { date: '2026-02-01', valueWithCurrencyEffect: 9 },
          { date: '2026-04-01', valueWithCurrencyEffect: 40 }
        ],
        now,
        startDate: '2026-01-01'
      })
    ).toEqual({
      endDate: '2026-06-01',
      granularity: 'daily',
      kind: 'portfolioValue',
      points: [{ date: '2026-04-01', value: 40 }],
      startDate: '2026-03-01'
    });
  });

  it('returns the requested cash series rather than portfolio value', () => {
    expect(
      api.getSeries({
        endDate: '2026-03-01',
        history: [
          {
            date: '2026-03-01',
            totalCashInBaseCurrency: 15,
            valueWithCurrencyEffect: 100
          }
        ],
        kind: 'cash',
        now,
        startDate: '2026-03-01'
      }).points
    ).toEqual([{ date: '2026-03-01', value: 15 }]);
  });

  it('keeps a pre-window peak when measuring drawdown inside the requested range', () => {
    const result = api.getDrawdown({
      endDate: '2026-03-01',
      history: [
        {
          date: '2026-01-01',
          netPerformanceInPercentageWithCurrencyEffect: 0
        },
        {
          date: '2026-02-01',
          netPerformanceInPercentageWithCurrencyEffect: 0.5
        },
        {
          date: '2026-03-01',
          netPerformanceInPercentageWithCurrencyEffect: 0.2
        }
      ],
      now,
      startDate: '2026-03-01'
    });

    expect(result.points).toEqual([
      {
        date: '2026-03-01',
        drawdown: (120 - 150) / 150,
        isNewPeak: false
      }
    ]);
    expect(result.maxDrawdown).toBe((120 - 150) / 150);
    expect(result.maxDrawdownDate).toBe('2026-03-01');
  });

  it('returns an empty drawdown skeleton when the range ends before the first activity', () => {
    expect(
      api.getDrawdown({
        earliestActivityDate: '2024-01-01',
        endDate: '2020-06-01',
        history: [
          {
            date: '2024-01-01',
            netPerformanceInPercentageWithCurrencyEffect: 0.4
          }
        ],
        now,
        startDate: '2020-01-01'
      })
    ).toEqual({
      endDate: '2020-06-01',
      granularity: 'daily',
      maxDrawdown: 0,
      maxDrawdownDate: '2020-01-01',
      points: [],
      startDate: '2020-01-01'
    });
  });

  it('returns an empty drawdown skeleton for a preset when no history is supplied', () => {
    expect(
      api.getDrawdown({
        now,
        range: '1y'
      })
    ).toEqual({
      endDate: '2026-06-01',
      granularity: 'daily',
      maxDrawdown: 0,
      maxDrawdownDate: '2025-06-01',
      points: [],
      startDate: '2025-06-01'
    });
  });

  it('rejects a drawdown request that sends both a preset and a custom range', () => {
    expect(() => {
      api.getDrawdown({
        endDate: '2026-02-01',
        now,
        range: '1y',
        startDate: '2026-01-01'
      });
    }).toThrow(BadRequestException);
  });
});
