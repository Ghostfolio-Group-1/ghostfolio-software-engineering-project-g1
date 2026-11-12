import {
  clearTargetAllocation,
  fetchTargetAllocation,
  updateTargetAllocation
} from './target-allocation.client';

function httpResponse(body: unknown, status = 200): Response {
  return {
    json: jest.fn().mockResolvedValue(body),
    ok: status >= 200 && status < 300,
    status
  } as unknown as Response;
}

function okEnvelope(data: unknown) {
  return { data, error: null, meta: {} };
}

const dataFixture = {
  buckets: [
    {
      actual: 0.6,
      deviation: 0,
      key: 'EQUITY',
      severity: 'GREEN',
      target: 0.6
    }
  ],
  groupBy: 'assetClass',
  isSet: true,
  targets: [{ key: 'EQUITY', percentage: 0.6 }]
};

describe('fetchTargetAllocation', () => {
  it('GETs the target allocation', async () => {
    const request = jest
      .fn()
      .mockResolvedValue(httpResponse(okEnvelope(dataFixture)));

    const result = await fetchTargetAllocation(request);

    expect(result).toEqual(dataFixture);
    expect(request).toHaveBeenCalledWith(
      '/api/v1/risk/target-allocation',
      expect.objectContaining({ method: 'GET' })
    );
  });
});

describe('updateTargetAllocation', () => {
  it('PUTs the body and returns the updated data', async () => {
    const request = jest
      .fn()
      .mockResolvedValue(httpResponse(okEnvelope(dataFixture)));
    const body = {
      groupBy: 'assetClass',
      targets: [{ key: 'EQUITY', percentage: 0.6 }]
    };

    const result = await updateTargetAllocation(request, body);

    expect(result).toEqual(dataFixture);
    expect(request).toHaveBeenCalledWith(
      '/api/v1/risk/target-allocation',
      expect.objectContaining({
        body: JSON.stringify(body),
        method: 'PUT'
      })
    );
  });

  it('surfaces a safe-to-display validation error message', async () => {
    const request = jest.fn().mockResolvedValue(
      httpResponse(
        {
          data: null,
          error: {
            code: 'RISK_TARGET_INVALID_SUM',
            message: 'Target percentages must add up to 100%.'
          },
          meta: {}
        },
        400
      )
    );

    await expect(
      updateTargetAllocation(request, {
        groupBy: 'assetClass',
        targets: []
      })
    ).rejects.toThrow('Target percentages must add up to 100%.');
  });

  it('falls back to a generic message for an unlisted error code', async () => {
    const request = jest.fn().mockResolvedValue(
      httpResponse(
        {
          data: null,
          error: { code: 'RISK_CALC_FAILED', message: 'raw server text' },
          meta: {}
        },
        500
      )
    );

    const error = await updateTargetAllocation(request, {
      groupBy: 'assetClass',
      targets: []
    }).catch((caught: Error) => caught);

    expect(error.message).not.toContain('raw server text');
    expect(error.message).toContain('Could not save');
  });
});

describe('clearTargetAllocation', () => {
  it('DELETEs with no body and returns the cleared data', async () => {
    const cleared = {
      buckets: [],
      groupBy: null,
      isSet: false,
      targets: []
    };
    const request = jest
      .fn()
      .mockResolvedValue(httpResponse(okEnvelope(cleared)));

    const result = await clearTargetAllocation(request);

    expect(result).toEqual(cleared);
    expect(request).toHaveBeenCalledWith(
      '/api/v1/risk/target-allocation',
      expect.objectContaining({ method: 'DELETE' })
    );
  });
});
