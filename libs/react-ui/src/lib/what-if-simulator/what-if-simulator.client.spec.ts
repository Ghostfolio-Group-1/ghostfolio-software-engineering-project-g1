import { RiskApiError } from '../risk-dashboard/risk-dashboard.client';
import type { WhatIfResultSummary } from './what-if-result-panel';
import {
  createWhatIfPostJson,
  fetchWhatIfHoldingOptions,
  runWhatIf
} from './what-if-simulator.client';

const fullResult: WhatIfResultSummary = {
  changedWarnings: [],
  holding: {
    allocationAfter: 0.2308,
    allocationBefore: 0.3333,
    valueAfter: { amount: 18000, currency: 'USD' },
    valueBefore: { amount: 30000, currency: 'USD' }
  },
  newWarnings: [],
  portfolio: {
    change: { amount: -12000, currency: 'USD' },
    changePercentage: -0.12,
    valueAfter: { amount: 88000, currency: 'USD' },
    valueBefore: { amount: 100000, currency: 'USD' }
  },
  resolvedWarnings: [],
  scenario: {
    dataSource: 'YAHOO',
    dropPercentage: 0.4,
    name: 'Apple Inc.',
    symbol: 'AAPL'
  },
  score: { after: 70, before: 72, change: -2 }
};

function respond(status: number, body: unknown) {
  return Promise.resolve({
    json: () => Promise.resolve(body),
    ok: status >= 200 && status < 300,
    status
  } as Response);
}

describe('runWhatIf', () => {
  it('posts the request and returns the data on success', async () => {
    const postJson = jest.fn().mockResolvedValue({
      data: fullResult,
      error: null,
      meta: {}
    });

    const result = await runWhatIf(postJson, {
      dataSource: 'YAHOO',
      dropPercentage: 0.4,
      symbol: 'AAPL'
    });

    expect(postJson).toHaveBeenCalledWith('/api/v1/risk/what-if', {
      dataSource: 'YAHOO',
      dropPercentage: 0.4,
      symbol: 'AAPL'
    });
    expect(result).toEqual(fullResult);
  });

  it('throws a RiskApiError with the server message for RISK_WHATIF_HOLDING_NOT_FOUND', async () => {
    const postJson = jest.fn().mockResolvedValue({
      data: null,
      error: {
        code: 'RISK_WHATIF_HOLDING_NOT_FOUND',
        message: 'No open holding found for YAHOO:TSLA'
      },
      meta: {}
    });

    await expect(
      runWhatIf(postJson, {
        dataSource: 'YAHOO',
        dropPercentage: 0.4,
        symbol: 'TSLA'
      })
    ).rejects.toThrow(RiskApiError);
    await expect(
      runWhatIf(postJson, {
        dataSource: 'YAHOO',
        dropPercentage: 0.4,
        symbol: 'TSLA'
      })
    ).rejects.toThrow('No open holding found for YAHOO:TSLA');
  });

  it('throws a RiskApiError with the server message for RISK_WHATIF_INVALID_DROP', async () => {
    const postJson = jest.fn().mockResolvedValue({
      data: null,
      error: {
        code: 'RISK_WHATIF_INVALID_DROP',
        message: 'dropPercentage must be greater than 0 and at most 1, got 2'
      },
      meta: {}
    });

    await expect(
      runWhatIf(postJson, {
        dataSource: 'YAHOO',
        dropPercentage: 2,
        symbol: 'AAPL'
      })
    ).rejects.toThrow(
      'dropPercentage must be greater than 0 and at most 1, got 2'
    );
  });

  it('falls back to a generic message for an error code that is not known to be safe to display', async () => {
    const postJson = jest.fn().mockResolvedValue({
      data: null,
      error: {
        code: 'RISK_CALC_FAILED',
        message: 'NullPointerException at RiskEngine.java:412'
      },
      meta: {}
    });

    await expect(
      runWhatIf(postJson, {
        dataSource: 'YAHOO',
        dropPercentage: 0.4,
        symbol: 'AAPL'
      })
    ).rejects.toThrow('Could not run the simulation. Please try again.');
  });

  it('falls back to a generic message when the success response has no usable data', async () => {
    const postJson = jest.fn().mockResolvedValue({
      data: { unrelated: true },
      error: null,
      meta: {}
    });

    await expect(
      runWhatIf(postJson, {
        dataSource: 'YAHOO',
        dropPercentage: 0.4,
        symbol: 'AAPL'
      })
    ).rejects.toThrow('Could not run the simulation. Please try again.');
  });

  it('falls back to a generic message when a nested field is malformed, not just the four top-level keys', async () => {
    const postJson = jest.fn().mockResolvedValue({
      // holding.valueAfter is missing entirely - the top-level keys
      // (holding/portfolio/scenario/score) all look present.
      data: {
        ...fullResult,
        holding: { ...fullResult.holding, valueAfter: undefined }
      },
      error: null,
      meta: {}
    });

    await expect(
      runWhatIf(postJson, {
        dataSource: 'YAHOO',
        dropPercentage: 0.4,
        symbol: 'AAPL'
      })
    ).rejects.toThrow('Could not run the simulation. Please try again.');
  });

  it('falls back to a generic message when a warning in the array is malformed', async () => {
    const postJson = jest.fn().mockResolvedValue({
      data: {
        ...fullResult,
        newWarnings: [{ ruleKey: 'CONCENTRATION', severity: 'RED' }]
      },
      error: null,
      meta: {}
    });

    await expect(
      runWhatIf(postJson, {
        dataSource: 'YAHOO',
        dropPercentage: 0.4,
        symbol: 'AAPL'
      })
    ).rejects.toThrow('Could not run the simulation. Please try again.');
  });
});

describe('createWhatIfPostJson', () => {
  it('POSTs the body as JSON through the host fetch and returns the envelope', async () => {
    const request = jest.fn(() =>
      respond(200, { data: fullResult, error: null, meta: {} })
    );
    const postJson = createWhatIfPostJson(request);

    const envelope = await postJson('/api/v1/risk/what-if', {
      dataSource: 'YAHOO',
      dropPercentage: 0.4,
      symbol: 'AAPL'
    });

    expect(request).toHaveBeenCalledWith(
      '/api/v1/risk/what-if',
      expect.objectContaining({
        body: JSON.stringify({
          dataSource: 'YAHOO',
          dropPercentage: 0.4,
          symbol: 'AAPL'
        }),
        method: 'POST'
      })
    );
    expect(envelope).toEqual({ data: fullResult, error: null, meta: {} });
  });

  it('throws a RiskApiError when the response body is not valid JSON', async () => {
    const request = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.reject(new Error('not json')),
        ok: false,
        status: 502
      } as unknown as Response)
    );
    const postJson = createWhatIfPostJson(request);

    await expect(
      postJson('/api/v1/risk/what-if', { symbol: 'AAPL' })
    ).rejects.toThrow(RiskApiError);
  });
});

describe('fetchWhatIfHoldingOptions', () => {
  // PortfolioController's GET /portfolio/holdings predates the
  // { data, error, meta } envelope - it answers with { holdings } directly,
  // each holding's identity nested under assetProfile.
  it('maps active holdings to symbol/dataSource/name options, filtering by holdingType=ACTIVE', async () => {
    const request = jest.fn(() =>
      respond(200, {
        holdings: [
          {
            assetProfile: {
              dataSource: 'YAHOO',
              name: 'Apple Inc.',
              symbol: 'AAPL'
            },
            quantity: 100
          }
        ]
      })
    );

    const holdings = await fetchWhatIfHoldingOptions(request);

    expect(request).toHaveBeenCalledWith(
      '/api/v1/portfolio/holdings?holdingType=ACTIVE',
      expect.objectContaining({ method: 'GET' })
    );
    expect(holdings).toEqual([
      { dataSource: 'YAHOO', name: 'Apple Inc.', symbol: 'AAPL' }
    ]);
  });

  it('returns an empty list for an empty portfolio', async () => {
    const request = jest.fn(() => respond(200, { holdings: [] }));

    const holdings = await fetchWhatIfHoldingOptions(request);

    expect(holdings).toEqual([]);
  });

  it('throws a RiskApiError on a non-OK response', async () => {
    const request = jest.fn(() => respond(500, { message: 'server error' }));

    await expect(fetchWhatIfHoldingOptions(request)).rejects.toThrow(
      RiskApiError
    );
  });

  it('throws a RiskApiError when the body has no holdings array', async () => {
    const request = jest.fn(() => respond(200, { unrelated: true }));

    await expect(fetchWhatIfHoldingOptions(request)).rejects.toThrow(
      RiskApiError
    );
  });

  it('throws a RiskApiError when the response body is not valid JSON', async () => {
    const request = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.reject(new Error('not json')),
        ok: true,
        status: 200
      } as unknown as Response)
    );

    await expect(fetchWhatIfHoldingOptions(request)).rejects.toThrow(
      RiskApiError
    );
  });
});
