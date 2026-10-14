// JSON Schema for GET /api/v1/charts/series (ChartSeriesResponse in the
// shared { data, meta, error } envelope).

const isoDate = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };

export const chartSeriesResponseSchema = {
  $id: 'chart-series-response',
  type: 'object',
  additionalProperties: false,
  required: ['data', 'error', 'meta'],
  properties: {
    data: {
      type: 'object',
      additionalProperties: false,
      required: ['endDate', 'granularity', 'kind', 'points', 'startDate'],
      properties: {
        endDate: isoDate,
        granularity: { enum: ['daily', 'weekly'] },
        kind: { enum: ['cash', 'investedCapital', 'portfolioValue'] },
        points: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['date', 'value'],
            properties: { date: isoDate, value: { type: 'number' } }
          }
        },
        startDate: isoDate
      }
    },
    error: { type: 'null' },
    meta: { type: 'object' }
  }
};

export const chartsErrorResponseSchema = {
  $id: 'charts-error-response',
  type: 'object',
  additionalProperties: false,
  required: ['data', 'error', 'meta'],
  properties: {
    data: { type: 'null' },
    error: {
      type: 'object',
      additionalProperties: false,
      required: ['code', 'message'],
      properties: {
        code: { type: 'string', pattern: '^CHARTS_[A-Z_]+$' },
        message: { type: 'string', minLength: 1 }
      }
    },
    meta: { type: 'object' }
  }
};
