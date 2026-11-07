import { renderToStaticMarkup } from 'react-dom/server';

import { DividendWithholdingTable } from './dividend-withholding-table';
import type { DividendWithholdingViewRecord } from './dividend-withholding-table';

const dividend: DividendWithholdingViewRecord = {
  accountId: 'account-1',
  activityFee: '0.00',
  date: '2026-11-05T09:30:00.000Z',
  grossDividend: '10.123456789012345678901234',
  netDividend: '9.123456789012345678901234',
  sourceActivityId: 'dividend-1',
  symbolProfileId: 'asset-1',
  transactionCurrency: 'USD',
  withholdingTax: '1.000000000000000000000000'
};

function render(records: DividendWithholdingViewRecord[]): string {
  return renderToStaticMarkup(<DividendWithholdingTable records={records} />);
}

describe('DividendWithholdingTable', () => {
  it('shows gross, withholding and net as unchanged decimal strings', () => {
    const html = render([dividend]);

    expect(html).toContain('Gross dividend');
    expect(html).toContain('Withholding tax');
    expect(html).toContain('Net dividend');
    expect(html).toContain('10.123456789012345678901234');
    expect(html).toContain('1.000000000000000000000000');
    expect(html).toContain('9.123456789012345678901234');
  });

  it('distinguishes unknown withholding and net from known zero', () => {
    const unknownHtml = render([
      { ...dividend, netDividend: null, withholdingTax: null }
    ]);

    expect((unknownHtml.match(/>Not available</g) ?? []).length).toBe(2);
    expect(unknownHtml).not.toContain('>0<');

    const zeroHtml = render([
      {
        ...dividend,
        grossDividend: '0',
        netDividend: '0',
        withholdingTax: '0'
      }
    ]);
    expect((zeroHtml.match(/>0</g) ?? []).length).toBe(3);
    expect(zeroHtml).not.toContain('>Not available<');
  });

  it('keeps the supplied net value without performing financial arithmetic', () => {
    const html = render([
      {
        ...dividend,
        grossDividend: '10.00',
        netDividend: '7.95',
        withholdingTax: '2.00'
      }
    ]);

    expect(html).toContain('>7.95<');
    expect(html).not.toContain('>8.00<');
  });

  it('keeps transaction currency and source traceability per dividend', () => {
    const html = render([
      dividend,
      {
        ...dividend,
        accountId: null,
        date: '2026-10-01T00:00:00.000Z',
        sourceActivityId: 'dividend-2',
        transactionCurrency: 'EUR'
      }
    ]);

    expect(html).toContain('2026-11-05');
    expect(html).toContain('2026-10-01');
    expect(html).toContain('USD');
    expect(html).toContain('EUR');
    expect(html).toContain('dividend-1');
    expect(html).toContain('dividend-2');
    expect(html).toContain('Unassigned');
  });

  it('does not confuse activity fees with withholding', () => {
    const html = render([{ ...dividend, activityFee: '0.375' }]);

    expect(html).toContain('Activity fee');
    expect(html).toContain('0.375');
    expect(html).toContain('1.000000000000000000000000');
    expect(html).toContain('Activity fees are separate');
  });

  it('shows unspecified transaction currency without assuming USD', () => {
    const html = render([{ ...dividend, transactionCurrency: null }]);

    expect(html).toContain('Not specified');
    expect(html).not.toContain('>USD<');
  });

  it('shows an empty message without inventing dividend amounts', () => {
    const html = render([]);

    expect(html).toContain('No dividend records in the supplied data.');
    expect(html).not.toContain('dividend-1');
    expect(html).not.toContain('>0<');
  });
});
