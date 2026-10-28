import { toDrawdownResponse } from './drawdown';

describe('toDrawdownResponse', () => {
  it('returns zero drawdown at peaks and negative drawdown below the peak', () => {
    expect(
      toDrawdownResponse({
        endDate: '2026-04-01',
        startDate: '2026-01-01',
        history: [
          { date: '2026-01-01', netWorth: 1000 },
          { date: '2026-02-01', netWorth: 1200 },
          { date: '2026-03-01', netWorth: 900 },
          { date: '2026-04-01', netWorth: 1100 }
        ]
      })
    ).toEqual({
      endDate: '2026-04-01',
      granularity: 'daily',
      maxDrawdown: (900 - 1200) / 1200,
      maxDrawdownDate: '2026-03-01',
      startDate: '2026-01-01',
      points: [
        { date: '2026-01-01', drawdown: 0, isNewPeak: true },
        { date: '2026-02-01', drawdown: 0, isNewPeak: true },
        {
          date: '2026-03-01',
          drawdown: (900 - 1200) / 1200,
          isNewPeak: false
        },
        {
          date: '2026-04-01',
          drawdown: (1100 - 1200) / 1200,
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
        { date: '2026-01-01', netWorth: 1000 },
        { date: '2026-02-01', netWorth: 1500 },
        { date: '2026-03-01', netWorth: 1200 },
        { date: '2026-04-01', netWorth: 1350 }
      ]
    });

    expect(result.startDate).toBe('2026-03-01');
    expect(result.points).toEqual([
      {
        date: '2026-03-01',
        drawdown: (1200 - 1500) / 1500,
        isNewPeak: false
      },
      {
        date: '2026-04-01',
        drawdown: (1350 - 1500) / 1500,
        isNewPeak: false
      }
    ]);
    expect(result.maxDrawdown).toBe((1200 - 1500) / 1500);
    expect(result.maxDrawdownDate).toBe('2026-03-01');
  });

  it('returns zero drawdown for a single history point', () => {
    expect(
      toDrawdownResponse({
        endDate: '2026-01-01',
        startDate: '2026-01-01',
        history: [{ date: '2026-01-01', netWorth: 500 }]
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
});
