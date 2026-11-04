import type { ReactNode } from 'react';

import { useTheme } from '../theme/theme-provider';
import { designTokens, px } from '../tokens/design-tokens';

export interface TableColumn<Row> {
  align?: 'left' | 'right';
  cell: (row: Row) => ReactNode;
  header: string;
  key: string;
}

export interface TableProps<Row> {
  caption?: string;
  columns: TableColumn<Row>[];
  emptyMessage?: string;
  getRowKey: (row: Row) => string;
  rows: Row[];
}

// Shared table for holdings, tax lots, gains and other row data. Cells render
// whatever the feature passes (e.g. decimal strings as-is); the table does no
// number formatting of its own.
export function Table<Row>({
  caption,
  columns,
  emptyMessage = 'No rows',
  getRowKey,
  rows
}: TableProps<Row>) {
  const theme = useTheme();
  const cellStyle = {
    borderBottom: `1px solid ${theme.color.border}`,
    padding: `${px(designTokens.spacing.xs)} ${px(designTokens.spacing.sm)}`
  };

  return (
    <table
      style={{
        borderCollapse: 'collapse',
        color: theme.color.text,
        fontSize: px(designTokens.fontSize.sm),
        width: '100%'
      }}
    >
      {caption ? (
        <caption style={{ color: theme.color.textMuted, textAlign: 'left' }}>
          {caption}
        </caption>
      ) : null}
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column.key}
              scope="col"
              style={{ ...cellStyle, textAlign: column.align ?? 'left' }}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td
              colSpan={columns.length}
              style={{ ...cellStyle, color: theme.color.textMuted }}
            >
              {emptyMessage}
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  style={{ ...cellStyle, textAlign: column.align ?? 'left' }}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
