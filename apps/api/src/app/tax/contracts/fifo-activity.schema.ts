// JSON Schema for the activities TaxDataService hands to the FIFO engine.
// Source: FifoTaxActivitySource in fifo-tax-lot.ts; ordering per DR-3.

export const fifoActivitiesSchema = {
  $id: 'fifo-activities',
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    required: [
      'accountId',
      'currency',
      'date',
      'id',
      'quantity',
      'symbolProfileId',
      'type',
      'userId'
    ],
    properties: {
      accountId: { type: ['string', 'null'] },
      currency: { type: ['string', 'null'] },
      date: {
        type: 'string',
        pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z$'
      },
      id: { type: 'string', minLength: 1 },
      quantity: { type: 'number', exclusiveMinimum: 0 },
      symbolProfileId: { type: 'string', minLength: 1 },
      type: { enum: ['BUY', 'SELL'] },
      userId: { type: 'string', minLength: 1 }
    }
  }
};
