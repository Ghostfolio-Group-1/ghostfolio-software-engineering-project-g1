import { Big } from 'big.js';
import { PDFDocument, PDFPage } from 'pdf-lib';

import type { TaxExportTrace } from './tax-export';
import { TaxPdfExport } from './tax-pdf-export';
import {
  TAX_PDF_NOT_APPLICABLE,
  TAX_PDF_NOT_AVAILABLE,
  TAX_PDF_UNDEFINED_EMPTY_POOL,
  TaxPdfReportBuilder
} from './tax-pdf-report';
import {
  MISSING_DIVIDEND_BASE_CURRENCY_CONVERSION,
  UNKNOWN_DIVIDEND_WITHHOLDING,
  YearlyTaxSummary
} from './yearly-tax-summary';

const GENERATED_AT = new Date('2026-10-27T17:00:00.000Z');

describe('TaxPdfReportBuilder', () => {
  it('builds a FIFO report from source summary values without recalculating totals', () => {
    const summary = createCompleteFifoSummary();

    const report = TaxPdfReportBuilder.build({
      generatedAt: GENERATED_AT,
      summary,
      trace: createFifoTrace()
    });

    expect(report.metadata).toMatchObject({
      reportYear: 2026,
      method: 'FIFO',
      baseCurrency: 'USD',
      generatedAt: GENERATED_AT,
      generatedAtIso: '2026-10-27T17:00:00.000Z',
      status: 'Complete'
    });

    expect(report.annualSummary).toEqual({
      grossDividends: '100',
      withholdingTax: '15',
      netDividends: '85',
      grossProceeds: '80',
      grossCostBasis: '40',
      grossRealizedGain: '40',
      activityFees: '1.8',
      realizedGainAfterActivityFees: '38.2',
      dividendCount: '1',
      disposalCount: '1'
    });

    expect(report.dividends).toHaveLength(1);
    expect(report.dividends[0]).toMatchObject({
      sourceActivityId: 'div-1',
      transactionCurrency: 'USD',
      grossDividendTransactionCurrency: '100',
      withholdingTaxTransactionCurrency: '15',
      netDividendTransactionCurrency: '85',
      grossDividendBaseCurrency: '100',
      withholdingTaxBaseCurrency: '15',
      netDividendBaseCurrency: '85'
    });

    expect(report.realizedGains).toHaveLength(1);
    expect(report.realizedGains[0]).toMatchObject({
      sellActivityId: 'sell-1',
      sellQuantity: '4',
      matchedQuantity: '4',
      grossProceedsBaseCurrency: '80',
      grossCostBasisBaseCurrency: '40',
      grossRealizedGainBaseCurrency: '40',
      activityFeesBaseCurrency: '1.8',
      realizedGainAfterActivityFeesBaseCurrency: '38.2'
    });

    expect(report.trace.method).toBe('FIFO');

    if (report.trace.method !== 'FIFO') {
      throw new Error('Expected FIFO PDF trace.');
    }

    expect(report.trace.matches).toEqual([
      expect.objectContaining({
        traceId: 'lot-1:sell-1',
        buyActivityId: 'buy-1',
        sellActivityId: 'sell-1',
        matchedQuantity: '4',
        grossCostBasisBaseCurrency: '40',
        grossProceedsBaseCurrency: '80',
        grossRealizedGainBaseCurrency: '40',
        activityFeesBaseCurrency: '1.8',
        realizedGainAfterActivityFeesBaseCurrency: '38.2'
      })
    ]);

    /*
     * The summary count remains one disposal even though FIFO adds a
     * method-specific trace row for the matched acquisition lot.
     */
    expect(report.annualSummary.disposalCount).toBe('1');
    expect(report.trace.matches).toHaveLength(1);
  });

  it('copies source summary totals instead of deriving them from detail rows', () => {
    const base = createCompleteFifoSummary();

    const report = TaxPdfReportBuilder.build({
      generatedAt: GENERATED_AT,
      summary: {
        ...base,
        grossProceedsBaseCurrency: new Big(999)
      },
      trace: createFifoTrace()
    });

    expect(report.annualSummary.grossProceeds).toBe('999');
    expect(report.realizedGains[0].grossProceedsBaseCurrency).toBe('80');
  });

  it('preserves known zero separately from unknown values', () => {
    const report = TaxPdfReportBuilder.build({
      generatedAt: GENERATED_AT,
      summary: createNullAndZeroSummary(),
      trace: {
        method: 'FIFO',
        matches: []
      }
    });

    expect(report.metadata.status).toBe('Incomplete');
    expect(report.incompleteNotice).not.toBeNull();

    expect(report.annualSummary.withholdingTax).toBe(TAX_PDF_NOT_AVAILABLE);
    expect(report.annualSummary.grossProceeds).toBe('0');

    expect(report.dividends[0]).toMatchObject({
      sourceActivityId: 'div-zero',
      withholdingTaxTransactionCurrency: '0',
      withholdingTaxBaseCurrency: '0',
      netDividendTransactionCurrency: '50',
      netDividendBaseCurrency: '50'
    });

    expect(report.dividends[1]).toMatchObject({
      sourceActivityId: 'div-unknown',
      withholdingTaxTransactionCurrency: TAX_PDF_NOT_AVAILABLE,
      withholdingTaxBaseCurrency: TAX_PDF_NOT_AVAILABLE,
      netDividendTransactionCurrency: TAX_PDF_NOT_AVAILABLE,
      netDividendBaseCurrency: TAX_PDF_NOT_AVAILABLE
    });
  });

  it('keeps transaction-currency values distinct from base-currency values', () => {
    const base = createCompleteFifoSummary();

    const report = TaxPdfReportBuilder.build({
      generatedAt: GENERATED_AT,
      summary: {
        ...base,
        dividendRecords: [
          {
            ...base.dividendRecords[0],
            transactionCurrency: 'EUR',
            grossDividend: new Big(100),
            withholdingTax: new Big(10),
            netDividend: new Big(90),
            grossDividendBaseCurrency: new Big(108),
            withholdingTaxBaseCurrency: new Big('10.8'),
            netDividendBaseCurrency: new Big('97.2')
          }
        ]
      },
      trace: createFifoTrace()
    });

    expect(report.dividends[0]).toMatchObject({
      transactionCurrency: 'EUR',
      grossDividendTransactionCurrency: '100',
      withholdingTaxTransactionCurrency: '10',
      netDividendTransactionCurrency: '90',
      grossDividendBaseCurrency: '108',
      withholdingTaxBaseCurrency: '10.8',
      netDividendBaseCurrency: '97.2'
    });
  });

  it('builds average-cost trace data without inventing FIFO matches', () => {
    const base = createCompleteFifoSummary();

    const summary: YearlyTaxSummary = {
      ...base,
      method: 'AVERAGE_COST'
    };

    const trace: TaxExportTrace = {
      method: 'AVERAGE_COST',
      events: [
        {
          traceId: 'average-buy-1',
          sourceActivityId: 'buy-1',
          sellActivityId: null,
          activityDate: new Date('2026-01-15T10:00:00.000Z'),
          quantity: new Big(10),
          poolQuantityBefore: new Big(0),
          averageGrossUnitCostBefore: null,
          poolQuantityAfter: new Big(10),
          averageGrossUnitCostAfter: new Big(10)
        },
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

    const report = TaxPdfReportBuilder.build({
      generatedAt: GENERATED_AT,
      summary,
      trace
    });

    expect(report.trace.method).toBe('AVERAGE_COST');

    if (report.trace.method !== 'AVERAGE_COST') {
      throw new Error('Expected average-cost PDF trace.');
    }

    expect(report.trace.events).toHaveLength(2);
    expect(report.trace.events[0]).toMatchObject({
      traceId: 'average-buy-1',
      sellActivityId: TAX_PDF_NOT_APPLICABLE,
      quantity: '10',
      poolQuantityBefore: '0',
      averageGrossUnitCostBefore: TAX_PDF_UNDEFINED_EMPTY_POOL,
      poolQuantityAfter: '10',
      averageGrossUnitCostAfter: '10'
    });
    expect(report.trace.events[1]).toMatchObject({
      traceId: 'average-sell-1',
      sellActivityId: 'sell-1',
      quantity: '4',
      poolQuantityBefore: '10',
      averageGrossUnitCostBefore: '10',
      poolQuantityAfter: '6',
      averageGrossUnitCostAfter: '10'
    });
  });

  it('serializes tiny Big values as plain decimals instead of exponent notation', () => {
    const base = createCompleteFifoSummary();
    const tiny = new Big('0.00000001');

    const report = TaxPdfReportBuilder.build({
      generatedAt: GENERATED_AT,
      summary: {
        ...base,
        grossDividendsBaseCurrency: tiny,
        dividendRecords: [
          {
            ...base.dividendRecords[0],
            grossDividend: tiny,
            activityFee: tiny,
            grossDividendBaseCurrency: tiny,
            activityFeeBaseCurrency: tiny
          }
        ],
        realizedGains: [
          {
            ...base.realizedGains[0],
            sellQuantity: tiny,
            matchedQuantity: tiny
          }
        ]
      },
      trace: {
        method: 'FIFO',
        matches: [
          {
            ...createFifoTrace().matches[0],
            matchedQuantity: tiny
          }
        ]
      }
    });

    expect(report.annualSummary.grossDividends).toBe('0.00000001');
    expect(report.dividends[0].grossDividendTransactionCurrency).toBe(
      '0.00000001'
    );
    expect(report.dividends[0].activityFeeTransactionCurrency).toBe(
      '0.00000001'
    );
    expect(report.realizedGains[0].sellQuantity).toBe('0.00000001');
    expect(report.realizedGains[0].matchedQuantity).toBe('0.00000001');

    if (report.trace.method !== 'FIFO') {
      throw new Error('Expected FIFO PDF trace.');
    }

    expect(report.trace.matches[0].matchedQuantity).toBe('0.00000001');
  });

  it('exports warning and error diagnostics for an incomplete report', () => {
    const base = createCompleteFifoSummary();

    const summary: YearlyTaxSummary = {
      ...base,
      isComplete: false,
      warnings: [
        {
          code: UNKNOWN_DIVIDEND_WITHHOLDING,
          message: 'Withholding is unknown for one dividend.',
          sourceActivityIds: ['div-1']
        }
      ],
      errors: [
        {
          code: MISSING_DIVIDEND_BASE_CURRENCY_CONVERSION,
          message: 'Base-currency conversion is unavailable.',
          sourceActivityIds: ['div-1']
        }
      ]
    };

    const report = TaxPdfReportBuilder.build({
      generatedAt: GENERATED_AT,
      summary,
      trace: createFifoTrace()
    });

    expect(report.incompleteNotice).toContain('Incomplete report');

    expect(report.warnings).toEqual([
      {
        code: UNKNOWN_DIVIDEND_WITHHOLDING,
        message: 'Withholding is unknown for one dividend.',
        relatedActivityIds: ['div-1'],
        excludedActivityIds: []
      }
    ]);

    expect(report.errors).toEqual([
      {
        code: MISSING_DIVIDEND_BASE_CURRENCY_CONVERSION,
        message: 'Base-currency conversion is unavailable.',
        relatedActivityIds: ['div-1'],
        excludedActivityIds: []
      }
    ]);
  });

  it('rejects trace data from a different calculation method', () => {
    expect(() => {
      TaxPdfReportBuilder.build({
        generatedAt: GENERATED_AT,
        summary: createCompleteFifoSummary(),
        trace: {
          method: 'AVERAGE_COST',
          events: []
        }
      });
    }).toThrow(
      'Tax PDF trace method AVERAGE_COST does not match yearly summary method FIFO.'
    );
  });

  it('defaults generatedAt to the source summary calculation time', () => {
    const summary = createCompleteFifoSummary();

    const report = TaxPdfReportBuilder.build({
      summary,
      trace: createFifoTrace()
    });

    expect(report.metadata.generatedAt).toBe(summary.calculatedAt);
    expect(report.metadata.generatedAtIso).toBe(
      summary.calculatedAt.toISOString()
    );
  });
});

describe('TaxPdfExport', () => {
  it('generates a loadable one-page PDF with deterministic metadata', async () => {
    const summary = createEmptyFifoSummary();

    const result = await TaxPdfExport.generate({
      generatedAt: GENERATED_AT,
      summary,
      trace: {
        method: 'FIFO',
        matches: []
      }
    });

    expect(result.format).toBe('PDF');
    expect(result.fileName).toBe('ghostfolio-tax-2026-fifo.pdf');
    expect(result.contentType).toBe('application/pdf');

    expect(Buffer.from(result.content).subarray(0, 4).toString('ascii')).toBe(
      '%PDF'
    );

    const document = await PDFDocument.load(result.content, {
      updateMetadata: false
    });

    expect(document.getPageCount()).toBe(1);
    expect(document.getTitle()).toBe('Ghostfolio Tax Analytics');
    expect(document.getCreationDate()).toEqual(GENERATED_AT);
    expect(document.getModificationDate()).toEqual(GENERATED_AT);
  });

  it('renders full FIFO report values through the PDF draw path', async () => {
    const drawTextSpy = jest.spyOn(PDFPage.prototype, 'drawText');

    try {
      await TaxPdfExport.generate({
        generatedAt: GENERATED_AT,
        summary: createCompleteFifoSummary(),
        trace: createFifoTrace()
      });

      const drawnText = drawTextSpy.mock.calls.map(([text]) => text);

      expect(drawnText).toContain('Gross Dividends: 100 USD');
      expect(drawnText).toContain('Gross Realized Gain: 40 USD');
      expect(drawnText).toContain('Dividend div-1');
      expect(drawnText).toContain('Sale sell-1');
      expect(drawnText).toContain('FIFO Match lot-1:sell-1');
    } finally {
      drawTextSpy.mockRestore();
    }
  });

  it('renders zero, unavailable and incomplete values distinctly', async () => {
    const drawTextSpy = jest.spyOn(PDFPage.prototype, 'drawText');

    try {
      await TaxPdfExport.generate({
        generatedAt: GENERATED_AT,
        summary: createNullAndZeroSummary(),
        trace: {
          method: 'FIFO',
          matches: []
        }
      });

      const drawnText = drawTextSpy.mock.calls.map(([text]) => text);

      expect(drawnText).toContain('Withholding Tax: Not available');
      expect(drawnText).toContain('Gross Sale Proceeds: 0 USD');

      const combinedText = drawnText.join(' ');

      expect(combinedText).toContain(
        'Incomplete report: one or more tax values are unavailable. Review the warnings and errors before relying on the report.'
      );
    } finally {
      drawTextSpy.mockRestore();
    }
  });

  it('renders average-cost not-applicable and empty-pool states distinctly', async () => {
    const base = createEmptyFifoSummary();
    const drawTextSpy = jest.spyOn(PDFPage.prototype, 'drawText');

    try {
      await TaxPdfExport.generate({
        generatedAt: GENERATED_AT,
        summary: {
          ...base,
          method: 'AVERAGE_COST'
        },
        trace: {
          method: 'AVERAGE_COST',
          events: [
            {
              traceId: 'average-buy-1',
              sourceActivityId: 'buy-1',
              sellActivityId: null,
              activityDate: new Date('2026-01-15T10:00:00.000Z'),
              quantity: new Big(10),
              poolQuantityBefore: new Big(0),
              averageGrossUnitCostBefore: null,
              poolQuantityAfter: new Big(10),
              averageGrossUnitCostAfter: new Big(10)
            }
          ]
        }
      });

      const drawnText = drawTextSpy.mock.calls.map(([text]) => text);
      const combined = drawnText.join('\n');

      expect(combined).toContain('SELL: Not applicable');
      expect(combined).toContain(
        'Average gross unit cost: Undefined (empty pool)'
      );
    } finally {
      drawTextSpy.mockRestore();
    }
  });

  it('adds pages when the report contains many dividend rows', async () => {
    const base = createCompleteFifoSummary();
    const dividendRecords = Array.from({ length: 250 }, (_, index) => ({
      ...base.dividendRecords[0],
      sourceActivityId: `div-${index.toString().padStart(3, '0')}`,
      date: new Date(Date.UTC(2026, 0, 1, 0, 0, index % 60))
    }));

    const result = await TaxPdfExport.generate({
      generatedAt: GENERATED_AT,
      summary: {
        ...base,
        dividendCount: dividendRecords.length,
        dividendRecords
      },
      trace: createFifoTrace()
    });

    const document = await PDFDocument.load(result.content, {
      updateMetadata: false
    });

    expect(document.getPageCount()).toBeGreaterThan(1);
  });

  it('sanitizes unsupported Unicode before drawing text', async () => {
    const base = createCompleteFifoSummary();
    const drawTextSpy = jest.spyOn(PDFPage.prototype, 'drawText');

    try {
      await expect(
        TaxPdfExport.generate({
          generatedAt: GENERATED_AT,
          summary: {
            ...base,
            isComplete: false,
            warnings: [
              {
                code: UNKNOWN_DIVIDEND_WITHHOLDING,
                message: 'Unsupported ł 漢 − characters.',
                sourceActivityIds: ['div-1']
              }
            ]
          },
          trace: createFifoTrace()
        })
      ).resolves.toBeDefined();

      const combined = drawTextSpy.mock.calls.map(([text]) => text).join('\n');

      expect(combined).toContain('Unsupported ? ? ? characters.');
      expect(combined).not.toContain('ł');
      expect(combined).not.toContain('漢');
      expect(combined).not.toContain('−');
    } finally {
      drawTextSpy.mockRestore();
    }
  });

  it('generates identical bytes for equivalent deterministically ordered input', async () => {
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

    const summary: YearlyTaxSummary = {
      ...base,
      dividendCount: 2,
      dividendRecords: [lateDividend, earlyDividend]
    };

    const trace: Extract<TaxExportTrace, { method: 'FIFO' }> = {
      method: 'FIFO',
      matches: [
        {
          ...createFifoTrace().matches[0],
          traceId: 'trace-z',
          buyActivityId: 'buy-z',
          acquiredAt: new Date('2025-09-01T00:00:00.000Z')
        },
        {
          ...createFifoTrace().matches[0],
          traceId: 'trace-a',
          buyActivityId: 'buy-a',
          acquiredAt: new Date('2025-01-01T00:00:00.000Z')
        }
      ]
    };

    const first = await TaxPdfExport.generate({
      generatedAt: GENERATED_AT,
      summary,
      trace
    });

    const second = await TaxPdfExport.generate({
      generatedAt: GENERATED_AT,
      summary: {
        ...summary,
        dividendRecords: [...summary.dividendRecords].reverse()
      },
      trace: {
        method: 'FIFO',
        matches: [...trace.matches].reverse()
      }
    });

    expect(Buffer.from(second.content)).toEqual(Buffer.from(first.content));
  });

  it('uses the average-cost filename slug', async () => {
    const summary: YearlyTaxSummary = {
      ...createEmptyFifoSummary(),
      method: 'AVERAGE_COST'
    };

    const result = await TaxPdfExport.generate({
      generatedAt: GENERATED_AT,
      summary,
      trace: {
        method: 'AVERAGE_COST',
        events: []
      }
    });

    expect(result.fileName).toBe('ghostfolio-tax-2026-average-cost.pdf');
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

function createFifoTrace(): Extract<TaxExportTrace, { method: 'FIFO' }> {
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

function createNullAndZeroSummary(): YearlyTaxSummary {
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

function createEmptyFifoSummary(): YearlyTaxSummary {
  return {
    year: 2026,
    method: 'FIFO',

    baseCurrency: 'USD',
    calculatedAt: GENERATED_AT,

    grossDividendsBaseCurrency: new Big(0),
    totalWithholdingTaxBaseCurrency: new Big(0),
    netDividendsBaseCurrency: new Big(0),

    grossProceedsBaseCurrency: new Big(0),
    grossCostBasisBaseCurrency: new Big(0),
    grossRealizedGainBaseCurrency: new Big(0),

    totalActivityFeesBaseCurrency: new Big(0),
    realizedGainAfterActivityFeesBaseCurrency: new Big(0),

    dividendCount: 0,
    disposalCount: 0,

    currencySummaries: [],
    dividendRecords: [],
    realizedGains: [],

    isComplete: true,
    warnings: [],
    errors: []
  };
}
