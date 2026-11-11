// JSON Schema for GET /api/v1/charts/return-comparison
// (ReturnComparisonResponse in the shared { data, meta, error } envelope).

const isoDate = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };

export const returnComparisonResponseSchema = {
  $id: 'return-comparison-response',
  type: 'object',
  additionalProperties: false,
  required: ['data', 'error', 'meta'],
  properties: {
    data: {
      type: 'object',
      additionalProperties: false,
      required: ['endDate', 'granularity', 'points', 'startDate'],
      properties: {
        endDate: isoDate,
        granularity: { enum: ['daily', 'weekly'] },
        points: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['date', 'priceReturn', 'totalReturn'],
            properties: {
              date: isoDate,
              priceReturn: { type: 'number' },
              totalReturn: { type: 'number' }
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
