import { useRef } from 'react';
import { InfoNote } from '@/components/features/insights/InfoNote';
import { ColumnResizer } from '@/components/shared/ColumnResizer';
import {
  EDGE_INDENT,
  INNER_INDENT,
  OUTER_INDENT,
} from '@/components/shared/nested-table/nested-rows';
import type { NestedHeading } from '@/lib/nested-table';
import { cn } from '@/lib/utils';

const INDENTS = {
  edge: EDGE_INDENT,
  outer: OUTER_INDENT,
  inner: INNER_INDENT,
};

const NUMERIC = 'flex items-center justify-end gap-1.5 whitespace-nowrap';

type NestedHeadingsProps = {
  headings: readonly NestedHeading[];
  trailing: boolean;
  onPin: (widths: readonly number[]) => void;
  onResize: (column: number, width: number) => void;
  onReset: (column: number) => void;
};

export function NestedHeadings({
  headings,
  trailing,
  onPin,
  onResize,
  onReset,
}: NestedHeadingsProps) {
  const row = useRef<HTMLDivElement>(null);
  const pin = () =>
    onPin(
      [...(row.current?.children ?? [])]
        .slice(0, headings.length)
        .map((cell) => cell.getBoundingClientRect().width),
    );

  return (
    <div
      ref={row}
      data-slot="nested-headings"
      className="col-span-full hidden grid-cols-subgrid items-center border-border border-y bg-surface py-1.5 pr-2 text-[0.7rem] text-muted-foreground @4xl:grid"
    >
      {headings.map((heading, column) => (
        <div
          key={heading.label}
          className={cn(
            'relative min-w-0',
            heading.numeric ? NUMERIC : 'flex items-center gap-1',
            heading.indent && INDENTS[heading.indent],
          )}
        >
          <span aria-hidden className="truncate">
            {heading.label}
          </span>
          {heading.note && <InfoNote note={heading.note} />}
          {column < headings.length - 1 || trailing ? (
            <ColumnResizer
              label={heading.label}
              onStart={pin}
              onResize={(width) => onResize(column, width)}
              onReset={() => onReset(column)}
            />
          ) : null}
        </div>
      ))}
      {trailing && <span aria-hidden />}
    </div>
  );
}
