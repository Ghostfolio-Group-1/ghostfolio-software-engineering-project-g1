import { Type as ActivityType } from '@prisma/client';
import { Big } from 'big.js';

import {
  calculateAverageCostRealizedGains,
  AverageCostRealizedGainSale
} from './average-cost-realized-gain';
import { createDividendRecord, DividendRecord } from './dividend-record';
import {
  calculateFifoRealizedGains,
  FifoRealizedGainSale
} from './fifo-realized-gain';
import {
  BaseCurrencyRateResolver,
  calculateYearlyTaxSummary,
  MISSING_DIVIDEND_BASE_CURRENCY_CONVERSION,
  MISSING_REALIZED_GAIN_BASE_CURRENCY_CONVERSION,
  UNKNOWN_DIVIDEND_WITHHOLDING,
  YearlyRealizedGainSource
} from './yearly-tax-summary';

const CALCULATED_AT = new Date('2026-10-23T12:00:00.000Z');

describe('calculateYearlyTaxSummary', () => {
  it('returns known zero totals for an empty year', async () => {
    const summary = await calculateYearlyTaxSummary({
      baseCurrency: 'USD',
      calculatedAt: CALCULATED_AT,
      dividendRecords: [],
      getBaseCurrencyRate: createRateResolver({
        USD: '1'
      }),
      method: 'FIFO',
      realizedGains: [],
      year: 2026
    });

    expect(summary.year).toBe(2026);
    expect(summary.method).toBe('FIFO');
    expect(summary.baseCurrency).toBe('USD');

    expect(summary.grossDividendsBaseCurrency?.toString()).toBe('0');
    expect(summary.totalWithholdingTaxBaseCurrency?.toString()).toBe('0');
    expect(summary.netDividendsBaseCurrency?.toString()).toBe('0');

    expect(summary.grossProceedsBaseCurrency?.toString()).toBe('0');
    expect(summary.grossCostBasisBaseCurrency?.toString()).toBe('0');
    expect(summary.grossRealizedGainBaseCurrency?.toString()).toBe('0');

    expect(summary.totalActivityFeesBaseCurrency?.toString()).toBe('0');

    expect(summary.realizedGainAfterActivityFeesBaseCurrency?.toString()).toBe(
      '0'
    );

    expect(summary.dividendCount).toBe(0);
    expect(summary.disposalCount).toBe(0);

    expect(summary.currencySummaries).toEqual([]);
    expect(summary.dividendRecords).toEqual([]);
    expect(summary.realizedGains).toEqual([]);

    expect(summary.isComplete).toBe(true);
    expect(summary.warnings).toEqual([]);
    expect(summary.errors).toEqual([]);
  });

  it('aggregates dividends per currency and converts them to base currency', async () => {
    const dividends = [
      createDividend({
        currency: 'USD',
        id: 'dividend-usd',
        quantity: 10,
        unitPrice: 10,
        withholdingTax: 15
      }),
      createDividend({
        currency: 'EUR',
        id: 'dividend-eur',
        quantity: 5,
        unitPrice: 10,
        withholdingTax: 5
      })
    ];

    const summary = await calculateYearlyTaxSummary({
      baseCurrency: 'USD',
      calculatedAt: CALCULATED_AT,
      dividendRecords: dividends,
      getBaseCurrencyRate: createRateResolver({
        EUR: '1.2',
        USD: '1'
      }),
      method: 'FIFO',
      realizedGains: [],
      year: 2026
    });

    expect(summary.grossDividendsBaseCurrency?.toString()).toBe('160');
    expect(summary.totalWithholdingTaxBaseCurrency?.toString()).toBe('21');
    expect(summary.netDividendsBaseCurrency?.toString()).toBe('139');

    expect(summary.dividendCount).toBe(2);
    expect(summary.isComplete).toBe(true);

    const eur = summary.currencySummaries.find(
      ({ currency }) => currency === 'EUR'
    );

    const usd = summary.currencySummaries.find(
      ({ currency }) => currency === 'USD'
    );

    expect(eur?.totalGrossDividends.toString()).toBe('50');
    expect(eur?.totalWithholdingTax?.toString()).toBe('5');
    expect(eur?.totalNetDividends?.toString()).toBe('45');

    expect(usd?.totalGrossDividends.toString()).toBe('100');
    expect(usd?.totalWithholdingTax?.toString()).toBe('15');
    expect(usd?.totalNetDividends?.toString()).toBe('85');
  });

  it('preserves unknown withholding as null instead of zero', async () => {
    const summary = await calculateYearlyTaxSummary({
      baseCurrency: 'USD',
      calculatedAt: CALCULATED_AT,
      dividendRecords: [
        createDividend({
          id: 'unknown-withholding',
          withholdingTax: null
        })
      ],
      getBaseCurrencyRate: createRateResolver({
        USD: '1'
      }),
      method: 'FIFO',
      realizedGains: [],
      year: 2026
    });

    expect(summary.grossDividendsBaseCurrency?.toString()).toBe('100');

    expect(summary.totalWithholdingTaxBaseCurrency).toBeNull();
    expect(summary.netDividendsBaseCurrency).toBeNull();

    expect(summary.dividendCount).toBe(1);

    expect(summary.dividendRecords[0].withholdingTax).toBeNull();
    expect(summary.dividendRecords[0].netDividend).toBeNull();

    expect(summary.isComplete).toBe(false);

    expect(summary.warnings).toEqual([
      {
        code: UNKNOWN_DIVIDEND_WITHHOLDING,
        message:
          'One or more dividend activities have unknown withholding tax, so complete withholding and net-dividend totals are unavailable.',
        sourceActivityIds: ['unknown-withholding']
      }
    ]);
  });

  it('marks dividend base-currency totals unavailable when historical FX is missing', async () => {
    const summary = await calculateYearlyTaxSummary({
      baseCurrency: 'USD',
      calculatedAt: CALCULATED_AT,
      dividendRecords: [
        createDividend({
          currency: 'EUR',
          id: 'missing-fx',
          withholdingTax: 5
        })
      ],
      getBaseCurrencyRate: createRateResolver({
        EUR: null,
        USD: '1'
      }),
      method: 'FIFO',
      realizedGains: [],
      year: 2026
    });

    expect(summary.grossDividendsBaseCurrency).toBeNull();
    expect(summary.totalWithholdingTaxBaseCurrency).toBeNull();
    expect(summary.netDividendsBaseCurrency).toBeNull();

    expect(summary.isComplete).toBe(false);

    expect(summary.errors).toEqual([
      {
        code: MISSING_DIVIDEND_BASE_CURRENCY_CONVERSION,
        message:
          'Historical base-currency conversion is unavailable for one or more dividend activities.',
        sourceActivityIds: ['missing-fx']
      }
    ]);

    const eur = summary.currencySummaries.find(
      ({ currency }) => currency === 'EUR'
    );

    expect(eur?.totalGrossDividends.toString()).toBe('100');
    expect(eur?.totalWithholdingTax?.toString()).toBe('5');
    expect(eur?.totalNetDividends?.toString()).toBe('95');
  });

  it('converts each realized-gain row at its SELL date before aggregating totals', async () => {
    const firstSellDate = new Date('2026-03-01T00:00:00.000Z');
    const secondSellDate = new Date('2026-09-01T00:00:00.000Z');

    const ratesByDate: Record<string, string> = {
      [firstSellDate.toISOString()]: '1.1',
      [secondSellDate.toISOString()]: '1.2'
    };

    const getBaseCurrencyRate: BaseCurrencyRateResolver = async ({ date }) => {
      const rate = ratesByDate[date.toISOString()];

      return rate ? new Big(rate) : null;
    };

    const summary = await calculateYearlyTaxSummary({
      baseCurrency: 'USD',
      calculatedAt: CALCULATED_AT,
      dividendRecords: [],
      getBaseCurrencyRate,
      method: 'FIFO',
      realizedGains: [
        createRealizedGainSource({
          sellActivityId: 'sell-march',
          sellDate: firstSellDate,
          transactionCurrency: 'EUR'
        }),
        createRealizedGainSource({
          sellActivityId: 'sell-september',
          sellDate: secondSellDate,
          transactionCurrency: 'EUR'
        })
      ],
      year: 2026
    });

    expect(summary.realizedGains[0].grossProceedsBaseCurrency?.toString()).toBe(
      '110'
    );

    expect(summary.realizedGains[1].grossProceedsBaseCurrency?.toString()).toBe(
      '120'
    );

    expect(summary.grossProceedsBaseCurrency?.toString()).toBe('230');
    expect(summary.grossCostBasisBaseCurrency?.toString()).toBe('138');
    expect(summary.grossRealizedGainBaseCurrency?.toString()).toBe('92');
    expect(summary.totalActivityFeesBaseCurrency?.toString()).toBe('4.6');

    expect(summary.realizedGainAfterActivityFeesBaseCurrency?.toString()).toBe(
      '87.4'
    );

    expect(summary.isComplete).toBe(true);
  });

  it('marks realized-gain base-currency totals unavailable when SELL-date FX is missing', async () => {
    const summary = await calculateYearlyTaxSummary({
      baseCurrency: 'USD',
      calculatedAt: CALCULATED_AT,
      dividendRecords: [],
      getBaseCurrencyRate: createRateResolver({
        EUR: null
      }),
      method: 'FIFO',
      realizedGains: [
        createRealizedGainSource({
          sellActivityId: 'sell-missing-fx',
          sellDate: new Date('2026-06-01T00:00:00.000Z'),
          transactionCurrency: 'EUR'
        })
      ],
      year: 2026
    });

    expect(summary.grossProceedsBaseCurrency).toBeNull();
    expect(summary.grossCostBasisBaseCurrency).toBeNull();
    expect(summary.grossRealizedGainBaseCurrency).toBeNull();
    expect(summary.totalActivityFeesBaseCurrency).toBeNull();
    expect(summary.realizedGainAfterActivityFeesBaseCurrency).toBeNull();

    expect(summary.isComplete).toBe(false);

    expect(summary.errors).toEqual([
      {
        code: MISSING_REALIZED_GAIN_BASE_CURRENCY_CONVERSION,
        message:
          'Historical base-currency conversion is unavailable for one or more realized-gain activities.',
        sellActivityIds: ['sell-missing-fx']
      }
    ]);

    expect(summary.currencySummaries[0].grossProceeds.toString()).toBe('100');
  });

  it('preserves prior-year FIFO acquisition basis for a sale in the requested year', async () => {
    const result = calculateFifoRealizedGains([
      {
        accountId: 'account-1',
        currency: 'USD',
        date: new Date('2024-05-01T00:00:00.000Z'),
        fee: 2,
        id: 'buy-2024',
        quantity: 10,
        symbolProfileId: 'symbol-1',
        type: ActivityType.BUY,
        unitPrice: 10,
        userId: 'user-1'
      },
      {
        accountId: 'account-1',
        currency: 'USD',
        date: new Date('2026-06-01T00:00:00.000Z'),
        fee: 1,
        id: 'sell-2026',
        quantity: 4,
        symbolProfileId: 'symbol-1',
        type: ActivityType.SELL,
        unitPrice: 20,
        userId: 'user-1'
      }
    ]);

    const summary = await calculateYearlyTaxSummary({
      baseCurrency: 'USD',
      calculatedAt: CALCULATED_AT,
      dividendRecords: [],
      getBaseCurrencyRate: createRateResolver({
        USD: '1'
      }),
      method: 'FIFO',
      realizedGains: result.sales.map(toFifoSummarySource),
      year: 2026
    });

    expect(summary.disposalCount).toBe(1);

    expect(summary.grossProceedsBaseCurrency?.toString()).toBe('80');
    expect(summary.grossCostBasisBaseCurrency?.toString()).toBe('40');
    expect(summary.grossRealizedGainBaseCurrency?.toString()).toBe('40');

    expect(summary.totalActivityFeesBaseCurrency?.toString()).toBe('1.8');

    expect(summary.realizedGainAfterActivityFeesBaseCurrency?.toString()).toBe(
      '38.2'
    );

    expect(summary.realizedGains[0].sellActivityId).toBe('sell-2026');

    expect(summary.isComplete).toBe(true);
  });

  it('supports average-cost results without mixing calculation methods', async () => {
    const result = calculateAverageCostRealizedGains([
      {
        accountId: 'account-1',
        currency: 'USD',
        date: new Date('2024-01-01T00:00:00.000Z'),
        fee: 0,
        id: 'buy-1',
        quantity: 10,
        symbolProfileId: 'symbol-1',
        type: ActivityType.BUY,
        unitPrice: 10,
        userId: 'user-1'
      },
      {
        accountId: 'account-2',
        currency: 'USD',
        date: new Date('2025-01-01T00:00:00.000Z'),
        fee: 0,
        id: 'buy-2',
        quantity: 10,
        symbolProfileId: 'symbol-1',
        type: ActivityType.BUY,
        unitPrice: 20,
        userId: 'user-1'
      },
      {
        accountId: 'account-2',
        currency: 'USD',
        date: new Date('2026-08-01T00:00:00.000Z'),
        fee: 0,
        id: 'sell-2026',
        quantity: 5,
        symbolProfileId: 'symbol-1',
        type: ActivityType.SELL,
        unitPrice: 30,
        userId: 'user-1'
      }
    ]);

    const summary = await calculateYearlyTaxSummary({
      baseCurrency: 'USD',
      calculatedAt: CALCULATED_AT,
      dividendRecords: [],
      getBaseCurrencyRate: createRateResolver({
        USD: '1'
      }),
      method: 'AVERAGE_COST',
      realizedGains: result.sales.map(toAverageCostSummarySource),
      year: 2026
    });

    expect(summary.method).toBe('AVERAGE_COST');
    expect(summary.disposalCount).toBe(1);

    expect(summary.grossProceedsBaseCurrency?.toString()).toBe('150');
    expect(summary.grossCostBasisBaseCurrency?.toString()).toBe('75');
    expect(summary.grossRealizedGainBaseCurrency?.toString()).toBe('75');

    expect(summary.isComplete).toBe(true);
  });

  it('includes the final millisecond of the requested UTC year and excludes the next year boundary', async () => {
    const finalSellInYear = createRealizedGainSource({
      sellActivityId: 'sell-2026-final',
      sellDate: new Date('2026-12-31T23:59:59.999Z')
    });

    const firstSellNextYear = createRealizedGainSource({
      sellActivityId: 'sell-2027-first',
      sellDate: new Date('2027-01-01T00:00:00.000Z')
    });

    const summary = await calculateYearlyTaxSummary({
      baseCurrency: 'USD',
      calculatedAt: CALCULATED_AT,
      dividendRecords: [],
      getBaseCurrencyRate: createRateResolver({
        USD: '1'
      }),
      method: 'FIFO',
      realizedGains: [finalSellInYear, firstSellNextYear],
      year: 2026
    });

    expect(summary.disposalCount).toBe(1);
    expect(summary.realizedGains).toHaveLength(1);

    expect(summary.realizedGains[0].sellActivityId).toBe('sell-2026-final');

    expect(summary.grossProceedsBaseCurrency?.toString()).toBe('100');
  });
});

function createDividend({
  currency = 'USD',
  date = new Date('2026-05-01T00:00:00.000Z'),
  fee = 0,
  id = 'dividend-1',
  quantity = 10,
  unitPrice = 10,
  withholdingTax = 15
}: {
  currency?: string | null;
  date?: Date;
  fee?: number;
  id?: string;
  quantity?: number;
  unitPrice?: number;
  withholdingTax?: number | null;
} = {}): DividendRecord {
  return createDividendRecord({
    accountId: 'account-1',
    currency,
    date,
    fee,
    id,
    quantity,
    symbolProfileId: 'symbol-1',
    type: ActivityType.DIVIDEND,
    unitPrice,
    withholdingTax
  });
}

function createRateResolver(
  rates: Record<string, string | null>
): BaseCurrencyRateResolver {
  return async ({ currency }) => {
    if (currency === null) {
      return null;
    }

    const rate = rates[currency];

    if (rate === undefined || rate === null) {
      return null;
    }

    return new Big(rate);
  };
}

function toFifoSummarySource(
  sale: FifoRealizedGainSale
): YearlyRealizedGainSource {
  return {
    sellActivityId: sale.sellActivityId,
    sellDate: sale.sellDate,
    transactionCurrency: sale.currency,

    sellQuantity: sale.sellQuantity,
    matchedQuantity: sale.matchedQuantity,

    grossProceeds: sale.grossProceeds,
    grossCostBasis: sale.grossCostBasis,
    grossRealizedGain: sale.grossRealizedGain,

    allocatedAcquisitionFees: sale.allocatedBuyFees,
    allocatedSellFees: sale.allocatedSellFee,

    realizedGainAfterActivityFees: sale.realizedGainAfterActivityFees
  };
}

function toAverageCostSummarySource(
  sale: AverageCostRealizedGainSale
): YearlyRealizedGainSource {
  return {
    sellActivityId: sale.sellActivityId,
    sellDate: sale.sellDate,
    transactionCurrency: sale.currency,

    sellQuantity: sale.sellQuantity,
    matchedQuantity: sale.sellQuantity,

    grossProceeds: sale.grossProceeds,
    grossCostBasis: sale.grossCostBasis,
    grossRealizedGain: sale.grossRealizedGain,

    allocatedAcquisitionFees: sale.allocatedAcquisitionFees,
    allocatedSellFees: sale.sellFee,

    realizedGainAfterActivityFees: sale.realizedGainAfterActivityFees
  };
}

function createRealizedGainSource({
  sellActivityId,
  sellDate,
  transactionCurrency = 'USD'
}: {
  sellActivityId: string;
  sellDate: Date;
  transactionCurrency?: string | null;
}): YearlyRealizedGainSource {
  return {
    sellActivityId,
    sellDate,
    transactionCurrency,

    sellQuantity: new Big(1),
    matchedQuantity: new Big(1),

    grossProceeds: new Big(100),
    grossCostBasis: new Big(60),
    grossRealizedGain: new Big(40),

    allocatedAcquisitionFees: new Big(1),
    allocatedSellFees: new Big(1),

    realizedGainAfterActivityFees: new Big(38)
  };
}
