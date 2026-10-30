import { toDrawdownResponse } from './drawdown';

function index(performance: number): number {
  return 100 * (1 + performance);
}

function drawdownFrom(performance: number, peakPerformance: number): number {
  const value = index(performance);
  const peak = index(peakPerformance);

  return (value - peak) / peak;
}

describe('toDrawdownResponse', () => {
  it('returns zero drawdown at peaks and negative drawdown below the peak', () => {
    expect(
      toDrawdownResponse({
        endDate: '2026-04-01',
        startDate: '2026-01-01',
        history: [
          {
            date: '2026-01-01',
            netPerformanceInPercentageWithCurrencyEffect: 0
          },
          {
            date: '2026-02-01',
            netPerformanceInPercentageWithCurrencyEffect: 0.2
          },
          {
            date: '2026-03-01',
            netPerformanceInPercentageWithCurrencyEffect: -0.1
          },
          {
            date: '2026-04-01',
            netPerformanceInPercentageWithCurrencyEffect: 0.1
          }
        ]
      })
    ).toEqual({
      endDate: '2026-04-01',
      granularity: 'daily',
      maxDrawdown: drawdownFrom(-0.1, 0.2),
      maxDrawdownDate: '2026-03-01',
      startDate: '2026-01-01',
      points: [
        { date: '2026-01-01', drawdown: 0, isNewPeak: true },
        { date: '2026-02-01', drawdown: 0, isNewPeak: true },
        {
          date: '2026-03-01',
          drawdown: drawdownFrom(-0.1, 0.2),
          isNewPeak: false
        },
        {
          date: '2026-04-01',
          drawdown: drawdownFrom(0.1, 0.2),
          isNewPeak: false
        }
      ]
    });
  });

  it('tracks the peak from history before the selected range', () => {
    const result = toDrawdownResponse({
      endDate: '2026-04-01',
      startDate: '2026-03-01',
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
        },
        {
          date: '2026-04-01',
          netPerformanceInPercentageWithCurrencyEffect: 0.35
        }
      ]
    });

    expect(result.startDate).toBe('2026-03-01');
    expect(result.points).toEqual([
      {
        date: '2026-03-01',
        drawdown: drawdownFrom(0.2, 0.5),
        isNewPeak: false
      },
      {
        date: '2026-04-01',
        drawdown: drawdownFrom(0.35, 0.5),
        isNewPeak: false
      }
    ]);
    expect(result.maxDrawdown).toBe(drawdownFrom(0.2, 0.5));
    expect(result.maxDrawdownDate).toBe('2026-03-01');
  });

  it('returns zero drawdown for a single history point', () => {
    expect(
      toDrawdownResponse({
        endDate: '2026-01-01',
        startDate: '2026-01-01',
        history: [
          {
            date: '2026-01-01',
            netPerformanceInPercentageWithCurrencyEffect: 0
          }
        ]
      })
    ).toEqual({
      endDate: '2026-01-01',
      granularity: 'daily',
      maxDrawdown: 0,
      maxDrawdownDate: '2026-01-01',
      startDate: '2026-01-01',
      points: [{ date: '2026-01-01', drawdown: 0, isNewPeak: true }]
    });
  });

  it('ignores deposits and withdrawals when measuring investment drawdown', () => {
    // netWorth jumps on a deposit while performance shows a market loss.
    // Indexing from netWorth would treat the deposit as a new peak.
    const result = toDrawdownResponse({
      endDate: '2026-03-01',
      startDate: '2026-01-01',
      history: [
        {
          date: '2026-01-01',
          netWorth: 1000,
          netPerformanceInPercentageWithCurrencyEffect: 0
        },
        {
          date: '2026-02-01',
          netWorth: 1200,
          netPerformanceInPercentageWithCurrencyEffect: 0.2
        },
        {
          date: '2026-03-01',
          netWorth: 2000,
          netPerformanceInPercentageWithCurrencyEffect: -0.1
        }
      ]
    });

    expect(result.points).toEqual([
      { date: '2026-01-01', drawdown: 0, isNewPeak: true },
      { date: '2026-02-01', drawdown: 0, isNewPeak: true },
      {
        date: '2026-03-01',
        drawdown: drawdownFrom(-0.1, 0.2),
        isNewPeak: false
      }
    ]);
    expect(result.maxDrawdown).toBe(drawdownFrom(-0.1, 0.2));
    expect(result.maxDrawdownDate).toBe('2026-03-01');
  });

  it('keeps maxDrawdown from a mid-week daily low when thinning to weekly', () => {
    // Range > 2 years forces weekly points. Wednesday is the deepest low;
    // Friday recovers within the same week, so weekly thinning would drop
    // Wednesday if maxDrawdown were taken after thinning.
    const result = toDrawdownResponse({
      endDate: '2023-01-09',
      startDate: '2020-01-06',
      history: [
        {
          date: '2020-01-06',
          netPerformanceInPercentageWithCurrencyEffect: 0
        },
        {
          date: '2020-01-07',
          netPerformanceInPercentageWithCurrencyEffect: 1
        },
        {
          // Wednesday mid-week trough
          date: '2020-01-08',
          netPerformanceInPercentageWithCurrencyEffect: 0.2
        },
        {
          // Friday recovery in the same ISO week (Mon 2020-01-06)
          date: '2020-01-10',
          netPerformanceInPercentageWithCurrencyEffect: 0.6
        },
        {
          date: '2023-01-09',
          netPerformanceInPercentageWithCurrencyEffect: 0.8
        }
      ]
    });

    expect(result.granularity).toBe('weekly');
    expect(result.maxDrawdown).toBe(drawdownFrom(0.2, 1));
    expect(result.maxDrawdownDate).toBe('2020-01-08');
    expect(result.points[0]).toEqual({
      date: '2020-01-06',
      drawdown: drawdownFrom(0.6, 1),
      isNewPeak: false
    });
  });
});
