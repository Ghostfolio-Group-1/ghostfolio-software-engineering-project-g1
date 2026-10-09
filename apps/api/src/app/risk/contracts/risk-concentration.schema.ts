// JSON Schema for GET /api/v1/risk/concentration
// Source: docs/sesha-notes/10-risk-api-contract.md, sections 6.4 and 7.

const decimal = { type: 'number', minimum: 0, maximum: 1 };

const bucket = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'percentage', 'severity', 'value'],
  properties: {
    name: { type: 'string', minLength: 1 },
    percentage: decimal,
    severity: { enum: ['GREEN', 'NO_DATA', 'RED', 'YELLOW'] },
    value: { type: 'string', minLength: 1 }
  }
};

const thresholds = {
  anyOf: [
    { type: 'null' },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        max: decimal,
        min: decimal,
        redMax: decimal,
        redMin: decimal
      }
    }
  ]
};

const group = {
  type: 'object',
  additionalProperties: false,
  required: ['buckets', 'thresholds'],
  properties: {
    buckets: { type: 'array', maxItems: 20, items: bucket },
    thresholds
  }
};

export const riskConcentrationResponseSchema = {
  $id: 'risk-concentration-response',
  type: 'object',
  additionalProperties: false,
  required: ['data', 'error', 'meta'],
  properties: {
    data: {
      type: 'object',
      additionalProperties: false,
      required: ['country', 'currency', 'sector', 'stock'],
      properties: {
        country: group,
        currency: group,
        sector: group,
        stock: group
      }
    },
    error: { type: 'null' },
    meta: { type: 'object' }
  }
};

export const riskErrorResponseSchema = {
  $id: 'risk-error-response',
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
        code: { type: 'string', pattern: '^RISK_[A-Z_]+$' },
        message: { type: 'string', minLength: 1 }
      }
    },
    meta: { type: 'object' }
  }
};
