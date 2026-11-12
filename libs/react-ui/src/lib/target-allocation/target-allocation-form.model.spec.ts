import {
  createEmptyTargetAllocationFormValues,
  isTargetAllocationFormValid,
  toUpdateTargetAllocationRequest,
  validateTargetAllocationForm
} from './target-allocation-form.model';
import type { TargetAllocationFormValues } from './target-allocation-form.model';

const validValues: TargetAllocationFormValues = {
  groupBy: 'assetClass',
  rows: [
    { key: 'EQUITY', percentage: '60' },
    { key: 'FIXED_INCOME', percentage: '40' }
  ]
};

describe('createEmptyTargetAllocationFormValues', () => {
  it('starts with one empty row and the first groupBy option', () => {
    const values = createEmptyTargetAllocationFormValues();

    expect(values.groupBy).toBe('assetClass');
    expect(values.rows).toEqual([{ key: '', percentage: '' }]);
  });
});

describe('validateTargetAllocationForm', () => {
  it('passes for valid, distinct keys summing to 100%', () => {
    expect(validateTargetAllocationForm(validValues)).toEqual({});
  });

  it('rejects an empty key', () => {
    const values = {
      ...validValues,
      rows: [{ key: '', percentage: '100' }]
    };

    expect(validateTargetAllocationForm(values).rows).toBe(
      'Every row needs a key.'
    );
  });

  it('rejects a duplicate key', () => {
    const values = {
      ...validValues,
      rows: [
        { key: 'EQUITY', percentage: '50' },
        { key: 'EQUITY', percentage: '50' }
      ]
    };

    expect(validateTargetAllocationForm(values).rows).toBe(
      'Each key may only appear once.'
    );
  });

  it('rejects a non-numeric percentage', () => {
    const values = {
      ...validValues,
      rows: [{ key: 'EQUITY', percentage: 'abc' }]
    };

    expect(validateTargetAllocationForm(values).rows).toBe(
      'Every row needs a percentage.'
    );
  });

  it('rejects a percentage outside 0-100', () => {
    const values = {
      ...validValues,
      rows: [{ key: 'EQUITY', percentage: '150' }]
    };

    expect(validateTargetAllocationForm(values).rows).toBe(
      'Each percentage must be between 0% and 100%.'
    );
  });

  it('rejects percentages that do not sum to 100%', () => {
    const values = {
      ...validValues,
      rows: [
        { key: 'EQUITY', percentage: '60' },
        { key: 'FIXED_INCOME', percentage: '30' }
      ]
    };

    expect(validateTargetAllocationForm(values).rows).toBe(
      'Percentages must add up to 100%. They currently add up to 90%.'
    );
  });
});

describe('isTargetAllocationFormValid', () => {
  it('matches validateTargetAllocationForm returning no errors', () => {
    expect(isTargetAllocationFormValid(validValues)).toBe(true);
    expect(
      isTargetAllocationFormValid({
        ...validValues,
        rows: [{ key: '', percentage: '100' }]
      })
    ).toBe(false);
  });
});

describe('toUpdateTargetAllocationRequest', () => {
  it('trims keys and converts each percentage to a 0-1 decimal', () => {
    const values: TargetAllocationFormValues = {
      groupBy: 'assetClass',
      rows: [
        { key: ' EQUITY ', percentage: '60' },
        { key: 'FIXED_INCOME', percentage: '40' }
      ]
    };

    expect(toUpdateTargetAllocationRequest(values)).toEqual({
      groupBy: 'assetClass',
      targets: [
        { key: 'EQUITY', percentage: 0.6 },
        { key: 'FIXED_INCOME', percentage: 0.4 }
      ]
    });
  });
});
