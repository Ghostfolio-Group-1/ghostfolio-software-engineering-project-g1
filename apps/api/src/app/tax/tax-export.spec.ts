import { Big } from 'big.js';
import { readFileSync } from 'fs';
import { parse } from 'papaparse';
import { join } from 'path';

import {
  TAX_EXPORT_COLUMNS,
  TaxExport,
  TaxExportColumn,
  TaxExportTrace
} from './tax-export';
import {
  MISSING_DIVIDEND_BASE_CURRENCY_CONVERSION,
  UNKNOWN_DIVIDEND_WITHHOLDING,
  YearlyTaxSummary
} from './yearly-tax-summary';

const GENERATED_AT = new Date('2026-10-26T15:00:00.000Z');

describe('TaxExport', () => {
  it('matches the deterministic FIFO golden CSV file', () => {
    const result = TaxExport.generate({
      generatedAt: GENERATED_AT,
      summary: createCompleteFifoSummary(),
      trace: createFifoTrace()
    });

    const goldenPath = join(
      process.cwd(),
      'apps/api/src/app/tax/fixtures/tax-export-fifo.golden.csv'
    );

    /*
     * Git may normalize the checked-in fixture to LF on some platforms.
     * Normalize the fixture back to the required CSV CRLF convention before
     * comparing it with the generated export.
     */
    const expected = readFileSync(goldenPath, 'utf8')
      .replace(/\r?\n/g, '\r\n')
      .replace(/\r\n$/, '');

    expect(result).toEqual({
      format: 'CSV',
      fileName: 'ghostfolio-tax-2026-fifo.csv',
      contentType: 'text/csv',
      content: expected
    });

    expect(result.content.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('uses the fixed CSV column order', () => {
    const result = TaxExport.generate({
      generatedAt: GENERATED_AT,
      summary: createCompleteFifoSummary(),
      trace: createFifoTrace()
    });

    const [header] = parseCsv(result.content);

    expect(Object.keys(header)).toEqual([...TAX_EXPORT_COLUMNS]);
  });

  it('preserves zero withholding as zero and unknown withholding as empty', () => {
    const summary = createDividendNullAndZeroSummary();

    const result = TaxExport.generate({
      generatedAt: GENERATED_AT,
      summary,
      trace: {
        method: 'FIFO',
        matches: []
      }
    });

    const rows = parseCsv(result.content);

    const summaryRow = getRow(rows, 'SUMMARY');

    expect(summaryRow.summaryGrossDividends).toBe('75');
    expect(summaryRow.summaryWithholdingTax).toBe('');
    expect(summaryRow.summaryNetDividends).toBe('');
    expect(summaryRow.isComplete).toBe('false');

    const zeroWithholdingRow = getRow(
      rows,
      'DIVIDEND',
      'sourceActivityId',
      'div-zero'
    );

    expect(zeroWithholdingRow.grossDividendTransactionCurrency).toBe('50');

    expect(zeroWithholdingRow.withholdingTaxTransactionCurrency).toBe('0');

    expect(zeroWithholdingRow.netDividendTransactionCurrency).toBe('50');

    expect(zeroWithholdingRow.withholdingTaxBaseCurrency).toBe('0');
    expect(zeroWithholdingRow.netDividendBaseCurrency).toBe('50');

    const unknownWithholdingRow = getRow(
      rows,
      'DIVIDEND',
      'sourceActivityId',
      'div-unknown'
    );

    expect(unknownWithholdingRow.withholdingTaxTransactionCurrency).toBe('');

    expect(unknownWithholdingRow.netDividendTransactionCurrency).toBe('');

    expect(unknownWithholdingRow.withholdingTaxBaseCurrency).toBe('');
    expect(unknownWithholdingRow.netDividendBaseCurrency).toBe('');

    expect(unknownWithholdingRow.warningCodes).toBe(
      UNKNOWN_DIVIDEND_WITHHOLDING
    );

    const warningRow = getRow(rows, 'WARNING');

    expect(warningRow.warningCodes).toBe(UNKNOWN_DIVIDEND_WITHHOLDING);

    expect(warningRow.sourceActivityId).toBe('div-unknown');
  });

  it('preserves missing FX as empty values and exports the error diagnostic', () => {
    const base = createCompleteFifoSummary();

    const dividend = {
      ...base.dividendRecords[0],
      transactionCurrency: 'EUR',
      grossDividendBaseCurrency: null,
      withholdingTaxBaseCurrency: null,
      netDividendBaseCurrency: null,
      activityFeeBaseCurrency: null
    };

    const summary: YearlyTaxSummary = {
      ...base,

      dividendRecords: [dividend],

      grossDividendsBaseCurrency: null,
      totalWithholdingTaxBaseCurrency: null,
      netDividendsBaseCurrency: null,

      isComplete: false,

      errors: [
        {
          code: MISSING_DIVIDEND_BASE_CURRENCY_CONVERSION,
          message:
            'Historical base-currency conversion is unavailable for one or more dividend activities.',
          sourceActivityIds: ['div-1']
        }
      ]
    };

    const result = TaxExport.generate({
      generatedAt: GENERATED_AT,
      summary,
      trace: createFifoTrace()
    });

    const rows = parseCsv(result.content);

    const summaryRow = getRow(rows, 'SUMMARY');

    expect(summaryRow.summaryGrossDividends).toBe('');
    expect(summaryRow.summaryWithholdingTax).toBe('');
    expect(summaryRow.summaryNetDividends).toBe('');
    expect(summaryRow.isComplete).toBe('false');

    const dividendRow = getRow(rows, 'DIVIDEND', 'sourceActivityId', 'div-1');

    expect(dividendRow.grossDividendBaseCurrency).toBe('');
    expect(dividendRow.withholdingTaxBaseCurrency).toBe('');
    expect(dividendRow.netDividendBaseCurrency).toBe('');

    expect(dividendRow.errorCodes).toBe(
      MISSING_DIVIDEND_BASE_CURRENCY_CONVERSION
    );

    const errorRow = getRow(rows, 'ERROR');

    expect(errorRow.errorCodes).toBe(MISSING_DIVIDEND_BASE_CURRENCY_CONVERSION);

    expect(errorRow.sourceActivityId).toBe('div-1');

    expect(errorRow.message).toBe(
      'Historical base-currency conversion is unavailable for one or more dividend activities.'
    );
  });

  it('reconciles complete financial detail rows to the summary without double-counting FIFO matches', () => {
    const summary = createCompleteFifoSummary();

    const result = TaxExport.generate({
      generatedAt: GENERATED_AT,
      summary,
      trace: createFifoTrace()
    });

    const rows = parseCsv(result.content);

    const summaryRow = getRow(rows, 'SUMMARY');

    const dividendRows = rows.filter(
      ({ recordType }) => recordType === 'DIVIDEND'
    );

    const realizedGainRows = rows.filter(
      ({ recordType }) => recordType === 'REALIZED_GAIN'
    );

    const fifoMatchRows = rows.filter(
      ({ recordType }) => recordType === 'FIFO_MATCH'
    );

    expect(
      sumColumn(dividendRows, 'grossDividendBaseCurrency').toString()
    ).toBe(summaryRow.summaryGrossDividends);

    expect(
      sumColumn(dividendRows, 'withholdingTaxBaseCurrency').toString()
    ).toBe(summaryRow.summaryWithholdingTax);

    expect(sumColumn(dividendRows, 'netDividendBaseCurrency').toString()).toBe(
      summaryRow.summaryNetDividends
    );

    expect(
      sumColumn(realizedGainRows, 'grossProceedsBaseCurrency').toString()
    ).toBe(summaryRow.summaryGrossProceeds);

    expect(
      sumColumn(realizedGainRows, 'grossCostBasisBaseCurrency').toString()
    ).toBe(summaryRow.summaryGrossCostBasis);

    expect(
      sumColumn(realizedGainRows, 'grossRealizedGainBaseCurrency').toString()
    ).toBe(summaryRow.summaryGrossRealizedGain);

    expect(
      sumColumn(realizedGainRows, 'activityFeesBaseCurrency').toString()
    ).toBe(summaryRow.summaryActivityFees);

    expect(
      sumColumn(
        realizedGainRows,
        'realizedGainAfterActivityFeesBaseCurrency'
      ).toString()
    ).toBe(summaryRow.summaryRealizedGainAfterActivityFees);

    /*
     * The FIFO trace contains the same sale economics for traceability,
     * but those rows must never be added again to annual sale totals.
     */
    expect(fifoMatchRows).toHaveLength(1);
    expect(realizedGainRows).toHaveLength(1);
    expect(summaryRow.disposalCount).toBe('1');
  });

  it('uses deterministic row ordering regardless of input array ordering', () => {
    const base = createCompleteFifoSummary();

    const earlyDividend = {
      ...base.dividendRecords[0],
      sourceActivityId: 'div-a',
      date: new Date('2026-01-01T00:00:00.000Z')
    };

    const lateDividend = {
      ...base.dividendRecords[0],
      sourceActivityId: 'div-z',
      date: new Date('2026-09-01T00:00:00.000Z')
    };

    const earlyGain = {
      ...base.realizedGains[0],
      sellActivityId: 'sell-a',
      sellDate: new Date('2026-02-01T00:00:00.000Z')
    };

    const lateGain = {
      ...base.realizedGains[0],
      sellActivityId: 'sell-z',
      sellDate: new Date('2026-10-01T00:00:00.000Z')
    };

    const summary: YearlyTaxSummary = {
      ...base,
      dividendCount: 2,
      disposalCount: 2,
      dividendRecords: [lateDividend, earlyDividend],
      realizedGains: [lateGain, earlyGain]
    };

    const trace: TaxExportTrace = {
      method: 'FIFO',
      matches: [
        {
          traceId: 'trace-z',
          buyActivityId: 'buy-z',
          sellActivityId: 'sell-z',
          acquiredAt: new Date('2025-10-01T00:00:00.000Z'),
          realizedAt: new Date('2026-10-01T00:00:00.000Z'),
          matchedQuantity: new Big(1),
          grossCostBasisBaseCurrency: new Big(10),
          grossProceedsBaseCurrency: new Big(20),
          grossRealizedGainBaseCurrency: new Big(10),
          activityFeesBaseCurrency: new Big(0),
          realizedGainAfterActivityFeesBaseCurrency: new Big(10)
        },
        {
          traceId: 'trace-a',
          buyActivityId: 'buy-a',
          sellActivityId: 'sell-a',
          acquiredAt: new Date('2025-01-01T00:00:00.000Z'),
          realizedAt: new Date('2026-02-01T00:00:00.000Z'),
          matchedQuantity: new Big(1),
          grossCostBasisBaseCurrency: new Big(10),
          grossProceedsBaseCurrency: new Big(20),
          grossRealizedGainBaseCurrency: new Big(10),
          activityFeesBaseCurrency: new Big(0),
          realizedGainAfterActivityFeesBaseCurrency: new Big(10)
        }
      ]
    };

    const first = TaxExport.generate({
      generatedAt: GENERATED_AT,
      summary,
      trace
    });

    const second = TaxExport.generate({
      generatedAt: GENERATED_AT,
      summary: {
        ...summary,
        dividendRecords: [...summary.dividendRecords].reverse(),
        realizedGains: [...summary.realizedGains].reverse()
      },
      trace: {
        method: 'FIFO',
        matches: [...trace.matches].reverse()
      }
    });

    expect(second.content).toBe(first.content);

    const rows = parseCsv(first.content);

    expect(
      rows
        .filter(({ recordType }) => recordType === 'DIVIDEND')
        .map(({ sourceActivityId }) => sourceActivityId)
    ).toEqual(['div-a', 'div-z']);

    expect(
      rows
        .filter(({ recordType }) => recordType === 'REALIZED_GAIN')
        .map(({ sellActivityId }) => sellActivityId)
    ).toEqual(['sell-a', 'sell-z']);

    expect(
      rows
        .filter(({ recordType }) => recordType === 'FIFO_MATCH')
        .map(({ traceId }) => traceId)
    ).toEqual(['trace-a', 'trace-z']);
  });

  it('exports average-cost trace rows without inventing FIFO matches', () => {
    const base = createCompleteFifoSummary();

    const summary: YearlyTaxSummary = {
      ...base,
      method: 'AVERAGE_COST'
    };

    const trace: TaxExportTrace = {
      method: 'AVERAGE_COST',
      events: [
        {
          traceId: 'average-sell-1',
          sourceActivityId: 'sell-1',
          sellActivityId: 'sell-1',
          activityDate: new Date('2026-06-01T14:30:00.000Z'),
          quantity: new Big(4),
          poolQuantityBefore: new Big(10),
          averageGrossUnitCostBefore: new Big(10),
          poolQuantityAfter: new Big(6),
          averageGrossUnitCostAfter: new Big(10)
        }
      ]
    };

    const result = TaxExport.generate({
      generatedAt: GENERATED_AT,
      summary,
      trace
    });

    expect(result.fileName).toBe('ghostfolio-tax-2026-average-cost.csv');

    const rows = parseCsv(result.content);

    expect(
      rows.filter(({ recordType }) => recordType === 'FIFO_MATCH')
    ).toHaveLength(0);

    const event = getRow(rows, 'AVERAGE_COST_EVENT');

    expect(event.sourceActivityId).toBe('sell-1');
    expect(event.sellActivityId).toBe('sell-1');
    expect(event.quantity).toBe('4');

    expect(event.poolQuantityBefore).toBe('10');
    expect(event.averageGrossUnitCostBefore).toBe('10');

    expect(event.poolQuantityAfter).toBe('6');
    expect(event.averageGrossUnitCostAfter).toBe('10');
  });

  it('copies source summary totals instead of recalculating them inside the exporter', () => {
    const base = createCompleteFifoSummary();

    const summary: YearlyTaxSummary = {
      ...base,
      grossProceedsBaseCurrency: new Big(999)
    };

    const result = TaxExport.generate({
      generatedAt: GENERATED_AT,
      summary,
      trace: createFifoTrace()
    });

    const rows = parseCsv(result.content);

    const summaryRow = getRow(rows, 'SUMMARY');

    const realizedGainRow = getRow(rows, 'REALIZED_GAIN');

    expect(summaryRow.summaryGrossProceeds).toBe('999');

    expect(realizedGainRow.grossProceedsBaseCurrency).toBe('80');
  });

  it('rejects trace data from a different calculation method', () => {
    expect(() => {
      TaxExport.generate({
        generatedAt: GENERATED_AT,
        summary: createCompleteFifoSummary(),
        trace: {
          method: 'AVERAGE_COST',
          events: []
        }
      });
    }).toThrow(
      'Tax export trace method AVERAGE_COST does not match yearly summary method FIFO.'
    );
  });

  it('quotes CSV text safely and prevents spreadsheet formula injection', () => {
    const base = createCompleteFifoSummary();

    const summary: YearlyTaxSummary = {
      ...base,
      isComplete: false,
      warnings: [
        {
          code: UNKNOWN_DIVIDEND_WITHHOLDING,
          message: '=SUM(1,2)\nreview this warning',
          sourceActivityIds: ['@activity']
        }
      ]
    };

    const result = TaxExport.generate({
      generatedAt: GENERATED_AT,
      summary,
      trace: createFifoTrace()
    });

    const rows = parseCsv(result.content);

    const warning = getRow(rows, 'WARNING');

    expect(warning.sourceActivityId).toBe("'@activity");

    expect(warning.message).toBe("'=SUM(1,2)\nreview this warning");

    /*
     * Negative financial values are numeric values, not text, so the
     * spreadsheet-safety rule must not prepend an apostrophe to them.
     */
    const lossSummary: YearlyTaxSummary = {
      ...base,
      grossRealizedGainBaseCurrency: new Big(-20),
      realizedGainAfterActivityFeesBaseCurrency: new Big(-21),
      realizedGains: [
        {
          ...base.realizedGains[0],
          grossRealizedGain: new Big(-20),
          grossRealizedGainBaseCurrency: new Big(-20),
          realizedGainAfterActivityFees: new Big(-21),
          realizedGainAfterActivityFeesBaseCurrency: new Big(-21)
        }
      ]
    };

    const lossResult = TaxExport.generate({
      generatedAt: GENERATED_AT,
      summary: lossSummary,
      trace: createFifoTrace()
    });

    const lossRows = parseCsv(lossResult.content);

    const loss = getRow(lossRows, 'REALIZED_GAIN');

    expect(loss.grossRealizedGainBaseCurrency).toBe('-20');

    expect(loss.realizedGainAfterActivityFeesBaseCurrency).toBe('-21');
  });

  it('serializes small decimal values without scientific notation', () => {
    const base = createCompleteFifoSummary();

    const summary: YearlyTaxSummary = {
      ...base,
      grossRealizedGainBaseCurrency: new Big('0.00000000000000000001'),
      realizedGains: [
        {
          ...base.realizedGains[0],
          grossRealizedGain: new Big('0.00000000000000000001'),
          grossRealizedGainBaseCurrency: new Big('0.00000000000000000001')
        }
      ]
    };

    const result = TaxExport.generate({
      generatedAt: GENERATED_AT,
      summary,
      trace: createFifoTrace()
    });

    const rows = parseCsv(result.content);

    const summaryRow = getRow(rows, 'SUMMARY');
    const gainRow = getRow(rows, 'REALIZED_GAIN');

    expect(summaryRow.summaryGrossRealizedGain).toBe('0.00000000000000000001');

    expect(gainRow.grossRealizedGainBaseCurrency).toBe(
      '0.00000000000000000001'
    );
  });
});

function createCompleteFifoSummary(): YearlyTaxSummary {
  return {
    year: 2026,
    method: 'FIFO',

    baseCurrency: 'USD',
    calculatedAt: GENERATED_AT,

    grossDividendsBaseCurrency: new Big(100),
    totalWithholdingTaxBaseCurrency: new Big(15),
    netDividendsBaseCurrency: new Big(85),

    grossProceedsBaseCurrency: new Big(80),
    grossCostBasisBaseCurrency: new Big(40),
    grossRealizedGainBaseCurrency: new Big(40),

    totalActivityFeesBaseCurrency: new Big('1.8'),

    realizedGainAfterActivityFeesBaseCurrency: new Big('38.2'),

    dividendCount: 1,
    disposalCount: 1,

    currencySummaries: [],

    dividendRecords: [
      {
        sourceActivityId: 'div-1',
        accountId: 'acct-div',
        symbolProfileId: 'sym-div',

        date: new Date('2026-03-15T12:00:00.000Z'),

        transactionCurrency: 'USD',

        grossDividend: new Big(100),
        withholdingTax: new Big(15),
        netDividend: new Big(85),
        activityFee: new Big(2),

        baseCurrency: 'USD',

        grossDividendBaseCurrency: new Big(100),
        withholdingTaxBaseCurrency: new Big(15),
        netDividendBaseCurrency: new Big(85),
        activityFeeBaseCurrency: new Big(2)
      }
    ],

    realizedGains: [
      {
        sellActivityId: 'sell-1',

        sellDate: new Date('2026-06-01T14:30:00.000Z'),

        transactionCurrency: 'USD',

        sellQuantity: new Big(4),
        matchedQuantity: new Big(4),

        grossProceeds: new Big(80),
        grossCostBasis: new Big(40),
        grossRealizedGain: new Big(40),

        allocatedAcquisitionFees: new Big('0.8'),
        allocatedSellFees: new Big(1),

        realizedGainAfterActivityFees: new Big('38.2'),

        baseCurrency: 'USD',

        totalActivityFees: new Big('1.8'),

        grossProceedsBaseCurrency: new Big(80),
        grossCostBasisBaseCurrency: new Big(40),
        grossRealizedGainBaseCurrency: new Big(40),

        totalActivityFeesBaseCurrency: new Big('1.8'),

        realizedGainAfterActivityFeesBaseCurrency: new Big('38.2')
      }
    ],

    isComplete: true,

    warnings: [],
    errors: []
  };
}

function createFifoTrace(): TaxExportTrace {
  return {
    method: 'FIFO',

    matches: [
      {
        traceId: 'lot-1:sell-1',

        buyActivityId: 'buy-1',
        sellActivityId: 'sell-1',

        acquiredAt: new Date('2025-05-01T10:00:00.000Z'),

        realizedAt: new Date('2026-06-01T14:30:00.000Z'),

        matchedQuantity: new Big(4),

        grossCostBasisBaseCurrency: new Big(40),
        grossProceedsBaseCurrency: new Big(80),
        grossRealizedGainBaseCurrency: new Big(40),

        activityFeesBaseCurrency: new Big('1.8'),

        realizedGainAfterActivityFeesBaseCurrency: new Big('38.2')
      }
    ]
  };
}

function createDividendNullAndZeroSummary(): YearlyTaxSummary {
  const base = createCompleteFifoSummary();

  return {
    ...base,

    grossDividendsBaseCurrency: new Big(75),

    totalWithholdingTaxBaseCurrency: null,
    netDividendsBaseCurrency: null,

    grossProceedsBaseCurrency: new Big(0),
    grossCostBasisBaseCurrency: new Big(0),
    grossRealizedGainBaseCurrency: new Big(0),

    totalActivityFeesBaseCurrency: new Big(0),

    realizedGainAfterActivityFeesBaseCurrency: new Big(0),

    dividendCount: 2,
    disposalCount: 0,

    dividendRecords: [
      {
        sourceActivityId: 'div-zero',
        accountId: 'account-1',
        symbolProfileId: 'symbol-1',

        date: new Date('2026-01-01T00:00:00.000Z'),

        transactionCurrency: 'USD',

        grossDividend: new Big(50),
        withholdingTax: new Big(0),
        netDividend: new Big(50),
        activityFee: new Big(0),

        baseCurrency: 'USD',

        grossDividendBaseCurrency: new Big(50),
        withholdingTaxBaseCurrency: new Big(0),
        netDividendBaseCurrency: new Big(50),
        activityFeeBaseCurrency: new Big(0)
      },
      {
        sourceActivityId: 'div-unknown',
        accountId: 'account-1',
        symbolProfileId: 'symbol-1',

        date: new Date('2026-02-01T00:00:00.000Z'),

        transactionCurrency: 'USD',

        grossDividend: new Big(25),
        withholdingTax: null,
        netDividend: null,
        activityFee: new Big(0),

        baseCurrency: 'USD',

        grossDividendBaseCurrency: new Big(25),
        withholdingTaxBaseCurrency: null,
        netDividendBaseCurrency: null,
        activityFeeBaseCurrency: new Big(0)
      }
    ],

    realizedGains: [],

    isComplete: false,

    warnings: [
      {
        code: UNKNOWN_DIVIDEND_WITHHOLDING,
        message:
          'One or more dividend activities have unknown withholding tax, so complete withholding and net-dividend totals are unavailable.',
        sourceActivityIds: ['div-unknown']
      }
    ],

    errors: []
  };
}

type ParsedCsvRow = Record<TaxExportColumn, string>;

function parseCsv(content: string): ParsedCsvRow[] {
  const result = parse<string[]>(content, {
    skipEmptyLines: true
  });

  if (result.errors.length > 0) {
    throw new Error(
      `Failed to parse generated tax CSV: ${result.errors
        .map(({ message }) => message)
        .join('; ')}`
    );
  }

  const [header, ...dataRows] = result.data;

  if (!header) {
    throw new Error('Generated tax CSV is missing its header row.');
  }

  return dataRows.map((values) => {
    return Object.fromEntries(
      header.map((column, index) => {
        return [column, values[index] ?? ''];
      })
    ) as ParsedCsvRow;
  });
}

function getRow(
  rows: readonly ParsedCsvRow[],
  recordType: string,
  idColumn?: TaxExportColumn,
  id?: string
): ParsedCsvRow {
  const row = rows.find((candidate) => {
    if (candidate.recordType !== recordType) {
      return false;
    }

    if (!idColumn) {
      return true;
    }

    return candidate[idColumn] === id;
  });

  if (!row) {
    throw new Error(
      `Expected CSV row ${recordType}${
        idColumn ? ` with ${idColumn}=${id}` : ''
      } was not found.`
    );
  }

  return row;
}

function sumColumn(
  rows: readonly ParsedCsvRow[],
  column: TaxExportColumn
): Big {
  return rows.reduce((total, row) => {
    const value = row[column];

    if (value === '') {
      throw new Error(`Cannot reconcile empty CSV value in column ${column}.`);
    }

    return total.plus(value);
  }, new Big(0));
}
