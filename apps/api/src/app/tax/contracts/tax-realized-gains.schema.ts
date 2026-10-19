// JSON Schema for GET /api/v1/tax/realized-gains (TaxRealizedGainsResponse in
// the shared envelope). Amounts are decimal strings.

const decimal = { type: 'string', pattern: '^-?\\d+(\\.\\d+)?$' };

const match = {
  type: 'object',
  additionalProperties: false,
  required: [
    'buyActivityId',
    'buyFeeAllocated',
    'grossAcquisitionValue',
    'grossProceeds',
    'grossRealizedGain',
    'lotId',
    'matchedQuantity',
    'realizedGainAfterActivityFees',
    'sellActivityId',
    'sellFeeAllocated'
  ],
  properties: {
    buyActivityId: { type: 'string', minLength: 1 },
    buyFeeAllocated: decimal,
    grossAcquisitionValue: decimal,
    grossProceeds: decimal,
    grossRealizedGain: decimal,
    lotId: { type: 'string', minLength: 1 },
    matchedQuantity: decimal,
    realizedGainAfterActivityFees: decimal,
    sellActivityId: { type: 'string', minLength: 1 },
    sellFeeAllocated: decimal
  }
};

const sale = {
  type: 'object',
  additionalProperties: false,
  required: [
    'allocatedBuyFees',
    'allocatedSellFee',
    'currency',
    'grossCostBasis',
    'grossProceeds',
    'grossRealizedGain',
    'matchedQuantity',
    'matches',
    'realizedGainAfterActivityFees',
    'sellActivityId',
    'sellDate',
    'sellFee',
    'sellQuantity'
  ],
  properties: {
    allocatedBuyFees: decimal,
    allocatedSellFee: decimal,
    currency: { type: ['string', 'null'] },
    grossCostBasis: decimal,
    grossProceeds: decimal,
    grossRealizedGain: decimal,
    matchedQuantity: decimal,
    matches: { type: 'array', items: match },
    realizedGainAfterActivityFees: decimal,
    sellActivityId: { type: 'string', minLength: 1 },
    sellDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}T' },
    sellFee: decimal,
    sellQuantity: decimal
  }
};

export const taxRealizedGainsResponseSchema = {
  $id: 'tax-realized-gains-response',
  type: 'object',
  additionalProperties: false,
  required: ['data', 'error', 'meta'],
  properties: {
    data: {
      type: 'object',
      additionalProperties: false,
      required: ['method', 'sales'],
      properties: {
        method: { const: 'FIFO' },
        sales: { type: 'array', items: sale }
      }
    },
    error: { type: 'null' },
    meta: { type: 'object' }
  }
};

export const taxErrorResponseSchema = {
  $id: 'tax-error-response',
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
        code: { type: 'string', pattern: '^TAX_[A-Z_]+$' },
        message: { type: 'string', minLength: 1 }
      }
    },
    meta: { type: 'object' }
  }
};
