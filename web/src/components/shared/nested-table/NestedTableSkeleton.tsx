import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import {
  EDGE_INDENT,
  LEAD_CELL,
  ROW_DIVIDER,
  TABLE_ROW,
} from '@/components/shared/nested-table/nested-rows';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import type { NestedHeading } from '@/lib/nested-table';
import { cn } from '@/lib/utils';

type NestedTableSkeletonProps = {
  label: string;
  headings: readonly NestedHeading[];
  rows?: number;
  compact?: boolean;
  trailing?: boolean;
};

export function NestedTableSkeleton({
  label,
  headings,
  rows = 2,
  compact = false,
  trailing = false,
}: NestedTableSkeletonProps) {
  const [lead, ...rest] = headings;

  return (
    <div role="status" aria-label={label}>
      <NestedTable
        label={label}
        headings={headings}
        compact={compact}
        trailing={trailing}
      >
        {Array.from({ length: rows }, (_, row) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
            key={row}
            aria-hidden
            className={cn(TABLE_ROW, ROW_DIVIDER, 'hover:bg-transparent')}
          >
            <span className={cn(LEAD_CELL, lead?.indent && EDGE_INDENT)}>
              <SkeletonLine className="w-24" />
            </span>
            {rest.map((heading) => (
              <NestedCell
                key={heading.label}
                heading={heading.label}
                numeric={heading.numeric ?? false}
              >
                <SkeletonLine
                  className={cn('w-12', heading.numeric && 'ml-auto')}
                />
              </NestedCell>
            ))}
          </li>
        ))}
      </NestedTable>
    </div>
  );
}
