import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';

import { Type as ActivityType } from '@prisma/client';

import { TaxDataService } from './tax-data.service';
import { TaxService } from './tax.service';
import { MISSING_DIVIDEND_BASE_CURRENCY_CONVERSION } from './yearly-tax-summary';

describe('TaxService yearly tax summary', () => {
  let exchangeRateDataService: {
    toCurrencyAtDate: jest.Mock;
  };

  let taxDataService: {
    getBaseCurrency: jest.Mock;
    getDividendActivities: jest.Mock;
    getFifoRealizedGainActivities: jest.Mock;
    getMixedHistoryDiagnostic: jest.Mock;
  };

  let service: TaxService;

  beforeEach(() => {
    exchangeRateDataService = {
      toCurrencyAtDate: jest.fn()
    };

    taxDataService = {
      getBaseCurrency: jest.fn().mockResolvedValue('USD'),
      getDividendActivities: jest.fn().mockResolvedValue([]),
      getFifoRealizedGainActivities: jest.fn().mockResolvedValue([]),
      getMixedHistoryDiagnostic: jest.fn().mockResolvedValue(null)
    };

    service = new TaxService(
      exchangeRateDataService as unknown as ExchangeRateDataService,
      taxDataService as unknown as TaxDataService
    );
  });

  it('loads historical acquisition basis through year end before filtering the yearly FIFO result', async () => {
    taxDataService.getFifoRealizedGainActivities.mockResolvedValue([
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

    taxDataService.getDividendActivities.mockResolvedValue([
      {
        accountId: 'account-1',
        currency: 'USD',
        date: new Date('2026-07-01T00:00:00.000Z'),
        fee: 0,
        id: 'dividend-2026',
        quantity: 10,
        symbolProfileId: 'symbol-1',
        type: ActivityType.DIVIDEND,
        unitPrice: 10,
        withholdingTax: 15
      }
    ]);

    const summary = await service.getYearlySummary('user-1', 2026, 'FIFO');

    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDateExclusive = new Date('2027-01-01T00:00:00.000Z');

    expect(taxDataService.getFifoRealizedGainActivities).toHaveBeenCalledWith(
      'user-1',
      endDateExclusive
    );

    expect(taxDataService.getDividendActivities).toHaveBeenCalledWith(
      'user-1',
      {
        endDateExclusive,
        startDate
      }
    );

    expect(taxDataService.getMixedHistoryDiagnostic).toHaveBeenCalledWith(
      'user-1',
      'FIFO',
      {
        endDateExclusive,
        sellDateFrom: startDate
      }
    );

    expect(summary.method).toBe('FIFO');

    expect(summary.dividendCount).toBe(1);
    expect(summary.disposalCount).toBe(1);

    expect(summary.grossDividendsBaseCurrency?.toString()).toBe('100');
    expect(summary.totalWithholdingTaxBaseCurrency?.toString()).toBe('15');
    expect(summary.netDividendsBaseCurrency?.toString()).toBe('85');

    expect(summary.grossProceedsBaseCurrency?.toString()).toBe('80');
    expect(summary.grossCostBasisBaseCurrency?.toString()).toBe('40');
    expect(summary.grossRealizedGainBaseCurrency?.toString()).toBe('40');

    expect(summary.totalActivityFeesBaseCurrency?.toString()).toBe('1.8');

    expect(summary.realizedGainAfterActivityFeesBaseCurrency?.toString()).toBe(
      '38.2'
    );

    expect(summary.isComplete).toBe(true);

    expect(exchangeRateDataService.toCurrencyAtDate).not.toHaveBeenCalled();
  });

  it('runs the requested average-cost method', async () => {
    taxDataService.getFifoRealizedGainActivities.mockResolvedValue([
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

    const summary = await service.getYearlySummary(
      'user-1',
      2026,
      'AVERAGE_COST'
    );

    expect(summary.method).toBe('AVERAGE_COST');

    expect(summary.grossProceedsBaseCurrency?.toString()).toBe('150');
    expect(summary.grossCostBasisBaseCurrency?.toString()).toBe('75');
    expect(summary.grossRealizedGainBaseCurrency?.toString()).toBe('75');

    expect(taxDataService.getMixedHistoryDiagnostic).toHaveBeenCalledWith(
      'user-1',
      'AVERAGE_COST',
      expect.any(Object)
    );
  });

  it('uses historical FX and reports missing conversion as incomplete instead of zero', async () => {
    taxDataService.getDividendActivities.mockResolvedValue([
      {
        accountId: 'account-1',
        currency: 'EUR',
        date: new Date('2026-07-01T00:00:00.000Z'),
        fee: 0,
        id: 'eur-dividend',
        quantity: 10,
        symbolProfileId: 'symbol-1',
        type: ActivityType.DIVIDEND,
        unitPrice: 10,
        withholdingTax: 15
      }
    ]);

    exchangeRateDataService.toCurrencyAtDate.mockResolvedValue(undefined);

    const summary = await service.getYearlySummary('user-1', 2026, 'FIFO');

    expect(exchangeRateDataService.toCurrencyAtDate).toHaveBeenCalledWith(
      1,
      'EUR',
      'USD',
      new Date('2026-07-01T00:00:00.000Z')
    );

    expect(summary.grossDividendsBaseCurrency).toBeNull();
    expect(summary.totalWithholdingTaxBaseCurrency).toBeNull();
    expect(summary.netDividendsBaseCurrency).toBeNull();

    expect(summary.isComplete).toBe(false);

    expect(summary.errors).toEqual([
      {
        code: MISSING_DIVIDEND_BASE_CURRENCY_CONVERSION,
        message:
          'Historical base-currency conversion is unavailable for one or more dividend activities.',
        sourceActivityIds: ['eur-dividend']
      }
    ]);

    expect(summary.currencySummaries[0].currency).toBe('EUR');
    expect(summary.currencySummaries[0].totalGrossDividends.toString()).toBe(
      '100'
    );
  });

  it('rejects a non-integer year before loading tax data', async () => {
    await expect(
      service.getYearlySummary('user-1', 2026.5, 'FIFO')
    ).rejects.toThrow('Yearly tax summary requires an integer year.');

    expect(taxDataService.getFifoRealizedGainActivities).not.toHaveBeenCalled();

    expect(taxDataService.getDividendActivities).not.toHaveBeenCalled();
  });
});
