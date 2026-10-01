import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { spentIn } from '@/lib/inbox';
import type { FlowLinkRow } from '@/lib/insights';

type CostFlowTableProps = {
  rows: readonly FlowLinkRow[];
  currency: string;
};

export function CostFlowTable({ rows, currency }: CostFlowTableProps) {
  const columns: InsightsColumn<FlowLinkRow>[] = [
    { id: 'from', header: 'From', cell: (row) => row.from },
    { id: 'to', header: 'To', cell: (row) => row.to },
    {
      id: 'amount',
      header: 'Spend',
      numeric: true,
      cell: (row) => spentIn(row.amount, currency),
    },
  ];

  return (
    <InsightsTable
      label="Spend from model to station to repository"
      columns={columns}
      rows={rows}
      rowKey={(row) => `${row.from}→${row.to}`}
    />
  );
}
