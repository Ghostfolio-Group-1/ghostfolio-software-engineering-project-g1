// JSON Schema for GET /api/v1/risk/score
// Source: docs/sesha-notes/10-risk-api-contract.md, sections 6.2 and 7.

const severity = { enum: ['GREEN', 'NO_DATA', 'RED', 'YELLOW'] };

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

const rule = {
  type: 'object',
  additionalProperties: false,
  required: [
    'actual',
    'isActive',
    'key',
    'message',
    'name',
    'passed',
    'severity',
    'thresholds',
    'weight'
  ],
  properties: {
    actual: { type: ['number', 'null'] },
    isActive: { type: 'boolean' },
    key: { type: 'string', minLength: 1 },
    message: { type: 'string' },
    name: { type: 'string', minLength: 1 },
    passed: { type: ['boolean', 'null'] },
    severity,
    thresholds,
    weight: { type: 'number' }
  }
};

const category = {
  type: 'object',
  additionalProperties: false,
  required: ['key', 'name', 'rules', 'score', 'severity', 'weight'],
  properties: {
    key: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    rules: { anyOf: [{ type: 'null' }, { type: 'array', items: rule }] },
    score: { type: ['number', 'null'] },
    severity,
    weight: { type: 'number' }
  }
};

export const riskScoreResponseSchema = {
  $id: 'risk-score-response',
  type: 'object',
  additionalProperties: false,
  required: ['data', 'error', 'meta'],
  properties: {
    data: {
      type: 'object',
      additionalProperties: false,
      required: [
        'activeWeight',
        'calculatedAt',
        'categories',
        'excluded',
        'grade',
        'score',
        'severity',
        'unavailableReason'
      ],
      properties: {
        activeWeight: { type: 'number' },
        calculatedAt: {},
        categories: { type: 'array', items: category },
        excluded: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['key', 'reason'],
            properties: {
              key: { type: 'string' },
              reason: { type: 'string' }
            }
          }
        },
        grade: { type: ['string', 'null'] },
        score: { type: ['number', 'null'] },
        severity,
        unavailableReason: { type: ['string', 'null'] }
      }
    },
    error: { type: 'null' },
    meta: { type: 'object' }
  }
};
