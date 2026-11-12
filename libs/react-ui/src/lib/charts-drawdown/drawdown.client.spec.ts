import { fetchDrawdown, formatDrawdownPercent } from './drawdown.client';

describe('formatDrawdownPercent', () => {
  it('formats fractional drawdown as a signed percentage', () => {
    expect(formatDrawdownPercent(0)).toBe('0.00%');
    expect(formatDrawdownPercent(-0.125)).toBe('-12.50%');
  });
});

describe('fetchDrawdown', () => {
  it('requests the live charts drawdown route with the shared range', async () => {
    const request = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        data: {
          endDate: '2026-04-01',
          granularity: 'daily',
          maxDrawdown: -0.2,
          maxDrawdownDate: '2026-03-02',
          points: [
            { date: '2026-01-05', drawdown: 0, isNewPeak: true },
            { date: '2026-03-02', drawdown: -0.2, isNewPeak: false }
          ],
          startDate: '2026-01-05'
        },
        error: null,
        meta: {}
      }),
      ok: true,
      status: 200
    });

    const data = await fetchDrawdown({ range: '1y' }, request);

    expect(request).toHaveBeenCalledWith(
      '/api/v1/charts/drawdown?range=1y',
      expect.objectContaining({ method: 'GET' })
    );
    expect(data.maxDrawdown).toBe(-0.2);
    expect(data.maxDrawdownDate).toBe('2026-03-02');
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

    await expect(fetchDrawdown({ range: 'ytd' }, request)).rejects.toThrow(
      'Invalid drawdown API response'
    );
  });
});
