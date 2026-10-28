import {
  ApiResponse,
  DecimalPercentage,
  MoneyAmount,
  createApiErrorCode,
  createErrorResponse,
  createSuccessResponse
} from './api-conventions';

describe('api-conventions', () => {
  it('should wrap data in the success envelope', () => {
    const value: MoneyAmount = { amount: 1250.75, currency: 'USD' };
    const response = createSuccessResponse(value);

    expect(response).toEqual({
      data: { amount: 1250.75, currency: 'USD' },
      error: null,
      meta: {}
    });
  });

  it('should keep pagination meta on list responses', () => {
    const response = createSuccessResponse([1, 2, 3], {
      page: 2,
      pageSize: 3,
      total: 8
    });

    expect(response.meta.page).toBe(2);
    expect(response.meta.pageSize).toBe(3);
    expect(response.meta.total).toBe(8);
  });

  it('should build feature-prefixed error codes', () => {
    expect(createApiErrorCode('tax', 'LOT_NOT_FOUND')).toBe(
      'TAX_LOT_NOT_FOUND'
    );
  });

  it('should wrap errors with null data', () => {
    const response: ApiResponse<MoneyAmount> = createErrorResponse(
      'RISK_INVALID_RANGE',
      'Range is not supported'
    );

    expect(response.data).toBeNull();
    expect(response.error).toEqual({
      code: 'RISK_INVALID_RANGE',
      message: 'Range is not supported'
    });
  });

  it('should express percentages as decimals', () => {
    const allocation: DecimalPercentage = 0.125;

    expect(allocation * 100).toBeCloseTo(12.5);
  });
});
