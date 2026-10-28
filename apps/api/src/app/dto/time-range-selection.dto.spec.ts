import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { TimeRangeSelectionDto } from './time-range-selection.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(TimeRangeSelectionDto, plain);
  return validate(dto);
}

function messagesFor(
  errors: Awaited<ReturnType<typeof validateDto>>,
  property: string
): string[] {
  const match = errors.find((error) => error.property === property);
  return match?.constraints ? Object.values(match.constraints) : [];
}

describe('TimeRangeSelectionDto', () => {
  describe('valid selections', () => {
    it('accepts a preset range on its own', async () => {
      const errors = await validateDto({ range: '1y' });
      expect(errors).toHaveLength(0);
    });

    it('accepts every real DateRange preset value', async () => {
      const presets = ['1d', 'wtd', 'mtd', 'ytd', '1y', '5y', 'max'];

      for (const range of presets) {
        const errors = await validateDto({ range });
        expect(errors).toHaveLength(0);
      }
    });

    it('accepts a custom startDate/endDate pair on its own', async () => {
      const errors = await validateDto({
        startDate: '2026-01-01',
        endDate: '2026-06-01'
      });
      expect(errors).toHaveLength(0);
    });

    it('accepts a custom range where startDate equals endDate', async () => {
      const errors = await validateDto({
        startDate: '2026-03-01',
        endDate: '2026-03-01'
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe('preset validation', () => {
    it('rejects "today" (the old, incorrect preset value)', async () => {
      const errors = await validateDto({ range: 'today' });
      const messages = messagesFor(errors, 'range');

      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toContain('range must be one of');
    });

    it('rejects an unrecognized range value', async () => {
      const errors = await validateDto({ range: '3m' });
      const messages = messagesFor(errors, 'range');

      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe('mutual exclusivity', () => {
    it('rejects both range and a custom range being provided together', async () => {
      const errors = await validateDto({
        range: '1y',
        startDate: '2026-01-01',
        endDate: '2026-06-01'
      });
      const messages = messagesFor(errors, '_crossFieldCheck');

      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toMatch(/mutually exclusive/i);
    });

    it('rejects neither range nor a custom range being provided', async () => {
      const errors = await validateDto({});
      const messages = messagesFor(errors, '_crossFieldCheck');

      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toMatch(/provide either/i);
    });
  });

  describe('custom range completeness', () => {
    it('rejects startDate without endDate', async () => {
      const errors = await validateDto({ startDate: '2026-01-01' });
      const messages = messagesFor(errors, '_crossFieldCheck');

      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toMatch(/must both be provided/i);
    });

    it('rejects endDate without startDate', async () => {
      const errors = await validateDto({ endDate: '2026-06-01' });
      const messages = messagesFor(errors, '_crossFieldCheck');

      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toMatch(/must both be provided/i);
    });
  });

  describe('date ordering', () => {
    it('rejects endDate before startDate', async () => {
      const errors = await validateDto({
        startDate: '2026-06-01',
        endDate: '2026-01-01'
      });
      const messages = messagesFor(errors, '_crossFieldCheck');

      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toMatch(/must not be before/i);
    });
  });

  describe('date format', () => {
    it('rejects a non-ISO-8601 startDate', async () => {
      const errors = await validateDto({
        startDate: '03/01/2026',
        endDate: '2026-06-01'
      });
      const messages = messagesFor(errors, 'startDate');

      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toContain('ISO-8601');
    });

    it('rejects a non-ISO-8601 endDate', async () => {
      const errors = await validateDto({
        startDate: '2026-01-01',
        endDate: 'June 1 2026'
      });
      const messages = messagesFor(errors, 'endDate');

      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toContain('ISO-8601');
    });
  });

  // These are intentionally NOT covered by the DTO, per the comment in
  // time-range-selection.dto.ts: clamping endDate past "today" or
  // startDate before the account's earliest activity needs account data
  // the DTO can't see, so it belongs in the service layer. Documenting
  // that boundary here as a regression guard: if someone later adds
  // clamping logic directly to the DTO, this test will need updating,
  // which is the point, it should be a deliberate decision.
  describe('out of DTO scope (documented, not enforced here)', () => {
    it('does not reject a startDate before any particular cutoff on its own', async () => {
      const errors = await validateDto({
        startDate: '1970-01-01',
        endDate: '2026-01-01'
      });
      expect(errors).toHaveLength(0);
    });

    it('does not reject an endDate far in the future on its own', async () => {
      const errors = await validateDto({
        startDate: '2026-01-01',
        endDate: '2099-01-01'
      });
      expect(errors).toHaveLength(0);
    });
  });
});
