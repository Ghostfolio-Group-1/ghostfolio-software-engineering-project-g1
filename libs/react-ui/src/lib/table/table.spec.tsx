import { renderToStaticMarkup } from 'react-dom/server';

import { darkTheme } from '../theme/theme';
import { ThemeProvider } from '../theme/theme-provider';
import { Table } from './table';
import type { TableColumn } from './table';

interface Lot {
  id: string;
  quantity: string;
  symbol: string;
}

const columns: TableColumn<Lot>[] = [
  { cell: (lot) => lot.symbol, header: 'Symbol', key: 'symbol' },
  {
    align: 'right',
    cell: (lot) => lot.quantity,
    header: 'Quantity',
    key: 'quantity'
  }
];

describe('Table', () => {
  it('renders a header cell per column and a row per item', () => {
    const html = renderToStaticMarkup(
      <Table
        columns={columns}
        getRowKey={(lot) => lot.id}
        rows={[
          { id: '1', quantity: '10', symbol: 'AAPL' },
          { id: '2', quantity: '4', symbol: 'MSFT' }
        ]}
      />
    );

    expect(html.match(/<th /g)).toHaveLength(2);
    expect(html.match(/<tr>/g)).toHaveLength(3);
    expect(html).toContain('scope="col"');
    expect(html).toContain('AAPL');
    expect(html).toContain('MSFT');
  });

  it('renders decimal strings exactly as given', () => {
    const html = renderToStaticMarkup(
      <Table
        columns={columns}
        getRowKey={(lot) => lot.id}
        rows={[{ id: '1', quantity: '10.123456789012345678', symbol: 'AAPL' }]}
      />
    );

    expect(html).toContain('10.123456789012345678');
  });

  it('right-aligns numeric columns', () => {
    const html = renderToStaticMarkup(
      <Table
        columns={columns}
        getRowKey={(lot) => lot.id}
        rows={[{ id: '1', quantity: '10', symbol: 'AAPL' }]}
      />
    );

    expect(html).toContain('text-align:right');
  });

  it('shows the empty message across all columns when there are no rows', () => {
    const html = renderToStaticMarkup(
      <Table
        columns={columns}
        emptyMessage="No tax lots"
        getRowKey={(lot) => lot.id}
        rows={[]}
      />
    );

    expect(html).toContain('colSpan="2"');
    expect(html).toContain('No tax lots');
  });

  it('renders the caption and uses the active theme', () => {
    const html = renderToStaticMarkup(
      <ThemeProvider theme={darkTheme}>
        <Table
          caption="Open lots"
          columns={columns}
          getRowKey={(lot) => lot.id}
          rows={[]}
        />
      </ThemeProvider>
    );

    expect(html).toContain('<caption');
    expect(html).toContain('Open lots');
    expect(html).toContain('color:#fafafa');
  });
});
