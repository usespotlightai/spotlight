import { type ReactNode, useRef } from 'react';
import { ColumnResizer } from '@/components/shared/ColumnResizer';
import {
  EDGE_INDENT,
  ROW_DIVIDER,
} from '@/components/shared/nested-table/nested-rows';
import { useColumnWidths } from '@/hooks/useColumnWidths';
import {
  columnTemplate,
  filled,
  type NestedHeading,
  SPREAD,
} from '@/lib/nested-table';
import { cn } from '@/lib/utils';

export type InsightsColumn<T> = {
  readonly id: string;
  readonly header: string;
  readonly cell: (row: T) => ReactNode;
  readonly numeric?: boolean;
  readonly size?: string;
};

type InsightsTableProps<T> = {
  label: string;
  columns: readonly InsightsColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  picked?: string | null;
};

const ROW = 'col-span-full grid grid-cols-subgrid items-center pr-2';

export function InsightsTable<T>({
  label,
  columns,
  rows,
  rowKey,
  picked = null,
}: InsightsTableProps<T>) {
  const widths = useColumnWidths(columns.length);
  const head = useRef<HTMLTableRowElement>(null);
  const headings: NestedHeading[] = columns.map((column, at) => ({
    label: column.header,
    size: column.size ?? (at === 0 ? 'minmax(8rem,2fr)' : SPREAD),
  }));
  const filling = filled(headings, widths.widths, false);
  const pin = () =>
    widths.pin(
      [...(head.current?.children ?? [])]
        .slice(0, columns.length)
        .map((cell) => cell.getBoundingClientRect().width),
    );

  return (
    <div className="overflow-x-auto">
      <table
        aria-label={label}
        data-slot="insights-table"
        className="grid min-w-min gap-x-6 text-xs"
        style={{
          gridTemplateColumns: columnTemplate(headings, widths.widths, false),
        }}
      >
        <thead className="contents">
          <tr
            ref={head}
            className={cn(
              ROW,
              'border-border border-y bg-surface py-1.5 text-[0.7rem] text-muted-foreground',
            )}
          >
            {columns.map((column, at) => (
              <th
                key={column.id}
                scope="col"
                className={cn(
                  'relative min-w-0 font-normal',
                  at === 0 && EDGE_INDENT,
                  column.numeric ? 'text-right' : 'text-left',
                )}
              >
                <span className="block truncate">{column.header}</span>
                {(at < columns.length - 1 || filling) && (
                  <ColumnResizer
                    label={column.header}
                    onStart={pin}
                    onResize={(width) => widths.resize(at, width)}
                    onReset={() => widths.reset(at)}
                  />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="contents">
          {rows.map((row) => {
            const key = rowKey(row);

            return (
              <tr
                key={key}
                aria-selected={picked === null ? undefined : picked === key}
                className={cn(
                  ROW,
                  'py-2',
                  ROW_DIVIDER,
                  picked === key && 'bg-selected',
                )}
              >
                {columns.map((column, at) => (
                  <td
                    key={column.id}
                    className={cn(
                      'min-w-0 whitespace-nowrap text-foreground',
                      at === 0 && EDGE_INDENT,
                      column.numeric && 'text-right tabular-nums',
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
