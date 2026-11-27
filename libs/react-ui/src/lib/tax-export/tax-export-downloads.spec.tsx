/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { TaxExportDownloads } from './tax-export-downloads';
import type { TaxExportLoader } from './tax-export-downloads';

function validFile(format: 'CSV' | 'PDF') {
  const isPdf = format === 'PDF';
  const contentType = isPdf ? 'application/pdf' : 'text/csv';
  return {
    content: new Blob([isPdf ? '%PDF-1.7' : 'recordType,year\nSUMMARY,2026'], {
      type: contentType
    }),
    contentType,
    fileName: `ghostfolio-tax-2026-fifo.${format.toLowerCase()}`
  } as const;
}

describe('TaxExportDownloads', () => {
  let container: HTMLDivElement;
  let root: Root;
  let createUrl: jest.Mock;
  let revokeUrl: jest.Mock;
  let click: jest.SpyInstance;

  beforeAll(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    createUrl = jest.fn().mockReturnValue('blob:tax-test');
    revokeUrl = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createUrl
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeUrl
    });
    click = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation();
  });

  afterEach(() => {
    act(() => root.unmount());
    click.mockRestore();
    container.remove();
  });

  async function render(download?: TaxExportLoader, year = 2026) {
    await act(async () => {
      root.render(
        <TaxExportDownloads download={download} method="FIFO" year={year} />
      );
    });
  }

  function button(label: string): HTMLButtonElement {
    const match = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === label
    );
    expect(match).toBeDefined();
    return match as HTMLButtonElement;
  }

  it('disables real downloads when no approved API loader exists', async () => {
    await render();
    expect(button('Download CSV').disabled).toBe(true);
    expect(button('Download PDF').disabled).toBe(true);
    expect(container.textContent).toContain('unavailable');
    expect(createUrl).not.toHaveBeenCalled();
  });

  it.each(['CSV', 'PDF'] as const)(
    'saves the exact server-produced %s file, without recalculation',
    async (format) => {
      const download = jest.fn().mockResolvedValue(validFile(format));
      await render(download);
      await act(async () => button(`Download ${format}`).click());
      expect(download).toHaveBeenCalledWith(
        { format, method: 'FIFO', year: 2026 },
        expect.any(AbortSignal)
      );
      expect(createUrl).toHaveBeenCalledTimes(1);
      expect(click).toHaveBeenCalledTimes(1);
      expect(revokeUrl).toHaveBeenCalledWith('blob:tax-test');
      expect(document.querySelector('a[download]')).toBeNull();
    }
  );

  it('shows an accessible safe error when a server export fails', async () => {
    const download = jest
      .fn()
      .mockRejectedValueOnce(new Error('SECRET private server message'))
      .mockResolvedValueOnce(validFile('PDF'));
    await render(download);
    await act(async () => button('Download PDF').click());
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).toContain('Unable to download');
    expect(container.textContent).not.toContain('SECRET');
    expect(createUrl).not.toHaveBeenCalled();
    await act(async () => button('Download PDF').click());
    expect(download).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(createUrl).toHaveBeenCalledTimes(1);
  });

  it('rejects empty or mistyped PDF responses instead of downloading them', async () => {
    const download = jest.fn().mockResolvedValue({
      content: new Blob(['not a pdf']),
      contentType: 'text/csv',
      fileName: 'ghostfolio-tax-2026-fifo.pdf'
    });
    await render(download);
    await act(async () => button('Download PDF').click());
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(createUrl).not.toHaveBeenCalled();
  });

  it('disables exports outside the agreed calendar-year range', async () => {
    await render(jest.fn(), 2101);
    expect(button('Download CSV').disabled).toBe(true);
    expect(button('Download PDF').disabled).toBe(true);
  });

  it('aborts in-flight export on unmount and never saves a stale file', async () => {
    let resolveDownload: (file: ReturnType<typeof validFile>) => void = () =>
      undefined;
    const promise = new Promise<ReturnType<typeof validFile>>((resolve) => {
      resolveDownload = resolve;
    });
    const download = jest.fn().mockReturnValue(promise);
    await render(download);
    await act(async () => button('Download CSV').click());
    const signal = download.mock.calls[0][1] as AbortSignal;
    expect(signal.aborted).toBe(false);
    await act(async () => root.unmount());
    expect(signal.aborted).toBe(true);
    await act(async () => resolveDownload(validFile('CSV')));
    expect(createUrl).not.toHaveBeenCalled();
    root = createRoot(container); // separate root so afterEach can clean up
  });
});
