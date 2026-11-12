import {
  createEmptyWhatIfFormValues,
  isWhatIfFormValid,
  toRunWhatIfRequest,
  validateWhatIfForm
} from './what-if-form.model';
import type { WhatIfFormValues } from './what-if-form.model';

function values(overrides: Partial<WhatIfFormValues> = {}): WhatIfFormValues {
  return {
    ...createEmptyWhatIfFormValues(),
    dropPercentage: '40',
    symbol: 'AAPL',
    ...overrides
  };
}

describe('validateWhatIfForm', () => {
  it('accepts a valid drop percentage and symbol', () => {
    expect(validateWhatIfForm(values())).toEqual({});
    expect(isWhatIfFormValid(values())).toBe(true);
  });

  it('requires a symbol', () => {
    expect(validateWhatIfForm(values({ symbol: '  ' })).symbol).toBe(
      'Choose a holding to shock.'
    );
  });

  it.each(['', 'abc', 'NaN'])(
    'rejects a non-numeric drop percentage %s',
    (dropPercentage) => {
      expect(
        validateWhatIfForm(values({ dropPercentage })).dropPercentage
      ).toBe('Enter a drop percentage.');
    }
  );

  it.each(['0', '-5'])(
    'rejects a drop percentage of %s or below',
    (dropPercentage) => {
      expect(
        validateWhatIfForm(values({ dropPercentage })).dropPercentage
      ).toBe('Drop percentage must be greater than 0% and at most 100%.');
    }
  );

  it('rejects a drop percentage above 100', () => {
    expect(
      validateWhatIfForm(values({ dropPercentage: '150' })).dropPercentage
    ).toBe('Drop percentage must be greater than 0% and at most 100%.');
  });

  it('accepts the boundary value of 100', () => {
    expect(validateWhatIfForm(values({ dropPercentage: '100' }))).toEqual({});
  });

  it('is invalid when both fields are empty', () => {
    const errors = validateWhatIfForm(
      values({ dropPercentage: '', symbol: '' })
    );

    expect(errors.symbol).toBeDefined();
    expect(errors.dropPercentage).toBeDefined();
    expect(isWhatIfFormValid(values({ dropPercentage: '', symbol: '' }))).toBe(
      false
    );
  });
});

describe('toRunWhatIfRequest', () => {
  it('converts a percentage string to a 0-1 decimal and uppercases the symbol', () => {
    expect(
      toRunWhatIfRequest(values({ dropPercentage: '40', symbol: 'aapl' }))
    ).toEqual({
      dataSource: 'YAHOO',
      dropPercentage: 0.4,
      symbol: 'AAPL'
    });
  });
});

describe('createEmptyWhatIfFormValues', () => {
  it('defaults to the YAHOO data source and blank fields', () => {
    expect(createEmptyWhatIfFormValues()).toEqual({
      dataSource: 'YAHOO',
      dropPercentage: '',
      scenarioName: '',
      symbol: ''
    });
  });
});
