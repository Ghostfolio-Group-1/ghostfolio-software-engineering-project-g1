// JSON Schema for GET/PUT/DELETE /api/v1/risk/target-allocation
// Source: docs/sesha-notes/10-risk-api-contract.md, sections 6.5-6.7.

const thresholds = {
  anyOf: [
    { type: 'null' },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        max: { type: 'number' },
        min: { type: 'number' },
        redMax: { type: 'number' },
        redMin: { type: 'number' }
      }
    }
  ]
};

const bucket = {
  type: 'object',
  additionalProperties: false,
  required: ['actual', 'deviation', 'key', 'severity', 'target'],
  properties: {
    actual: { type: 'number' },
    deviation: { type: 'number' },
    key: { type: 'string', minLength: 1 },
    severity: { enum: ['GREEN', 'NO_DATA', 'RED', 'YELLOW'] },
    target: { type: 'number' }
  }
};

export const targetAllocationResponseSchema = {
  $id: 'target-allocation-response',
  type: 'object',
  additionalProperties: false,
  required: ['data', 'error', 'meta'],
  properties: {
    data: {
      type: 'object',
      additionalProperties: false,
      required: ['buckets', 'groupBy', 'isSet', 'targets', 'thresholds'],
      properties: {
        buckets: { type: 'array', items: bucket },
        groupBy: {
          enum: ['assetClass', 'country', 'currency', 'sector', 'symbol', null]
        },
        isSet: { type: 'boolean' },
        targets: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['key', 'percentage'],
            properties: {
              key: { type: 'string' },
              percentage: { type: 'number' }
            }
          }
        },
        thresholds
      }
    },
    error: { type: 'null' },
    meta: { type: 'object' }
  }
};
