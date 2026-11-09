import { RiskApiError } from '../risk-dashboard/risk-dashboard.client';
import { runWhatIf } from './what-if-simulator.client';

describe('runWhatIf', () => {
  it('posts the request and returns the data on success', async () => {
    const postJson = jest.fn().mockResolvedValue({
      data: { scenario: { name: 'Apple Inc.' } },
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
    expect(result).toEqual({ scenario: { name: 'Apple Inc.' } });
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
});
