import {
  fetchBenchmarkComparison,
  formatBenchmarkIndex
} from './benchmark.client';

const comparison = {
  benchmarkAvailableFrom: '2026-01-05',
  benchmarkSymbol: 'SPY',
  endDate: '2026-04-01',
  granularity: 'daily',
  points: [
    { benchmarkReturn: 100, date: '2026-01-05', portfolioReturn: 100 },
    { benchmarkReturn: 110, date: '2026-04-01', portfolioReturn: 108 }
  ],
  startDate: '2026-01-05'
};

describe('formatBenchmarkIndex', () => {
  it('formats an indexed return to two decimal places', () => {
    expect(formatBenchmarkIndex(100)).toBe('100.00');
    expect(formatBenchmarkIndex(108.5)).toBe('108.50');
  });
});

describe('fetchBenchmarkComparison', () => {
  it('requests the benchmark comparison route with the shared range and symbol', async () => {
    const request = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        data: comparison,
        error: null,
        meta: {}
      }),
      ok: true,
      status: 200
    });

    const data = await fetchBenchmarkComparison(
      { benchmark: 'SPY', range: '1y' },
      request
    );

    expect(request).toHaveBeenCalledWith(
      '/api/v1/charts/benchmark-comparison?range=1y&benchmark=SPY',
      expect.objectContaining({ method: 'GET' })
    );
    expect(data.benchmarkSymbol).toBe('SPY');
    expect(data.points).toHaveLength(2);
  });

  it('rejects an invalid payload', async () => {
    const request = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        data: { points: 'nope' },
        error: null,
        meta: {}
      }),
      ok: true,
      status: 200
    });

    await expect(
      fetchBenchmarkComparison({ range: 'ytd' }, request)
    ).rejects.toThrow('Invalid benchmark comparison API response');
  });
});
