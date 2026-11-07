// JSON Schema for GET /api/v1/risk/warnings
// Source: docs/sesha-notes/10-risk-api-contract.md, sections 6.3 and 7.

const warning = {
  type: 'object',
  additionalProperties: false,
  required: [
    'actual',
    'message',
    'ruleKey',
    'severity',
    'subject',
    'threshold'
  ],
  properties: {
    actual: { type: 'number' },
    message: { type: 'string', minLength: 1 },
    ruleKey: { type: 'string', minLength: 1 },
    severity: { enum: ['RED', 'YELLOW'] },
    subject: {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'value'],
      properties: {
        type: {
          enum: [
            'bucket',
            'country',
            'currency',
            'portfolio',
            'sector',
            'stock'
          ]
        },
        value: { type: 'string', minLength: 1 }
      }
    },
    threshold: { type: 'number' }
  }
};

export const riskWarningsResponseSchema = {
  $id: 'risk-warnings-response',
  type: 'object',
  additionalProperties: false,
  required: ['data', 'error', 'meta'],
  properties: {
    data: { type: 'array', items: warning },
    error: { type: 'null' },
    meta: {
      type: 'object',
      additionalProperties: false,
      required: ['page', 'pageSize', 'total'],
      properties: {
        page: { type: 'integer', minimum: 1 },
        pageSize: { type: 'integer', minimum: 1 },
        total: { type: 'integer', minimum: 0 }
      }
    }
  }
};
