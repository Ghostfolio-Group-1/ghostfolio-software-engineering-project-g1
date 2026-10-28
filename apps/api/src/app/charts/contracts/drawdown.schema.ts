// JSON Schema for GET /api/v1/charts/drawdown
// (DrawdownResponse in the shared { data, meta, error } envelope).

const isoDate = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };

export const drawdownResponseSchema = {
  $id: 'drawdown-response',
  type: 'object',
  additionalProperties: false,
  required: ['data', 'error', 'meta'],
  properties: {
    data: {
      type: 'object',
      additionalProperties: false,
      required: [
        'endDate',
        'granularity',
        'maxDrawdown',
        'maxDrawdownDate',
        'points',
        'startDate'
      ],
      properties: {
        endDate: isoDate,
        granularity: { enum: ['daily', 'weekly'] },
        maxDrawdown: { type: 'number' },
        maxDrawdownDate: isoDate,
        points: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['date', 'drawdown', 'isNewPeak'],
            properties: {
              date: isoDate,
              drawdown: { type: 'number' },
              isNewPeak: { type: 'boolean' }
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
