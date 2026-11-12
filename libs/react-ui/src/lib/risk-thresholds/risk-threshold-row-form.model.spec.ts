import {
  createThresholdRowFormValues,
  toUpdateRiskThresholdThresholds,
  validateThresholdRowForm
} from './risk-threshold-row-form.model';

describe('createThresholdRowFormValues', () => {
  it('converts fractions to rounded percentage strings', () => {
    expect(createThresholdRowFormValues({ max: 0.1, redMax: 0.25 })).toEqual({
      max: '10',
      min: '',
      redMax: '25',
      redMin: ''
    });
  });

  it('leaves missing fields as an empty string', () => {
    expect(createThresholdRowFormValues({})).toEqual({
      max: '',
      min: '',
      redMax: '',
      redMin: ''
    });
  });
});

describe('validateThresholdRowForm - ceiling shape', () => {
  it('accepts max < redMax', () => {
    expect(
      validateThresholdRowForm('ceiling', {
        max: '10',
        min: '',
        redMax: '25',
        redMin: ''
      })
    ).toBeUndefined();
  });

  it('rejects max >= redMax', () => {
    const error = validateThresholdRowForm('ceiling', {
      max: '30',
      min: '',
      redMax: '25',
      redMin: ''
    });

    expect(error).toContain('must be less than');
  });

  it('rejects a non-numeric field', () => {
    const error = validateThresholdRowForm('ceiling', {
      max: 'abc',
      min: '',
      redMax: '25',
      redMin: ''
    });

    expect(error).toContain('must be a number');
  });

  it('rejects an out-of-range field', () => {
    const error = validateThresholdRowForm('ceiling', {
      max: '10',
      min: '',
      redMax: '150',
      redMin: ''
    });

    expect(error).toContain('must be between 0% and 100%');
  });
});

describe('validateThresholdRowForm - band shape', () => {
  it('accepts redMin < min < max < redMax', () => {
    expect(
      validateThresholdRowForm('band', {
        max: '25',
        min: '10',
        redMax: '35',
        redMin: '5'
      })
    ).toBeUndefined();
  });

  it('rejects an out-of-order band', () => {
    const error = validateThresholdRowForm('band', {
      max: '10',
      min: '25',
      redMax: '35',
      redMin: '5'
    });

    expect(error).toContain('must satisfy');
  });
});

describe('toUpdateRiskThresholdThresholds', () => {
  it('converts percentage strings to fractions for a ceiling shape', () => {
    expect(
      toUpdateRiskThresholdThresholds('ceiling', {
        max: '10',
        min: '',
        redMax: '25',
        redMin: ''
      })
    ).toEqual({ max: 0.1, redMax: 0.25 });
  });

  it('converts all 4 fields for a band shape', () => {
    expect(
      toUpdateRiskThresholdThresholds('band', {
        max: '25',
        min: '10',
        redMax: '35',
        redMin: '5'
      })
    ).toEqual({ max: 0.25, min: 0.1, redMax: 0.35, redMin: 0.05 });
  });
});
