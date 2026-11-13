import { useEffect, useRef, useState } from 'react';

export type TaxExportFormat = 'CSV' | 'PDF';
export type TaxExportMethod = 'FIFO' | 'AVERAGE_COST';

export interface TaxExportSelection {
  format: TaxExportFormat;
  method: TaxExportMethod;
  year: number;
}

/** Returned by an approved server export route; contains no UI-calculated tax. */
export interface TaxExportFile {
  content: Blob;
  contentType: 'application/pdf' | 'text/csv';
  fileName: string;
}

export type TaxExportLoader = (
  selection: TaxExportSelection,
  signal: AbortSignal
) => Promise<TaxExportFile>;

export interface TaxExportDownloadsProps {
  /** Omit until an authenticated, live backend export route is available. */
  download?: TaxExportLoader;
  method: TaxExportMethod;
  year: number;
}

const expectedMime = {
  CSV: 'text/csv',
  PDF: 'application/pdf'
} as const;

/** No server-provided paths or arbitrary filename characters reach the browser. */
function verifyFile(file: TaxExportFile, format: TaxExportFormat): void {
  if (
    !file ||
    !(file.content instanceof Blob) ||
    file.content.size === 0 ||
    file.contentType !== expectedMime[format] ||
    !new RegExp(`^[a-zA-Z0-9._-]+\\.${format.toLowerCase()}$`).test(
      file.fileName
    )
  ) {
    throw new Error('Invalid Tax export response');
  }
}

function saveFile(file: TaxExportFile): void {
  const url = URL.createObjectURL(file.content);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.fileName;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    try {
      anchor.click();
    } finally {
      anchor.remove();
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Tax-owned UI shell, intentionally URL-agnostic. The host supplies a live
 * authenticated export loader only after backend routes/trace are approved.
 * No export is generated from client-side numbers or synthetic fixtures.
 */
export function TaxExportDownloads({
  download,
  method,
  year
}: TaxExportDownloadsProps) {
  const [busy, setBusy] = useState<TaxExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const downloading = useRef(false);

  useEffect(() => {
    setBusy(null);
    setError(null);
    downloading.current = false;
    return () => {
      active.current?.abort();
      active.current = null;
      downloading.current = false;
    };
  }, [method, year]);

  async function start(format: TaxExportFormat): Promise<void> {
    if (downloading.current || !download) return;
    downloading.current = true;
    setBusy(format);
    setError(null);
    const controller = new AbortController();
    active.current = controller;

    try {
      const file = await download({ format, method, year }, controller.signal);
      if (controller.signal.aborted) return;
      verifyFile(file, format);
      saveFile(file);
    } catch {
      if (!controller.signal.aborted) {
        // Intentionally never print backend error details or private data.
        setError(
          `Unable to download the ${format} Tax export. Please try again.`
        );
      }
    } finally {
      if (active.current === controller) {
        active.current = null;
        downloading.current = false;
        setBusy(null);
      }
    }
  }

  const canDownload =
    download !== undefined &&
    Number.isInteger(year) &&
    year >= 1970 &&
    year <= 2100 &&
    (method === 'FIFO' || method === 'AVERAGE_COST');

  return (
    <section aria-label="Tax report downloads" aria-busy={busy !== null}>
      <h3>Download yearly Tax report</h3>
      <p>
        {year} · {method}. Amounts in downloads come from the Tax backend.
      </p>
      {!download ? (
        <p role="status">
          CSV and PDF exports are unavailable until the live Tax export API is
          connected.
        </p>
      ) : null}
      <button
        disabled={!canDownload || busy !== null}
        onClick={() => void start('CSV')}
        type="button"
      >
        Download CSV
      </button>{' '}
      <button
        disabled={!canDownload || busy !== null}
        onClick={() => void start('PDF')}
        type="button"
      >
        Download PDF
      </button>
      {busy ? <p role="status">Preparing {busy} download…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
