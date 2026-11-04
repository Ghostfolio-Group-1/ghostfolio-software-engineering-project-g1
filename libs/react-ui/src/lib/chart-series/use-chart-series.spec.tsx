/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { fetchChartSeries, useChartSeries } from './use-chart-series';
import type {
  ChartSeriesData,
  ChartSeriesFetch,
  ChartSeriesRangeQuery
} from './use-chart-series';

const completeData: ChartSeriesData = {
  endDate: '2026-04-01',
  granularity: 'daily',
  kind: 'portfolioValue',
  points: [
    { date: '2026-01-05', value: 1000 },
    { date: '2026-02-02', value: 1100 },
    { date: '2026-03-02', value: 1050 }
  ],
  startDate: '2026-01-05'
};

function httpResponse(body: unknown, status = 200): Response {
  return {
    json: jest.fn().mockResolvedValue(body),
    ok: status >= 200 && status < 300,
    status
  } as unknown as Response;
}

function mockRequest(body: unknown, status = 200) {
  const mock = jest.fn().mockResolvedValue(httpResponse(body, status));
  return { mock, request: mock as unknown as ChartSeriesFetch };
}

const success = (data: ChartSeriesData) => ({ data, error: null, meta: {} });

describe('fetchChartSeries', () => {
  it('requests the series route with a preset range', async () => {
    const { mock, request } = mockRequest(success(completeData));
    const controller = new AbortController();

    const data = await fetchChartSeries(
      { range: 'ytd' },
      request,
      controller.signal
    );

    expect(mock).toHaveBeenCalledWith(
      '/api/v1/charts/series?range=ytd',
      expect.objectContaining({
        credentials: 'same-origin',
        method: 'GET',
        signal: controller.signal
      })
    );
    expect(data).toEqual(completeData);
  });

  it('sends custom dates and an optional kind', async () => {
    const { mock, request } = mockRequest(
      success({ ...completeData, kind: 'cash' })
    );

    await fetchChartSeries(
      {
        endDate: '2026-04-01',
        kind: 'cash',
        startDate: '2026-01-05'
      },
      request
    );

    expect(mock).toHaveBeenCalledWith(
      '/api/v1/charts/series?startDate=2026-01-05&endDate=2026-04-01&kind=cash',
      expect.any(Object)
    );
  });

  it('accepts an empty points array', async () => {
    const empty: ChartSeriesData = { ...completeData, points: [] };
    const { request } = mockRequest(success(empty));
    await expect(fetchChartSeries({ range: '1y' }, request)).resolves.toEqual(
      empty
    );
  });

  it('exposes an API error message', async () => {
    const { request } = mockRequest(
      {
        data: null,
        error: {
          code: 'CHARTS_SERIES_FAILED',
          message: 'Unable to load the chart series'
        },
        meta: {}
      },
      500
    );

    await expect(fetchChartSeries({ range: 'max' }, request)).rejects.toThrow(
      'Unable to load the chart series'
    );
  });

  it('rejects malformed responses', async () => {
    const malformed = mockRequest({
      data: { points: null },
      error: null,
      meta: {}
    });
    await expect(
      fetchChartSeries({ range: 'ytd' }, malformed.request)
    ).rejects.toThrow('Invalid chart-series API response');
  });

  it('propagates a failed network request', async () => {
    const mock = jest.fn().mockRejectedValue(new Error('Network unavailable'));
    await expect(
      fetchChartSeries({ range: 'ytd' }, mock as unknown as ChartSeriesFetch)
    ).rejects.toThrow('Network unavailable');
  });
});

describe('useChartSeries', () => {
  let container: HTMLDivElement;
  let root: Root;

  function Probe({
    query,
    request
  }: {
    query: ChartSeriesRangeQuery;
    request: ChartSeriesFetch;
  }) {
    const { data, error, status } = useChartSeries(query, request);
    return (
      <div data-status={status}>
        {error?.message ?? data?.points[0]?.value ?? ''}
      </div>
    );
  }

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('updates from loading to ready with series points', async () => {
    const { request } = mockRequest(success(completeData));

    await act(async () => {
      root.render(<Probe query={{ range: 'ytd' }} request={request} />);
    });

    expect(container.firstElementChild?.getAttribute('data-status')).toBe(
      'ready'
    );
    expect(container.textContent).toBe('1000');
  });

  it('reports empty and error states', async () => {
    const empty = mockRequest(success({ ...completeData, points: [] }));

    await act(async () => {
      root.render(<Probe query={{ range: 'ytd' }} request={empty.request} />);
    });
    expect(container.firstElementChild?.getAttribute('data-status')).toBe(
      'empty'
    );

    const failed = mockRequest(
      {
        data: null,
        error: {
          code: 'CHARTS_INVALID_QUERY',
          message: 'Invalid range'
        },
        meta: {}
      },
      400
    );
    await act(async () => {
      root.render(<Probe query={{ range: 'ytd' }} request={failed.request} />);
    });
    expect(container.firstElementChild?.getAttribute('data-status')).toBe(
      'error'
    );
    expect(container.textContent).toBe('Invalid range');
  });
});
