import {
  PageSizes,
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts
} from 'pdf-lib';

import type { TaxExportTrace } from './tax-export';
import {
  TAX_PDF_NOT_AVAILABLE,
  TAX_PDF_TITLE,
  TaxPdfReport,
  TaxPdfReportBuilder
} from './tax-pdf-report';
import type { YearlyTaxSummary } from './yearly-tax-summary';

export interface TaxPdfExportResult {
  format: 'PDF';
  fileName: string;
  contentType: 'application/pdf';
  content: Uint8Array;
}

const PAGE_MARGIN = 48;
const BODY_FONT_SIZE = 9;
const BODY_LINE_HEIGHT = 12;
const SECTION_FONT_SIZE = 12;
const TITLE_FONT_SIZE = 18;

export class TaxPdfExport {
  public static async generate({
    generatedAt,
    summary,
    trace
  }: {
    generatedAt?: Date;
    summary: YearlyTaxSummary;
    trace: TaxExportTrace;
  }): Promise<TaxPdfExportResult> {
    const report = TaxPdfReportBuilder.build({
      generatedAt,
      summary,
      trace
    });

    const content = await TaxPdfExport.render(report);

    return {
      format: 'PDF',
      fileName: `ghostfolio-tax-${summary.year}-${TaxPdfExport.getMethodSlug(
        summary.method
      )}.pdf`,
      contentType: 'application/pdf',
      content
    };
  }

  private static async render(report: TaxPdfReport): Promise<Uint8Array> {
    const pdfDocument = await PDFDocument.create();

    pdfDocument.setTitle(TAX_PDF_TITLE);
    pdfDocument.setSubject('Ghostfolio Tax Analytics Report');
    pdfDocument.setCreator('Ghostfolio');
    pdfDocument.setProducer('Ghostfolio');
    pdfDocument.setCreationDate(report.metadata.generatedAt);
    pdfDocument.setModificationDate(report.metadata.generatedAt);

    const regularFont = await pdfDocument.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDocument.embedFont(StandardFonts.HelveticaBold);

    const renderer = new TaxPdfRenderer({
      boldFont,
      pdfDocument,
      regularFont
    });

    renderer.render(report);

    return pdfDocument.save({
      useObjectStreams: false
    });
  }

  private static getMethodSlug(method: YearlyTaxSummary['method']): string {
    return method === 'FIFO' ? 'fifo' : 'average-cost';
  }
}

class TaxPdfRenderer {
  private readonly boldFont: PDFFont;
  private readonly pdfDocument: PDFDocument;
  private readonly regularFont: PDFFont;

  private page: PDFPage;
  private y: number;

  public constructor({
    boldFont,
    pdfDocument,
    regularFont
  }: {
    boldFont: PDFFont;
    pdfDocument: PDFDocument;
    regularFont: PDFFont;
  }) {
    this.boldFont = boldFont;
    this.pdfDocument = pdfDocument;
    this.regularFont = regularFont;

    this.page = this.pdfDocument.addPage(PageSizes.A4);
    this.y = this.page.getHeight() - PAGE_MARGIN;
  }

  public render(report: TaxPdfReport): void {
    this.drawTitle(TAX_PDF_TITLE);

    this.drawKeyValue('Report Year', report.metadata.reportYear.toString());
    this.drawKeyValue('Cost-Basis Method', report.metadata.method);
    this.drawKeyValue('Base Currency', report.metadata.baseCurrency);
    this.drawKeyValue('Generated At', report.metadata.generatedAtIso);
    this.drawKeyValue('Status', report.metadata.status);

    if (report.incompleteNotice) {
      this.drawParagraph(report.incompleteNotice, this.boldFont);
    }

    this.drawSectionTitle('Annual Tax Summary');
    this.drawKeyValue(
      'Gross Dividends',
      this.withCurrency(
        report.annualSummary.grossDividends,
        report.metadata.baseCurrency
      )
    );
    this.drawKeyValue(
      'Withholding Tax',
      this.withCurrency(
        report.annualSummary.withholdingTax,
        report.metadata.baseCurrency
      )
    );
    this.drawKeyValue(
      'Net Dividends',
      this.withCurrency(
        report.annualSummary.netDividends,
        report.metadata.baseCurrency
      )
    );
    this.drawKeyValue(
      'Gross Sale Proceeds',
      this.withCurrency(
        report.annualSummary.grossProceeds,
        report.metadata.baseCurrency
      )
    );
    this.drawKeyValue(
      'Gross Cost Basis',
      this.withCurrency(
        report.annualSummary.grossCostBasis,
        report.metadata.baseCurrency
      )
    );
    this.drawKeyValue(
      'Gross Realized Gain',
      this.withCurrency(
        report.annualSummary.grossRealizedGain,
        report.metadata.baseCurrency
      )
    );
    this.drawKeyValue(
      'Activity Fees',
      this.withCurrency(
        report.annualSummary.activityFees,
        report.metadata.baseCurrency
      )
    );
    this.drawKeyValue(
      'Realized Gain After Activity Fees',
      this.withCurrency(
        report.annualSummary.realizedGainAfterActivityFees,
        report.metadata.baseCurrency
      )
    );
    this.drawKeyValue('Dividend Count', report.annualSummary.dividendCount);
    this.drawKeyValue('Disposal Count', report.annualSummary.disposalCount);

    this.drawSectionTitle('Dividend and Withholding Detail');

    if (report.dividends.length === 0) {
      this.drawParagraph('No dividend records for the selected year.');
    }

    for (const dividend of report.dividends) {
      this.drawRecordHeading(`Dividend ${dividend.sourceActivityId}`);
      this.drawParagraph(
        `Date: ${dividend.activityDate} | Account: ${dividend.accountId} | Asset: ${dividend.symbolProfileId}`
      );
      this.drawParagraph(
        `Transaction currency ${dividend.transactionCurrency} - Gross: ${dividend.grossDividendTransactionCurrency}, Withholding: ${dividend.withholdingTaxTransactionCurrency}, Net: ${dividend.netDividendTransactionCurrency}, Fee: ${dividend.activityFeeTransactionCurrency}`
      );
      this.drawParagraph(
        `Base currency ${report.metadata.baseCurrency} - Gross: ${dividend.grossDividendBaseCurrency}, Withholding: ${dividend.withholdingTaxBaseCurrency}, Net: ${dividend.netDividendBaseCurrency}, Fee: ${dividend.activityFeeBaseCurrency}`
      );
    }

    this.drawSectionTitle('Realized Capital Gains Detail');

    if (report.realizedGains.length === 0) {
      this.drawParagraph('No realized-gain records for the selected year.');
    }

    for (const gain of report.realizedGains) {
      this.drawRecordHeading(`Sale ${gain.sellActivityId}`);
      this.drawParagraph(
        `Realized: ${gain.realizedAt} | Transaction currency: ${gain.transactionCurrency} | Quantity: ${gain.sellQuantity} | Matched: ${gain.matchedQuantity}`
      );
      this.drawParagraph(
        `Base currency ${report.metadata.baseCurrency} - Proceeds: ${gain.grossProceedsBaseCurrency}, Cost basis: ${gain.grossCostBasisBaseCurrency}, Gross gain: ${gain.grossRealizedGainBaseCurrency}`
      );
      this.drawParagraph(
        `Fees: ${gain.activityFeesBaseCurrency} | Gain after fees: ${gain.realizedGainAfterActivityFeesBaseCurrency}`
      );
    }

    this.drawSectionTitle('Cost-Basis Trace Detail');

    if (report.trace.method === 'FIFO') {
      if (report.trace.matches.length === 0) {
        this.drawParagraph('No FIFO match trace rows for the selected year.');
      }

      for (const match of report.trace.matches) {
        this.drawRecordHeading(`FIFO Match ${match.traceId}`);
        this.drawParagraph(
          `BUY: ${match.buyActivityId} | SELL: ${match.sellActivityId} | Acquired: ${match.acquiredAt} | Realized: ${match.realizedAt} | Matched quantity: ${match.matchedQuantity}`
        );
        this.drawParagraph(
          `Base currency ${report.metadata.baseCurrency} - Cost basis: ${match.grossCostBasisBaseCurrency}, Proceeds: ${match.grossProceedsBaseCurrency}, Gross gain: ${match.grossRealizedGainBaseCurrency}, Fees: ${match.activityFeesBaseCurrency}, Gain after fees: ${match.realizedGainAfterActivityFeesBaseCurrency}`
        );
      }
    } else {
      if (report.trace.events.length === 0) {
        this.drawParagraph(
          'No average-cost trace events for the selected year.'
        );
      }

      for (const event of report.trace.events) {
        this.drawRecordHeading(`Average-Cost Event ${event.traceId}`);
        this.drawParagraph(
          `Activity: ${event.sourceActivityId} | SELL: ${event.sellActivityId} | Date: ${event.activityDate} | Quantity: ${event.quantity}`
        );
        this.drawParagraph(
          `Pool before - Quantity: ${event.poolQuantityBefore}, Average gross unit cost: ${event.averageGrossUnitCostBefore}`
        );
        this.drawParagraph(
          `Pool after - Quantity: ${event.poolQuantityAfter}, Average gross unit cost: ${event.averageGrossUnitCostAfter}`
        );
      }
    }

    this.drawSectionTitle('Warnings and Errors');

    if (report.warnings.length === 0 && report.errors.length === 0) {
      this.drawParagraph('No warnings or errors.');
    }

    for (const warning of report.warnings) {
      this.drawRecordHeading(`Warning: ${warning.code}`);
      this.drawParagraph(warning.message);
      this.drawDiagnosticIds({
        excludedActivityIds: warning.excludedActivityIds,
        relatedActivityIds: warning.relatedActivityIds
      });
    }

    for (const error of report.errors) {
      this.drawRecordHeading(`Error: ${error.code}`);
      this.drawParagraph(error.message);
      this.drawDiagnosticIds({
        excludedActivityIds: error.excludedActivityIds,
        relatedActivityIds: error.relatedActivityIds
      });
    }

    this.drawSectionTitle('Report Note');
    this.drawParagraph(report.reportNote);
  }

  private drawDiagnosticIds({
    excludedActivityIds,
    relatedActivityIds
  }: {
    excludedActivityIds: readonly string[];
    relatedActivityIds: readonly string[];
  }): void {
    if (relatedActivityIds.length > 0) {
      this.drawParagraph(
        `Related activity IDs: ${relatedActivityIds.join(' | ')}`
      );
    }

    if (excludedActivityIds.length > 0) {
      this.drawParagraph(
        `Excluded activity IDs: ${excludedActivityIds.join(' | ')}`
      );
    }
  }

  private drawTitle(text: string): void {
    this.ensureSpace(TITLE_FONT_SIZE + 16);
    this.page.drawText(this.sanitizeText(text), {
      x: PAGE_MARGIN,
      y: this.y,
      font: this.boldFont,
      size: TITLE_FONT_SIZE
    });
    this.y -= TITLE_FONT_SIZE + 12;
  }

  private drawSectionTitle(text: string): void {
    this.ensureSpace(SECTION_FONT_SIZE + 18);
    this.y -= 6;
    this.page.drawText(this.sanitizeText(text), {
      x: PAGE_MARGIN,
      y: this.y,
      font: this.boldFont,
      size: SECTION_FONT_SIZE
    });
    this.y -= SECTION_FONT_SIZE + 8;
  }

  private drawRecordHeading(text: string): void {
    this.ensureSpace(BODY_LINE_HEIGHT + 4);
    this.page.drawText(this.sanitizeText(text), {
      x: PAGE_MARGIN,
      y: this.y,
      font: this.boldFont,
      size: BODY_FONT_SIZE
    });
    this.y -= BODY_LINE_HEIGHT;
  }

  private drawKeyValue(label: string, value: string): void {
    this.drawParagraph(`${label}: ${value}`);
  }

  private drawParagraph(text: string, font: PDFFont = this.regularFont): void {
    const lines = this.wrapText({
      font,
      size: BODY_FONT_SIZE,
      text,
      width: this.page.getWidth() - PAGE_MARGIN * 2
    });

    for (const line of lines) {
      this.ensureSpace(BODY_LINE_HEIGHT);
      this.page.drawText(line, {
        x: PAGE_MARGIN,
        y: this.y,
        font,
        size: BODY_FONT_SIZE
      });
      this.y -= BODY_LINE_HEIGHT;
    }
  }

  private wrapText({
    font,
    size,
    text,
    width
  }: {
    font: PDFFont;
    size: number;
    text: string;
    width: number;
  }): string[] {
    const sanitized = this.sanitizeText(text);
    const words = sanitized.split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      return [''];
    }

    const lines: string[] = [];
    let current = words[0];

    for (const word of words.slice(1)) {
      const candidate = `${current} ${word}`;

      if (font.widthOfTextAtSize(candidate, size) <= width) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }

    lines.push(current);

    return lines;
  }

  private ensureSpace(requiredHeight: number): void {
    if (this.y - requiredHeight >= PAGE_MARGIN) {
      return;
    }

    this.page = this.pdfDocument.addPage(PageSizes.A4);
    this.y = this.page.getHeight() - PAGE_MARGIN;
  }

  private withCurrency(value: string, currency: string): string {
    return value === TAX_PDF_NOT_AVAILABLE ? value : `${value} ${currency}`;
  }

  private sanitizeText(text: string): string {
    return text
      .replace(/\r?\n/g, ' ')
      .replace(/[–—]/g, '-')
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
  }
}
