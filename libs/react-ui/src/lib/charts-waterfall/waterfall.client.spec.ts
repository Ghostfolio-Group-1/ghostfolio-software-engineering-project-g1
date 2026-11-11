import { fetchWaterfall, toWaterfallBars } from './waterfall.client';
import type { WaterfallSegment } from './waterfall.client';

describe('toWaterfallBars', () => {
  it('stacks contributions so start plus deltas equals end', () => {
    const segments: WaterfallSegment[] = [
      { kind: 'start', label: 'Start', value: 10000 },
      {
        category: 'netCashFlow',
        kind: 'contribution',
        label: 'Net cash flow',
        value: 1000
      },
      {
        category: 'marketGainLoss',
        kind: 'contribution',
        label: 'Market',
        value: -400
      },
      {
        category: 'dividends',
        kind: 'contribution',
        label: 'Dividends',
        value: 150
      },
      { kind: 'end', label: 'End', value: 10750 }
    ];

    const bars = toWaterfallBars(segments);
    const contributions = bars.filter((bar) => bar.kind === 'contribution');
    const start = bars.find((bar) => bar.kind === 'start');
    const end = bars.find((bar) => bar.kind === 'end');
    const reconstructed =
      (start?.value ?? 0) +
      contributions.reduce((sum, bar) => sum + bar.value, 0);

    expect(reconstructed).toBe(10750);
    expect(end?.value).toBe(10750);
    expect(bars[1]).toMatchObject({ y0: 10000, y1: 11000 });
    expect(bars[2]).toMatchObject({ y0: 10600, y1: 11000 });
    expect(bars[3]).toMatchObject({ y0: 10600, y1: 10750 });
  });

  it('keeps absolute start and end bars anchored at zero', () => {
    const bars = toWaterfallBars([
      { kind: 'start', label: 'Start', value: 500 },
      { kind: 'end', label: 'End', value: 500 }
    ]);

    expect(bars[0]).toMatchObject({ y0: 0, y1: 500 });
    expect(bars[1]).toMatchObject({ y0: 0, y1: 500 });
  });
});

describe('fetchWaterfall', () => {
  it('requests the charts waterfall route with shared range and breakdown', async () => {
    const request = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        data: {
          currency: 'USD',
          endDate: '2026-02-01',
          segments: [
            { kind: 'start', label: 'Start', value: 100 },
            { kind: 'end', label: 'End', value: 100 }
          ],
          startDate: '2026-01-01'
        },
        error: null,
        meta: {}
      }),
      ok: true,
      status: 200
    });

    await fetchWaterfall(
      { breakdown: 'holding', range: '1y' },
      request as unknown as typeof fetch
    );

    expect(request).toHaveBeenCalledWith(
      '/api/v1/charts/waterfall?range=1y&breakdown=holding',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('rejects an invalid payload without exposing server text', async () => {
    const request = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        data: { currency: 'USD', segments: 'nope' },
        error: null,
        meta: {}
      }),
      ok: true,
      status: 200
    });

    await expect(
      fetchWaterfall({ range: 'ytd' }, request as unknown as typeof fetch)
    ).rejects.toThrow('Invalid waterfall API response');
  });
});
