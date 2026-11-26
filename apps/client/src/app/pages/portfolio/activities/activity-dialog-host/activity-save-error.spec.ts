import { activitySaveErrorMessage } from './activity-save-error';

describe('activitySaveErrorMessage', () => {
  it('shows a validation message from a 4xx response', () => {
    expect(
      activitySaveErrorMessage({
        error: { message: 'Withholding tax cannot exceed the gross dividend.' },
        status: 400
      })
    ).toBe('Withholding tax cannot exceed the gross dividend.');
  });

  it('joins an array of validation messages', () => {
    expect(
      activitySaveErrorMessage({
        error: { message: ['quantity must be a number', 'fee is required'] },
        status: 400
      })
    ).toBe('quantity must be a number fee is required');
  });

  it('hides a 5xx body behind the generic fallback', () => {
    expect(
      activitySaveErrorMessage({
        error: { message: 'secret database contents should not be returned' },
        status: 500
      })
    ).toBe('Could not save activity.');
  });

  it('uses the generic fallback when the response has no message', () => {
    expect(activitySaveErrorMessage({ status: 400 })).toBe(
      'Could not save activity.'
    );
  });
});
