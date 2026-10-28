import { Big } from 'big.js';
import { endOfDay, format } from 'date-fns';

import {
  getAnnualizedPerformancePercent,
  getIntervalFromDateRange,
  InvalidTimeRangeError,
  resolveTimeRange
} from './calculation-helper';
import { DATE_FORMAT } from './helper';
import { TIME_RANGE_PRESETS } from './types/time-range-selection.type';

describe('CalculationHelper', () => {
  describe('interval from date range', () => {
    it('Get interval of a calendar year', async () => {
      const { endDate, startDate } = getIntervalFromDateRange({
        dateRange: '2024'
      });

      // The boundaries are expressed in the local time zone, therefore the
      // calendar days must hold independently of the time zone the tests run in
      expect(format(startDate, DATE_FORMAT)).toEqual('2023-12-31');
      expect(format(endDate, DATE_FORMAT)).toEqual('2024-12-31');

      // The start date is exclusive, hence the first instant of the year is
      // part of the interval
      expect(startDate.getTime()).toEqual(new Date(2024, 0, 1).getTime() - 1);
    });
  });

  describe('resolveTimeRange', () => {
    const now = new Date(2026, 2, 15, 15, 30, 0);

    it.each(TIME_RANGE_PRESETS)(
      'resolves the %s preset with the existing date-range interval',
      (preset) => {
        const resolved = resolveTimeRange({
          now,
          selection: { mode: 'preset', preset }
        });
        const expected = getIntervalFromDateRange({
          dateRange: preset === 'today' ? '1d' : preset,
          now
        });

        expect(resolved.startDate.getTime()).toBe(expected.startDate.getTime());
        expect(resolved.endDate.getTime()).toBe(expected.endDate.getTime());
      }
    );

    it('resolves a custom range from inclusive calendar dates', () => {
      const { endDate, startDate } = resolveTimeRange({
        now,
        selection: {
          mode: 'custom',
          startDate: '2026-03-01',
          endDate: '2026-03-10'
        }
      });

      expect(startDate.getTime()).toBe(Date.UTC(2026, 2, 1));
      expect(endDate.getTime()).toBe(endOfDay(new Date(2026, 2, 10)).getTime());
    });

    it('clamps a custom end date that is after today', () => {
      const { endDate } = resolveTimeRange({
        now,
        selection: {
          mode: 'custom',
          startDate: '2026-03-01',
          endDate: '2026-04-01'
        }
      });

      expect(endDate.getTime()).toBe(endOfDay(now).getTime());
    });

    it('clamps a custom start date that is before the earliest activity', () => {
      const earliestDate = new Date(Date.UTC(2026, 2, 5));
      const { startDate } = resolveTimeRange({
        earliestDate,
        now,
        selection: {
          mode: 'custom',
          startDate: '2026-01-01',
          endDate: '2026-03-10'
        }
      });

      expect(startDate.getTime()).toBe(earliestDate.getTime());
    });

    it('rejects a custom range whose end is before its start', () => {
      expect(() => {
        resolveTimeRange({
          now,
          selection: {
            mode: 'custom',
            startDate: '2026-03-10',
            endDate: '2026-03-01'
          }
        });
      }).toThrow(InvalidTimeRangeError);
    });
  });

  describe('annualized performance percentage', () => {
    it('Get annualized performance', async () => {
      expect(
        getAnnualizedPerformancePercent({
          daysInMarket: NaN, // differenceInDays of date-fns returns NaN for the same day
          netPerformancePercentage: new Big(0)
        }).toNumber()
      ).toEqual(0);

      expect(
        getAnnualizedPerformancePercent({
          daysInMarket: 0,
          netPerformancePercentage: new Big(0)
        }).toNumber()
      ).toEqual(0);

      /**
       * Source: https://www.readyratios.com/reference/analysis/annualized_rate.html
       */
      expect(
        getAnnualizedPerformancePercent({
          daysInMarket: 65, // < 1 year
          netPerformancePercentage: new Big(0.1025)
        }).toNumber()
      ).toBeCloseTo(0.729705);

      expect(
        getAnnualizedPerformancePercent({
          daysInMarket: 365, // 1 year
          netPerformancePercentage: new Big(0.05)
        }).toNumber()
      ).toBeCloseTo(0.05);

      /**
       * Source: https://www.investopedia.com/terms/a/annualized-total-return.asp#annualized-return-formula-and-calculation
       */
      expect(
        getAnnualizedPerformancePercent({
          daysInMarket: 575, // > 1 year
          netPerformancePercentage: new Big(0.2374)
        }).toNumber()
      ).toBeCloseTo(0.145);
    });
  });
});
