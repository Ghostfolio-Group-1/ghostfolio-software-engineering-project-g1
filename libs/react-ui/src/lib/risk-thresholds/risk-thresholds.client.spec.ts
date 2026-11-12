import {
  fetchRiskThresholds,
  resetRiskThreshold,
  updateRiskThreshold
} from './risk-thresholds.client';

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

const itemFixture = {
  defaults: { max: 0.1, redMax: 0.25 },
  isActive: true,
  isCustomized: false,
  name: 'Single stock concentration',
  ruleKey: 'SingleStockConcentration',
  shape: 'ceiling',
  thresholds: { max: 0.1, redMax: 0.25 }
};

describe('fetchRiskThresholds', () => {
  it('GETs the threshold list', async () => {
    const request = jest
      .fn()
      .mockResolvedValue(httpResponse(okEnvelope([itemFixture])));

    const result = await fetchRiskThresholds(request);

    expect(result).toEqual([itemFixture]);
    expect(request).toHaveBeenCalledWith(
      '/api/v1/risk/thresholds',
      expect.objectContaining({ method: 'GET' })
    );
  });
});

describe('updateRiskThreshold', () => {
  it('PUTs the body and returns the updated item', async () => {
    const request = jest
      .fn()
      .mockResolvedValue(httpResponse(okEnvelope(itemFixture)));
    const body = { isActive: true, thresholds: { max: 0.1, redMax: 0.25 } };

    const result = await updateRiskThreshold(
      request,
      'SingleStockConcentration',
      body
    );

    expect(result).toEqual(itemFixture);
    expect(request).toHaveBeenCalledWith(
      '/api/v1/risk/thresholds/SingleStockConcentration',
      expect.objectContaining({ body: JSON.stringify(body), method: 'PUT' })
    );
  });

  it('surfaces a safe-to-display validation error message', async () => {
    const request = jest.fn().mockResolvedValue(
      httpResponse(
        {
          data: null,
          error: {
            code: 'RISK_THRESHOLD_INVALID_ORDER',
            message: 'max (0.3) must be less than redMax (0.25).'
          },
          meta: {}
        },
        400
      )
    );

    await expect(
      updateRiskThreshold(request, 'SingleStockConcentration', {
        thresholds: { max: 0.3, redMax: 0.25 }
      })
    ).rejects.toThrow('max (0.3) must be less than redMax (0.25).');
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

    const error = await updateRiskThreshold(
      request,
      'SingleStockConcentration',
      { isActive: false }
    ).catch((caught: Error) => caught);

    expect(error.message).not.toContain('raw server text');
    expect(error.message).toContain('Could not save');
  });
});

describe('resetRiskThreshold', () => {
  it('DELETEs with no body and returns the reset item', async () => {
    const request = jest
      .fn()
      .mockResolvedValue(httpResponse(okEnvelope(itemFixture)));

    const result = await resetRiskThreshold(
      request,
      'SingleStockConcentration'
    );

    expect(result).toEqual(itemFixture);
    expect(request).toHaveBeenCalledWith(
      '/api/v1/risk/thresholds/SingleStockConcentration',
      expect.objectContaining({ method: 'DELETE' })
    );
  });
});
