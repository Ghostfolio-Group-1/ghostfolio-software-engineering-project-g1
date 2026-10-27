// JSON Schema for GET /api/v1/charts/benchmark-comparison
// (BenchmarkComparisonResponse in the shared { data, meta, error } envelope).

const isoDate = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };

export const benchmarkComparisonResponseSchema = {
  $id: 'benchmark-comparison-response',
  type: 'object',
  additionalProperties: false,
  required: ['data', 'error', 'meta'],
  properties: {
    data: {
      type: 'object',
      additionalProperties: false,
      required: [
        'benchmarkAvailableFrom',
        'benchmarkSymbol',
        'endDate',
        'granularity',
        'points',
        'startDate'
      ],
      properties: {
        benchmarkAvailableFrom: isoDate,
        benchmarkSymbol: { type: 'string', minLength: 1 },
        endDate: isoDate,
        granularity: { enum: ['daily', 'weekly'] },
        points: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['date', 'portfolioReturn', 'benchmarkReturn'],
            properties: {
              date: isoDate,
              portfolioReturn: { type: 'number' },
              benchmarkReturn: { type: 'number' }
            }
          }
        },
        startDate: isoDate
      }
    },
    error: { type: 'null' },
    meta: { type: 'object' }
  }
};
