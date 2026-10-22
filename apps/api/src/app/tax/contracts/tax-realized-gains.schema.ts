// JSON Schema for GET /api/v1/tax/realized-gains (TaxRealizedGainsResponse in
// the shared envelope). Amounts are decimal strings.

const decimal = { type: 'string', pattern: '^-?\\d+(\\.\\d+)?$' };

const diagnostic = {
  type: 'object',
  additionalProperties: false,
  required: [
    'affectedSellActivityIds',
    'code',
    'excludedActivityIds',
    'message'
  ],
  properties: {
    affectedSellActivityIds: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1
      }
    },
    code: {
      const: 'TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY'
    },
    excludedActivityIds: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1
      }
    },
    message: {
      type: 'string',
      minLength: 1
    }
  }
};

const completenessProperties = {
  diagnostics: {
    type: 'array',
    minItems: 1,
    items: diagnostic
  },
  isComplete: {
    const: false
  }
};

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

const commonSaleRequired = [
  'allocatedAcquisitionFees',
  'allocatedSellFee',
  'currency',
  'grossCostBasis',
  'grossProceeds',
  'grossRealizedGain',
  'matchedQuantity',
  'realizedGainAfterActivityFees',
  'sellActivityId',
  'sellDate',
  'sellFee',
  'sellQuantity'
];

const commonSaleProperties = {
  allocatedAcquisitionFees: decimal,
  allocatedSellFee: decimal,
  currency: { type: ['string', 'null'] },
  grossCostBasis: decimal,
  grossProceeds: decimal,
  grossRealizedGain: decimal,
  matchedQuantity: decimal,
  realizedGainAfterActivityFees: decimal,
  sellActivityId: { type: 'string', minLength: 1 },
  sellDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}T' },
  sellFee: decimal,
  sellQuantity: decimal
};

const fifoSale = {
  type: 'object',
  additionalProperties: false,
  required: [...commonSaleRequired, 'allocatedBuyFees', 'matches'],
  properties: {
    ...commonSaleProperties,
    allocatedBuyFees: decimal,
    matches: { type: 'array', items: match }
  }
};

const averageCostPool = {
  type: 'object',
  additionalProperties: false,
  required: ['acquisitionFeePool', 'grossCost', 'quantity'],
  properties: {
    acquisitionFeePool: decimal,
    grossCost: decimal,
    quantity: decimal
  }
};

const averageCostSale = {
  type: 'object',
  additionalProperties: false,
  required: [...commonSaleRequired, 'poolAfter', 'poolBefore'],
  properties: {
    ...commonSaleProperties,
    poolAfter: averageCostPool,
    poolBefore: averageCostPool
  }
};

const fifoData = {
  type: 'object',
  additionalProperties: false,
  required: ['method', 'sales'],
  dependencies: {
    diagnostics: ['isComplete'],
    isComplete: ['diagnostics']
  },
  properties: {
    ...completenessProperties,
    method: { const: 'FIFO' },
    sales: { type: 'array', items: fifoSale }
  }
};

const averageCostData = {
  type: 'object',
  additionalProperties: false,
  required: ['method', 'sales'],
  dependencies: {
    diagnostics: ['isComplete'],
    isComplete: ['diagnostics']
  },
  properties: {
    ...completenessProperties,
    method: { const: 'AVERAGE_COST' },
    sales: { type: 'array', items: averageCostSale }
  }
};

export const taxRealizedGainsResponseSchema = {
  $id: 'tax-realized-gains-response',
  type: 'object',
  additionalProperties: false,
  required: ['data', 'error', 'meta'],
  properties: {
    data: {
      oneOf: [fifoData, averageCostData]
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
