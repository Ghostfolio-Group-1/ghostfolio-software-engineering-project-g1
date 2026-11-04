import { ApiRequestError, requestApi } from './api-request';
import type { AuthenticatedFetch } from './api-request';

function mockFetch(body: unknown, status = 200, json = true) {
  const response = {
    json: json
      ? jest.fn().mockResolvedValue(body)
      : jest.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
    ok: status >= 200 && status < 300,
    status
  } as unknown as Response;
  const mock = jest.fn().mockResolvedValue(response);

  return { mock, request: mock as unknown as AuthenticatedFetch };
}

async function rejection(promise: Promise<unknown>) {
  return promise.then(
    () => {
      throw new Error('Expected the request to be rejected');
    },
    (error: ApiRequestError) => error
  );
}

describe('requestApi', () => {
  it('GETs the path through the adapter and returns the envelope data', async () => {
    const { mock, request } = mockFetch({
      data: { score: 72 },
      error: null,
      meta: {}
    });
    const controller = new AbortController();

    await expect(
      requestApi(request, '/api/v1/risk/score', controller.signal)
    ).resolves.toEqual({ score: 72 });
    expect(mock).toHaveBeenCalledWith(
      '/api/v1/risk/score',
      expect.objectContaining({
        headers: { Accept: 'application/json' },
        method: 'GET',
        signal: controller.signal
      })
    );
  });

  it('keeps decimal strings exactly as sent', async () => {
    const { request } = mockFetch({
      data: { amount: '217.60000000000000000001' },
      error: null,
      meta: {}
    });

    await expect(requestApi(request, '/api/v1/tax/x')).resolves.toEqual({
      amount: '217.60000000000000000001'
    });
  });

  it('throws the backend error code from an error envelope', async () => {
    const { request } = mockFetch(
      {
        data: null,
        error: { code: 'TAX_LOTS_FAILED', message: 'internal detail' },
        meta: {}
      },
      422
    );
    const error = await rejection(requestApi(request, '/api/v1/tax/lots'));

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error.status).toBe(422);
    expect(error.code).toBe('TAX_LOTS_FAILED');
    expect(error.message).toBe('Unable to load data');
    expect(error.message).not.toContain('internal detail');
  });

  it('asks the user to sign in on 401', async () => {
    const { request } = mockFetch({ message: 'Unauthorized' }, 401);
    const error = await rejection(requestApi(request, '/api/v1/risk/score'));

    expect(error.status).toBe(401);
    expect(error.code).toBe('REQUEST_FAILED');
    expect(error.message).toBe('Please sign in');
  });

  it('rejects a body that is not JSON', async () => {
    const { request } = mockFetch(undefined, 502, false);
    const error = await rejection(requestApi(request, '/api/v1/charts/series'));

    expect(error.status).toBe(502);
    expect(error.code).toBe('INVALID_RESPONSE');
  });

  it('rejects a success envelope without data', async () => {
    const { request } = mockFetch({ data: null, error: null, meta: {} });
    const error = await rejection(requestApi(request, '/api/v1/charts/series'));

    expect(error.code).toBe('INVALID_RESPONSE');
  });
});
