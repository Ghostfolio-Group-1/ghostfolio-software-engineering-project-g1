/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { RiskThresholdRow } from './risk-threshold-row';
import type { RiskThresholdItem } from './risk-thresholds.client';

const ceilingItem: RiskThresholdItem = {
  defaults: { max: 0.1, redMax: 0.25 },
  isActive: true,
  isCustomized: false,
  name: 'Single stock concentration',
  ruleKey: 'SingleStockConcentration',
  shape: 'ceiling',
  thresholds: { max: 0.1, redMax: 0.25 }
};

const bandItem: RiskThresholdItem = {
  defaults: { max: 0.25, min: 0.1, redMax: 0.35, redMin: 0.05 },
  isActive: true,
  isCustomized: true,
  name: 'Volatility estimate',
  ruleKey: 'PortfolioVolatility',
  shape: 'band',
  thresholds: { max: 0.25, min: 0.1, redMax: 0.35, redMin: 0.05 }
};

describe('RiskThresholdRow', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('shows only max/redMax for a ceiling shape', async () => {
    await act(async () => {
      root.render(
        <RiskThresholdRow
          item={ceilingItem}
          onReset={() => {}}
          onSave={() => {}}
        />
      );
    });

    expect(
      container.querySelector(
        '[aria-label="Single stock concentration Warning max"]'
      )
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[aria-label="Single stock concentration Warning min"]'
      )
    ).toBeNull();
    expect(container.textContent).not.toContain('Customized');
  });

  it('shows all 4 fields and a reset button for a customized band shape', async () => {
    await act(async () => {
      root.render(
        <RiskThresholdRow
          item={bandItem}
          onReset={() => {}}
          onSave={() => {}}
        />
      );
    });

    expect(
      container.querySelector('[aria-label="Volatility estimate Warning min"]')
    ).not.toBeNull();
    expect(container.textContent).toContain('Customized');
    expect(
      Array.from(container.querySelectorAll('button')).some(
        (button) => button.textContent === 'Reset to default'
      )
    ).toBe(true);
  });

  it('shows a client-side validation error instead of calling onSave', async () => {
    const onSave = jest.fn();

    await act(async () => {
      root.render(
        <RiskThresholdRow
          item={ceilingItem}
          onReset={() => {}}
          onSave={onSave}
        />
      );
    });

    const maxInput = container.querySelector(
      '[aria-label="Single stock concentration Warning max"]'
    ) as HTMLInputElement;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;

    await act(async () => {
      nativeSetter?.call(maxInput, '90');
      maxInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const saveButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Save'
    );

    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('must be less than');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onSave with the current isActive and values when valid', async () => {
    const onSave = jest.fn();

    await act(async () => {
      root.render(
        <RiskThresholdRow
          item={ceilingItem}
          onReset={() => {}}
          onSave={onSave}
        />
      );
    });

    const saveButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Save'
    );

    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onSave).toHaveBeenCalledWith(true, {
      max: '10',
      min: '',
      redMax: '25',
      redMin: ''
    });
  });

  // The "Active" checkbox is the only interactive toggle on this row - every
  // other assertion in this file exercises the item's default isActive: true,
  // so unchecking it and still saving valid values was never actually proven
  // to flip what onSave receives.
  it('unchecks the Active box and calls onSave with isActive: false', async () => {
    const onSave = jest.fn();

    await act(async () => {
      root.render(
        <RiskThresholdRow
          item={ceilingItem}
          onReset={() => {}}
          onSave={onSave}
        />
      );
    });

    const activeCheckbox = container.querySelector(
      'input[type="checkbox"]'
    ) as HTMLInputElement;

    expect(activeCheckbox.checked).toBe(true);
    expect(activeCheckbox.closest('label')?.textContent).toContain('Active');

    await act(async () => {
      activeCheckbox.click();
    });

    expect(activeCheckbox.checked).toBe(false);

    const saveButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Save'
    );

    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onSave).toHaveBeenCalledWith(false, {
      max: '10',
      min: '',
      redMax: '25',
      redMin: ''
    });
  });
});
