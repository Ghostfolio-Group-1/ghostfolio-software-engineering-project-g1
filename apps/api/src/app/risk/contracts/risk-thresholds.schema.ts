// JSON Schema for GET /api/v1/risk/thresholds and PUT/DELETE /:ruleKey
// Source: docs/sesha-notes/10-risk-api-contract.md, sections 6.8-6.10.

const riskThresholds = {
  type: 'object',
  additionalProperties: false,
  properties: {
    max: { type: 'number' },
    min: { type: 'number' },
    redMax: { type: 'number' },
    redMin: { type: 'number' }
  }
};

const item = {
  type: 'object',
  additionalProperties: false,
  required: [
    'defaults',
    'isActive',
    'isCustomized',
    'name',
    'ruleKey',
    'shape',
    'thresholds'
  ],
  properties: {
    defaults: riskThresholds,
    isActive: { type: 'boolean' },
    isCustomized: { type: 'boolean' },
    name: { type: 'string', minLength: 1 },
    ruleKey: { type: 'string', minLength: 1 },
    shape: { enum: ['band', 'ceiling'] },
    thresholds: riskThresholds
  }
};

export const riskThresholdsListResponseSchema = {
  $id: 'risk-thresholds-list-response',
  type: 'object',
  additionalProperties: false,
  required: ['data', 'error', 'meta'],
  properties: {
    data: { type: 'array', items: item },
    error: { type: 'null' },
    meta: { type: 'object' }
  }
};

export const riskThresholdItemResponseSchema = {
  $id: 'risk-threshold-item-response',
  type: 'object',
  additionalProperties: false,
  required: ['data', 'error', 'meta'],
  properties: {
    data: item,
    error: { type: 'null' },
    meta: { type: 'object' }
  }
};
