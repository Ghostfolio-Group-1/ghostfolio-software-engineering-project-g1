// Response schema for GET /api/v1/tax/dividends?year=YYYY.
// Financial values are plain decimal strings, never JSON numbers.
const decimal = { type: 'string', pattern: '^-?\\d+(\\.\\d+)?$' };

const dividendRecord = {
  type: 'object',
  additionalProperties: false,
  required: [
    'accountId',
    'activityFee',
    'date',
    'grossDividend',
    'netDividend',
    'sourceActivityId',
    'symbolProfileId',
    'transactionCurrency',
    'withholdingTax'
  ],
  properties: {
    accountId: { type: ['string', 'null'] },
    activityFee: decimal,
    date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}T' },
    grossDividend: decimal,
    netDividend: { anyOf: [decimal, { type: 'null' }] },
    sourceActivityId: { type: 'string', minLength: 1 },
    symbolProfileId: { type: 'string', minLength: 1 },
    transactionCurrency: { type: ['string', 'null'] },
    withholdingTax: { anyOf: [decimal, { type: 'null' }] }
  }
};

export const taxDividendsResponseSchema = {
  $id: 'tax-dividends-response',
  type: 'object',
  additionalProperties: false,
  required: ['data', 'error', 'meta'],
  properties: {
    data: {
      type: 'object',
      additionalProperties: false,
      required: ['records'],
      properties: {
        records: { type: 'array', items: dividendRecord }
      }
    },
    error: { type: 'null' },
    meta: { type: 'object' }
  }
};
