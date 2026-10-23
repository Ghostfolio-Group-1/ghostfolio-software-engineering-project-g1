const decimal = {
  type: 'string',
  pattern: '^-?\\d+(\\.\\d+)?$'
};

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

const taxLot = {
  type: 'object',
  additionalProperties: false,
  required: [
    'accountId',
    'acquiredAt',
    'consumedQuantity',
    'currency',
    'lotId',
    'originalQuantity',
    'relatedSellActivityIds',
    'remainingQuantity',
    'sourceActivityId',
    'status',
    'symbolProfileId'
  ],
  properties: {
    accountId: {
      type: ['string', 'null']
    },
    acquiredAt: {
      type: 'string',
      pattern: '^\\d{4}-\\d{2}-\\d{2}T'
    },
    consumedQuantity: decimal,
    currency: {
      type: ['string', 'null']
    },
    lotId: {
      type: 'string',
      minLength: 1
    },
    originalQuantity: decimal,
    relatedSellActivityIds: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1
      }
    },
    remainingQuantity: decimal,
    sourceActivityId: {
      type: 'string',
      minLength: 1
    },
    status: {
      enum: ['OPEN', 'PARTIALLY_CONSUMED', 'CLOSED']
    },
    symbolProfileId: {
      type: 'string',
      minLength: 1
    }
  }
};

export const taxLotsResponseSchema = {
  $id: 'tax-lots-response',
  type: 'object',
  additionalProperties: false,
  required: ['data', 'error', 'meta'],
  properties: {
    data: {
      type: 'object',
      additionalProperties: false,
      required: ['lots'],
      dependencies: {
        diagnostics: ['isComplete'],
        isComplete: ['diagnostics']
      },
      properties: {
        diagnostics: {
          type: 'array',
          minItems: 1,
          items: diagnostic
        },
        isComplete: {
          const: false
        },
        lots: {
          type: 'array',
          items: taxLot
        }
      }
    },
    error: {
      type: 'null'
    },
    meta: {
      type: 'object'
    }
  }
};
