import type { ReactNode } from 'react';
import { CardTitle } from '@/components/features/insights/CardHeading';
import { useCardHeading } from '@/lib/card-heading';
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

const HEADER = 'whitespace-nowrap px-2.5 py-1.5 font-normal';

export function InsightsTable<T>({
  label,
  columns,
  rows,
  rowKey,
  picked = null,
}: InsightsTableProps<T>) {
  const heading = useCardHeading();
  const controlled = Boolean(heading?.controls);

  return (
    <div className="overflow-x-auto">
      <table
        aria-label={label}
        data-slot="insights-table"
        className="w-full min-w-max border-collapse text-xs"
      >
        <thead>
          <tr
            className={cn(
              'border-border border-b bg-muted/40',
              heading && 'h-8',
            )}
          >
            {columns.map((column, place) => (
              <th
                key={column.id}
                scope="col"
                className={cn(
                  HEADER,
                  'text-[0.7rem] text-muted-foreground',
                  column.numeric ? 'text-right' : 'text-left',
                )}
              >
                {heading && place === 0 ? (
                  <>
                    <CardTitle heading={heading} />
                    <span className="sr-only">{column.header}</span>
                  </>
                ) : (
                  column.header
                )}
              </th>
            ))}
            {controlled && (
              <th scope="col" className={cn(HEADER, 'w-0 py-0 text-right')}>
                <span className="flex items-center justify-end gap-1.5">
                  {heading?.controls}
                </span>
              </th>
            )}
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
                'even:bg-muted/30',
                picked === rowKey(row) && 'bg-selected even:bg-selected',
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={cn(
                    'whitespace-nowrap px-2.5 py-1.5 text-foreground',
                    column.numeric && 'text-right tabular-nums',
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
              {controlled && <td aria-hidden />}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
