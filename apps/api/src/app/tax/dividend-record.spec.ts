import { Type as ActivityType } from '@prisma/client';

import { createDividendRecord, DividendRecordSource } from './dividend-record';

describe('createDividendRecord', () => {
  it('derives gross, withholding and net dividend for known withholding', () => {
    const record = createDividendRecord(
      createDividendActivity({
        quantity: 10,
        unitPrice: 10,
        withholdingTax: 15
      })
    );

    expect(record.grossDividend.toString()).toBe('100');
    expect(record.withholdingTax?.toString()).toBe('15');
    expect(record.netDividend?.toString()).toBe('85');
  });

  it('preserves zero withholding as known zero', () => {
    const record = createDividendRecord(
      createDividendActivity({
        quantity: 10,
        unitPrice: 10,
        withholdingTax: 0
      })
    );

    expect(record.grossDividend.toString()).toBe('100');
    expect(record.withholdingTax?.toString()).toBe('0');
    expect(record.netDividend?.toString()).toBe('100');
  });

  it('preserves unknown withholding as null', () => {
    const record = createDividendRecord(
      createDividendActivity({
        quantity: 10,
        unitPrice: 10,
        withholdingTax: null
      })
    );

    expect(record.grossDividend.toString()).toBe('100');
    expect(record.withholdingTax).toBeNull();
    expect(record.netDividend).toBeNull();
  });

  it('keeps the activity fee separate from net dividend', () => {
    const record = createDividendRecord(
      createDividendActivity({
        fee: 9,
        quantity: 10,
        unitPrice: 10,
        withholdingTax: 15
      })
    );

    expect(record.netDividend?.toString()).toBe('85');
    expect(record.activityFee.toString()).toBe('9');
  });

  it('uses decimal-safe arithmetic without intermediate rounding', () => {
    const record = createDividendRecord(
      createDividendActivity({
        quantity: 3,
        unitPrice: 0.1,
        withholdingTax: 0.07
      })
    );

    expect(record.grossDividend.toString()).toBe('0.3');
    expect(record.withholdingTax?.toString()).toBe('0.07');
    expect(record.netDividend?.toString()).toBe('0.23');
  });

  it('preserves source activity traceability', () => {
    const date = new Date('2026-10-08T12:00:00.000Z');

    const record = createDividendRecord(
      createDividendActivity({
        accountId: 'account-1',
        currency: 'USD',
        date,
        id: 'dividend-activity-1',
        symbolProfileId: 'symbol-profile-1'
      })
    );

    expect(record.sourceActivityId).toBe('dividend-activity-1');
    expect(record.accountId).toBe('account-1');
    expect(record.symbolProfileId).toBe('symbol-profile-1');
    expect(record.date).toBe(date);
    expect(record.transactionCurrency).toBe('USD');
  });

  it('rejects a non-dividend activity', () => {
    expect(() =>
      createDividendRecord(
        createDividendActivity({
          type: ActivityType.BUY
        })
      )
    ).toThrow('DividendRecord can only be derived from DIVIDEND activities.');
  });
});

function createDividendActivity({
  accountId = null,
  currency = 'USD',
  date = new Date('2026-10-08T12:00:00.000Z'),
  fee = 0,
  id = 'dividend-activity-1',
  quantity = 10,
  symbolProfileId = 'symbol-profile-1',
  type = ActivityType.DIVIDEND,
  unitPrice = 10,
  withholdingTax = 0
}: Partial<DividendRecordSource> = {}): DividendRecordSource {
  return {
    accountId,
    currency,
    date,
    fee,
    id,
    quantity,
    symbolProfileId,
    type,
    unitPrice,
    withholdingTax
  };
}
