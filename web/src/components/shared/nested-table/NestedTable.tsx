import type { CSSProperties, ReactNode } from 'react';
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
}: NestedTableProps) {
  const columns = useColumnWidths(headings.length);

  return (
    <ScrollArea
      orientation="horizontal"
      className="group/nested @container"
      data-compact={compact || undefined}
    >
      <div
        className="grid gap-x-6 @4xl:min-w-min @4xl:grid-cols-[var(--nested-columns)] @lg:group-data-compact/nested:min-w-min @lg:group-data-compact/nested:grid-cols-[var(--nested-columns)]"
        style={
          {
            '--nested-columns': columnTemplate(
              headings,
              columns.widths,
              trailing,
            ),
          } as CSSProperties
        }
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
