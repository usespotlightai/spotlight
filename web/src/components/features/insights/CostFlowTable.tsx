import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import {
  EDGE_INDENT,
  ROW_DIVIDER,
} from '@/components/shared/nested-table/nested-rows';
import { spentIn } from '@/lib/inbox';
import type { FlowLinkRow } from '@/lib/insights';
import { SPREAD } from '@/lib/nested-table';
import { cn } from '@/lib/utils';

const HEADINGS = [
  { label: 'From', indent: 'edge' as const, size: SPREAD },
  { label: 'To', size: SPREAD },
  { label: 'Spend', numeric: true, size: SPREAD },
];

type CostFlowTableProps = {
  rows: readonly FlowLinkRow[];
  currency: string;
};

export function CostFlowTable({ rows, currency }: CostFlowTableProps) {
  return (
    <NestedTable
      label="Spend from model to station to repository"
      headings={HEADINGS}
    >
      {rows.map((row) => (
        <li
          key={`${row.from}→${row.to}`}
          data-slot="cost-flow"
          className={cn(
            'col-span-full grid grid-cols-2 items-center gap-x-6 gap-y-2 py-2 pr-2 text-xs @4xl:grid-cols-subgrid',
            ROW_DIVIDER,
          )}
        >
          <span
            className={cn(
              'col-span-full min-w-0 truncate text-foreground @4xl:col-span-1',
              EDGE_INDENT,
            )}
          >
            {row.from}
          </span>
          <NestedCell heading="To" numeric={false} strong>
            {row.to}
          </NestedCell>
          <NestedCell heading="Spend" strong>
            {spentIn(row.amount, currency)}
          </NestedCell>
        </li>
      ))}
    </NestedTable>
  );
}
