import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type InsightsColumn<T> = {
  readonly id: string;
  readonly header: string;
  readonly cell: (row: T) => ReactNode;
  readonly numeric?: boolean;
};

type InsightsTableProps<T> = {
  label: string;
  columns: readonly InsightsColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  picked?: string | null;
};

export function InsightsTable<T>({
  label,
  columns,
  rows,
  rowKey,
  picked = null,
}: InsightsTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table
        aria-label={label}
        data-slot="insights-table"
        className="w-full min-w-max border-collapse text-xs"
      >
        <thead>
          <tr className="border-border border-b">
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={cn(
                  'whitespace-nowrap px-2 py-1.5 font-normal text-muted-foreground',
                  column.numeric ? 'text-right' : 'text-left',
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              aria-selected={
                picked === null ? undefined : picked === rowKey(row)
              }
              className={cn(
                'border-border border-b last:border-b-0',
                picked === rowKey(row) && 'bg-selected',
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={cn(
                    'whitespace-nowrap px-2 py-1.5 text-foreground',
                    column.numeric && 'text-right tabular-nums',
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
