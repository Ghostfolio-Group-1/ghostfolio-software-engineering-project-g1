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
});
