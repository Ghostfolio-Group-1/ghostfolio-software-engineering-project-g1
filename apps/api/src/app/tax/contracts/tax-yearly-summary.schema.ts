// JSON contract for GET /api/v1/tax/yearly-summary.
// All financial values, including nested records, are plain decimal strings.
const decimal = { type: 'string', pattern: '^-?\\d+(\\.\\d+)?$' };
const nullableDecimal = { anyOf: [decimal, { type: 'null' }] };
const nullableString = { type: ['string', 'null'] };
const isoUtc = {
  type: 'string',
  pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$'
};
const ids = { type: 'array', items: { type: 'string', minLength: 1 } };

function record(properties: Record<string, unknown>) {
  return {
    type: 'object',
    additionalProperties: false,
    required: Object.keys(properties),
    properties
  };
}

function diagnostic(code: string, idFields: string[]) {
  const properties: Record<string, unknown> = {
    code: { const: code },
    message: { type: 'string' }
  };
  for (const field of idFields) {
    properties[field] = ids;
  }
  return record(properties);
}

const currencySummary = record({
  currency: nullableString,
  totalGrossDividends: decimal,
  totalWithholdingTax: nullableDecimal,
  totalNetDividends: nullableDecimal,
  grossProceeds: decimal,
  grossCostBasis: decimal,
  grossRealizedGain: decimal,
  allocatedFees: decimal,
  realizedGainAfterActivityFees: decimal
});

const dividendRecord = record({
  sourceActivityId: { type: 'string', minLength: 1 },
  accountId: nullableString,
  symbolProfileId: { type: 'string', minLength: 1 },
  date: isoUtc,
  transactionCurrency: nullableString,
  grossDividend: decimal,
  withholdingTax: nullableDecimal,
  netDividend: nullableDecimal,
  activityFee: decimal,
  baseCurrency: { type: 'string' },
  grossDividendBaseCurrency: nullableDecimal,
  withholdingTaxBaseCurrency: nullableDecimal,
  netDividendBaseCurrency: nullableDecimal,
  activityFeeBaseCurrency: nullableDecimal
});

const realizedGain = record({
  accountId: nullableString,
  symbolProfileId: nullableString,
  sellActivityId: { type: 'string', minLength: 1 },
  sellDate: isoUtc,
  transactionCurrency: nullableString,
  sellQuantity: decimal,
  matchedQuantity: decimal,
  grossProceeds: decimal,
  grossCostBasis: decimal,
  grossRealizedGain: decimal,
  allocatedAcquisitionFees: decimal,
  allocatedSellFees: decimal,
  realizedGainAfterActivityFees: decimal,
  baseCurrency: { type: 'string' },
  totalActivityFees: decimal,
  grossProceedsBaseCurrency: nullableDecimal,
  grossCostBasisBaseCurrency: nullableDecimal,
  grossRealizedGainBaseCurrency: nullableDecimal,
  totalActivityFeesBaseCurrency: nullableDecimal,
  realizedGainAfterActivityFeesBaseCurrency: nullableDecimal
});

const warning = {
  oneOf: [
    diagnostic('TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY', [
      'affectedSellActivityIds',
      'excludedActivityIds'
    ]),
    diagnostic('UNKNOWN_DIVIDEND_WITHHOLDING', ['sourceActivityIds']),
    diagnostic('PARTIAL_REALIZED_GAIN_RESULT', ['sellActivityIds'])
  ]
};

const calculationError = {
  oneOf: [
    diagnostic('MISSING_DIVIDEND_BASE_CURRENCY_CONVERSION', [
      'sourceActivityIds'
    ]),
    diagnostic('MISSING_REALIZED_GAIN_BASE_CURRENCY_CONVERSION', [
      'sellActivityIds'
    ])
  ]
};

const data = record({
  year: { type: 'integer', minimum: 1970, maximum: 2100 },
  method: { enum: ['FIFO', 'AVERAGE_COST'] },
  baseCurrency: { type: 'string', minLength: 1 },
  calculatedAt: isoUtc,
  grossDividendsBaseCurrency: nullableDecimal,
  totalWithholdingTaxBaseCurrency: nullableDecimal,
  netDividendsBaseCurrency: nullableDecimal,
  grossProceedsBaseCurrency: nullableDecimal,
  grossCostBasisBaseCurrency: nullableDecimal,
  grossRealizedGainBaseCurrency: nullableDecimal,
  totalActivityFeesBaseCurrency: nullableDecimal,
  realizedGainAfterActivityFeesBaseCurrency: nullableDecimal,
  dividendCount: { type: 'integer', minimum: 0 },
  disposalCount: { type: 'integer', minimum: 0 },
  currencySummaries: { type: 'array', items: currencySummary },
  dividendRecords: { type: 'array', items: dividendRecord },
  realizedGains: { type: 'array', items: realizedGain },
  isComplete: { type: 'boolean' },
  warnings: { type: 'array', items: warning },
  errors: { type: 'array', items: calculationError }
});

export const taxYearlySummaryResponseSchema = {
  $id: 'tax-yearly-summary-response',
  type: 'object',
  additionalProperties: false,
  required: ['data', 'error', 'meta'],
  properties: {
    data,
    error: { type: 'null' },
    meta: { type: 'object' }
  }
};
