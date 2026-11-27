import type { CSSProperties, ReactNode, ReactElement } from 'react';

import { NestedHeadings } from '@/components/shared/nested-table/NestedHeadings';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useColumnWidths } from '@/hooks/useColumnWidths';
import { columnTemplate, filled, type NestedHeading } from '@/lib/nested-table';

type NestedTableProps = {
  label: string;
  headings: readonly NestedHeading[];
  trailing?: boolean;
  headed?: boolean;
  compact?: boolean;
  children: ReactNode;
};

export function NestedTable({
  label,
  headings,
  trailing = false,
  headed = true,
  compact = false,
  children,
}: NestedTableProps): ReactElement {
  const columns = useColumnWidths(headings.length);
  const nestedColumns: CSSProperties & Record<`--${string}`, string> = {
    '--nested-columns': columnTemplate(headings, columns.widths, trailing),
  };

  return (
    <ScrollArea
      orientation="horizontal"
      className="group/nested @container isolate"
      data-compact={compact || undefined}
    >
      <div
        className="grid gap-x-6 text-sm @4xl:min-w-min @4xl:grid-cols-[var(--nested-columns)] @lg:group-data-compact/nested:min-w-min @lg:group-data-compact/nested:grid-cols-[var(--nested-columns)]"
        style={nestedColumns}
      >
        {headed && (
          <NestedHeadings
            headings={headings}
            trailing={trailing || filled(headings, columns.widths, trailing)}
            onPin={columns.pin}
            onResize={columns.resize}
            onReset={columns.reset}
          />
        )}

        <ul aria-label={label} className="col-span-full grid grid-cols-subgrid">
          {children}
        </ul>
      </div>
    </ScrollArea>
  );
}
