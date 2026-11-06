import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';

import { Type as ActivityType } from '@prisma/client';

import { TaxDataService } from './tax-data.service';
import { TaxService } from './tax.service';

const source = {
  accountId: 'account-1',
  currency: 'USD',
  date: new Date('2026-11-05T23:30:00.000Z'),
  fee: '0.000000000000000000000001',
  id: 'div-1',
  quantity: '2',
  symbolProfileId: 'asset-1',
  type: ActivityType.DIVIDEND,
  unitPrice: '0.123456789012345678901234',
  withholdingTax: '0.100000000000000000000001'
};

describe('TaxService.getDividendRecords', () => {
  const getDividendActivities = jest.fn();
  const service = new TaxService(
    { toCurrencyAtDate: jest.fn() } as unknown as ExchangeRateDataService,
    { getDividendActivities } as unknown as TaxDataService
  );

  beforeEach(() => {
    getDividendActivities.mockReset();
  });

  it('uses the authenticated user and a bounded UTC calendar year', async () => {
    getDividendActivities.mockResolvedValue([]);

    await expect(service.getDividendRecords('user-7', 2026)).resolves.toEqual({
      records: []
    });

    expect(getDividendActivities).toHaveBeenCalledWith('user-7', {
      endDateExclusive: new Date('2027-01-01T00:00:00.000Z'),
      startDate: new Date('2026-01-01T00:00:00.000Z')
    });
  });

  it('returns exact decimal strings and keeps fees separate from withholding', async () => {
    getDividendActivities.mockResolvedValue([source]);

    const response = await service.getDividendRecords('user-7', 2026);

    expect(response.records).toEqual([
      {
        accountId: 'account-1',
        activityFee: '0.000000000000000000000001',
        date: '2026-11-05T23:30:00.000Z',
        grossDividend: '0.246913578024691357802468',
        netDividend: '0.146913578024691357802467',
        sourceActivityId: 'div-1',
        symbolProfileId: 'asset-1',
        transactionCurrency: 'USD',
        withholdingTax: '0.100000000000000000000001'
      }
    ]);
  });

  it('preserves known zero and unknown withholding as different values', async () => {
    getDividendActivities.mockResolvedValue([
      {
        ...source,
        id: 'zero',
        quantity: '10',
        unitPrice: '1',
        withholdingTax: '0'
      },
      { ...source, id: 'unknown', withholdingTax: null }
    ]);

    const { records } = await service.getDividendRecords('user-7', 2026);

    expect(records[0]).toMatchObject({
      grossDividend: '10',
      netDividend: '10',
      withholdingTax: '0'
    });
    expect(records[1]).toMatchObject({
      netDividend: null,
      withholdingTax: null
    });
  });

  it.each([2026.5, 0, 99, 10000])(
    'rejects invalid year %s before reading any activity',
    async (year) => {
      await expect(service.getDividendRecords('user-7', year)).rejects.toThrow(
        'A four-digit calendar year is required.'
      );
      expect(getDividendActivities).not.toHaveBeenCalled();
    }
  );
});
