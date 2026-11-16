/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { useApiData } from './use-api-data';

type Result = ReturnType<typeof useApiData<string[]>>;

describe('useApiData', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: Result;

  beforeAll(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  function Probe({
    load
  }: {
    load: (signal: AbortSignal) => Promise<string[]>;
  }) {
    latest = useApiData(load, (rows) => rows.length === 0);

    return null;
  }

  async function render(load: (signal: AbortSignal) => Promise<string[]>) {
    await act(async () => {
      root.render(<Probe load={load} />);
    });
  }

  it('starts in loading and moves to ready with the data', async () => {
    let resolve: (rows: string[]) => void = () => undefined;
    const load = jest.fn(
      () => new Promise<string[]>((done) => (resolve = done))
    );

    await render(load);
    expect(latest.status).toBe('loading');

    await act(async () => resolve(['AAPL']));
    expect(latest.status).toBe('ready');
    expect(latest.data).toEqual(['AAPL']);
    expect(latest.error).toBeNull();
  });

  it('reports empty when isEmpty says so', async () => {
    await render(() => Promise.resolve([]));

    expect(latest.status).toBe('empty');
  });

  it('reports error and keeps the error object', async () => {
    const failure = new Error('Unable to load data');

    await render(() => Promise.reject(failure));

    expect(latest.status).toBe('error');
    expect(latest.error).toBe(failure);
    expect(latest.data).toBeNull();
  });

  it('loads again on reload()', async () => {
    const load = jest
      .fn()
      .mockResolvedValueOnce(['AAPL'])
      .mockResolvedValueOnce(['AAPL', 'MSFT']);

    await render(load);
    await act(async () => latest.reload());

    expect(load).toHaveBeenCalledTimes(2);
    expect(latest.data).toEqual(['AAPL', 'MSFT']);
  });

  it('aborts the request when the component unmounts', async () => {
    let seen: AbortSignal | undefined;

    await render(
      (signal) =>
        new Promise<string[]>(() => {
          seen = signal;
        })
    );
    act(() => root.unmount());
    root = createRoot(container);

    expect(seen?.aborted).toBe(true);
  });

  it('ignores a slow first response that arrives after reload()', async () => {
    const resolvers: ((rows: string[]) => void)[] = [];
    const load = jest.fn(
      () => new Promise<string[]>((done) => resolvers.push(done))
    );

    await render(load);
    await act(async () => latest.reload());
    expect(load).toHaveBeenCalledTimes(2);

    await act(async () => resolvers[1](['FRESH']));
    expect(latest.data).toEqual(['FRESH']);

    await act(async () => resolvers[0](['STALE']));
    expect(latest.status).toBe('ready');
    expect(latest.data).toEqual(['FRESH']);
  });

  it('ignores a failure from a request replaced by reload()', async () => {
    const settle: {
      reject: (error: Error) => void;
      resolve: (rows: string[]) => void;
    }[] = [];
    const load = jest.fn(
      () =>
        new Promise<string[]>((resolve, reject) =>
          settle.push({ reject, resolve })
        )
    );

    await render(load);
    await act(async () => latest.reload());
    await act(async () => settle[1].resolve(['AAPL']));
    await act(async () => settle[0].reject(new Error('late failure')));

    expect(latest.status).toBe('ready');
    expect(latest.error).toBeNull();
    expect(latest.data).toEqual(['AAPL']);
  });
});
