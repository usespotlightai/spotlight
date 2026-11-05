import { Fragment } from 'react';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import {
  EDGE_INDENT,
  LEAD_CELL,
  ROW_DIVIDER,
  TABLE_ROW,
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
      compact
    >
      {rows.map((row, at) => (
        <Fragment key={`${row.stage}:${row.from}→${row.to}`}>
          {row.stage !== rows[at - 1]?.stage && (
            <li
              data-slot="cost-flow-stage"
              className={cn(
                'col-span-full pt-4 pb-1 text-muted-foreground text-xs first:pt-2',
                EDGE_INDENT,
              )}
            >
              {row.stage}
            </li>
          )}
          <li data-slot="cost-flow" className={cn(TABLE_ROW, ROW_DIVIDER)}>
            <span className={cn(LEAD_CELL, EDGE_INDENT)}>
              <span className="truncate text-foreground">{row.from}</span>
            </span>
            <NestedCell heading="To" numeric={false}>
              <span className="text-foreground">{row.to}</span>
            </NestedCell>
            <NestedCell heading="Spend" strong>
              {spentIn(row.amount, currency)}
            </NestedCell>
          </li>
        </Fragment>
      ))}
    </NestedTable>
  );
}
